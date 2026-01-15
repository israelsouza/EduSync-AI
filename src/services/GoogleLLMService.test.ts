import { GoogleLLMService } from "./GoogleLLMService";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SUNITA_SYSTEM_PROMPT } from "../prompts/systemPrompt";

jest.mock("@langchain/google-genai");

const MockedChatGoogleGenerativeAI = ChatGoogleGenerativeAI as jest.MockedClass<typeof ChatGoogleGenerativeAI>;

describe("GoogleLLMService", () => {
  let service: GoogleLLMService;
  let mockInvoke: jest.Mock;
  const mockApiKey = "test-google-api-key";

  beforeEach(() => {
    mockInvoke = jest.fn();
    MockedChatGoogleGenerativeAI.mockImplementation(
      () =>
        ({
          invoke: mockInvoke,
        }) as unknown as ChatGoogleGenerativeAI
    );

    service = new GoogleLLMService(mockApiKey);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    test("should initialize with default model name", () => {
      const service = new GoogleLLMService(mockApiKey);
      const modelInfo = service.getModelInfo();

      expect(modelInfo.provider).toBe("google");
      expect(modelInfo.model).toBe("gemini-2.5-flash");
    });

    test("should create ChatGoogleGenerativeAI with correct config", () => {
      new GoogleLLMService(mockApiKey);

      expect(MockedChatGoogleGenerativeAI).toHaveBeenCalledWith({
        apiKey: mockApiKey,
        model: "gemini-2.5-flash",
        temperature: 1.0,
        maxOutputTokens: 1024,
        maxRetries: 3,
      });
    });
  });

  describe("generateResponse", () => {
    test("should generate response with system and human messages", async () => {
      const mockResponse = {
        content: "Esta é uma estratégia pedagógica para sua sala de aula.",
      };
      mockInvoke.mockResolvedValue(mockResponse);

      const prompt = "Como ensinar subtração com zero?";
      const response = await service.generateResponse(prompt);

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith([
        expect.objectContaining({
          content: SUNITA_SYSTEM_PROMPT,
        }),
        expect.objectContaining({
          content: prompt,
        }),
      ]);
      expect(response).toBe(mockResponse.content);
    });

    test("should handle empty prompt", async () => {
      const mockResponse = { content: "Por favor, faça uma pergunta específica." };
      mockInvoke.mockResolvedValue(mockResponse);

      const response = await service.generateResponse("");

      expect(mockInvoke).toHaveBeenCalledWith([
        expect.objectContaining({ content: SUNITA_SYSTEM_PROMPT }),
        expect.objectContaining({ content: "" }),
      ]);
      expect(response).toBe(mockResponse.content);
    });

    test("should handle long prompts", async () => {
      const longPrompt = "Como ensinar ".repeat(200) + "matemática?";
      const mockResponse = { content: "Aqui estão algumas estratégias..." };
      mockInvoke.mockResolvedValue(mockResponse);

      const response = await service.generateResponse(longPrompt);

      expect(mockInvoke).toHaveBeenCalledWith([expect.anything(), expect.objectContaining({ content: longPrompt })]);
      expect(response).toBe(mockResponse.content);
    });

    test("should handle API errors gracefully", async () => {
      const errorMessage = "API rate limit exceeded";
      mockInvoke.mockRejectedValue(new Error(errorMessage));

      await expect(service.generateResponse("test prompt")).rejects.toThrow(errorMessage);
    });

    test("should handle network timeouts", async () => {
      mockInvoke.mockRejectedValue(new Error("Request timeout"));

      await expect(service.generateResponse("test")).rejects.toThrow("Request timeout");
    });

    test("should handle non-string content responses", async () => {
      const mockResponse = { content: { text: "Invalid format" } };
      mockInvoke.mockResolvedValue(mockResponse);

      const response = await service.generateResponse("test");

      expect(response).toBe("Invalid format");
    });

    test("should handle array content responses", async () => {
      const mockResponse = { content: ["Part 1", " Part 2"] };
      mockInvoke.mockResolvedValue(mockResponse);

      const response = await service.generateResponse("test");

      expect(response).toBe("Part 1 Part 2");
    });

    test("should throw TypeError for unsupported content types", async () => {
      const mockResponse = { content: { data: "no text field" } };
      mockInvoke.mockResolvedValue(mockResponse);

      await expect(service.generateResponse("test")).rejects.toThrow(TypeError);
      await expect(service.generateResponse("test")).rejects.toThrow("LLM response content must be a string");
    });

    test("should throw error for null/undefined content", async () => {
      const mockResponse = { content: null };
      mockInvoke.mockResolvedValue(mockResponse);

      await expect(service.generateResponse("test")).rejects.toThrow("LLM returned empty or invalid response");
    });
  });

  describe("getModelInfo", () => {
    test("should return correct provider and model", () => {
      const info = service.getModelInfo();

      expect(info).toEqual({
        provider: "google",
        model: "gemini-2.5-flash",
      });
    });

    test("should maintain model info consistency across calls", () => {
      const info1 = service.getModelInfo();
      const info2 = service.getModelInfo();

      expect(info1).toEqual(info2);
    });
  });

  describe("integration scenarios", () => {
    test("should handle multiple consecutive requests", async () => {
      const responses = [{ content: "Resposta 1" }, { content: "Resposta 2" }, { content: "Resposta 3" }];

      mockInvoke.mockResolvedValueOnce(responses[0]).mockResolvedValueOnce(responses[1]).mockResolvedValueOnce(responses[2]);

      const result1 = await service.generateResponse("pergunta 1");
      const result2 = await service.generateResponse("pergunta 2");
      const result3 = await service.generateResponse("pergunta 3");

      expect(result1).toBe("Resposta 1");
      expect(result2).toBe("Resposta 2");
      expect(result3).toBe("Resposta 3");
      expect(mockInvoke).toHaveBeenCalledTimes(3);
    });
  });
});
