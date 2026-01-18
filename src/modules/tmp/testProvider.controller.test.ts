import { Request, Response } from "express";
import { testGoogleLLMController } from "./testProvider.controller";
import { GoogleLLMService } from "../../services/GoogleLLMService";

jest.mock("../../services/GoogleLLMService");
jest.mock("../../config/env.js", () => ({
  env: {
    googleApiKey: "test-google-api-key-from-env",
  },
}));

describe("TestProvider Controller", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let mockGoogleLLMService: jest.Mocked<GoogleLLMService>;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockRequest = {
      body: {},
    };
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    } as Partial<Response>;

    mockGoogleLLMService = {
      generateResponse: jest.fn(),
      getModelInfo: jest.fn().mockReturnValue({
        provider: "google",
        model: "gemini-2.5-flash",
      }),
    } as unknown as jest.Mocked<GoogleLLMService>;

    (GoogleLLMService as jest.Mock).mockImplementation(() => mockGoogleLLMService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Success Cases", () => {
    test("should return successful response with valid prompt", async () => {
      const mockPrompt = "Como ensinar subtração com zero?";
      const mockLLMResponse = "Use estratégias visuais como blocos de contagem...";

      mockRequest.body = { prompt: mockPrompt };
      mockGoogleLLMService.generateResponse.mockResolvedValue(mockLLMResponse);

      await testGoogleLLMController(mockRequest as Request, mockResponse as Response);

      expect(mockGoogleLLMService.generateResponse).toHaveBeenCalledWith(mockPrompt);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          model: {
            provider: "google",
            model: "gemini-2.5-flash",
          },
          prompt: mockPrompt,
          response: mockLLMResponse,
          latency_ms: expect.any(Number),
        })
      );
      expect(statusMock).not.toHaveBeenCalled();
    });

    test("should track latency correctly", async () => {
      mockRequest.body = { prompt: "Test prompt" };
      mockGoogleLLMService.generateResponse.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve("Response"), 100)));

      await testGoogleLLMController(mockRequest as Request, mockResponse as Response);

      const callArgs = jsonMock.mock.calls[0]?.[0];
      expect(callArgs?.latency_ms).toBeGreaterThanOrEqual(100);
    });

    test("should call getModelInfo", async () => {
      mockRequest.body = { prompt: "Test" };
      mockGoogleLLMService.generateResponse.mockResolvedValue("Response");

      await testGoogleLLMController(mockRequest as Request, mockResponse as Response);

      expect(mockGoogleLLMService.getModelInfo).toHaveBeenCalled();
    });
  });

  describe("Error Cases", () => {
    test("should return 400 when prompt is missing", async () => {
      mockRequest.body = {};

      await testGoogleLLMController(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "Prompt is required",
        example: {
          prompt: "Como ensinar subtração com zero?",
        },
      });
    });

    test("should return 400 when prompt is empty string", async () => {
      mockRequest.body = { prompt: "" };

      await testGoogleLLMController(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    test("should return 500 when LLM service throws error", async () => {
      const errorMessage = "API rate limit exceeded";
      mockRequest.body = { prompt: "Test prompt" };
      mockGoogleLLMService.generateResponse.mockRejectedValue(new Error(errorMessage));

      await testGoogleLLMController(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "Failed to generate response",
        details: errorMessage,
      });
    });

    test("should handle unknown errors", async () => {
      mockRequest.body = { prompt: "Test prompt" };
      mockGoogleLLMService.generateResponse.mockRejectedValue("Unknown error");

      await testGoogleLLMController(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: "Failed to generate response",
        details: "Unknown error",
      });
    });
  });

  describe("Edge Cases", () => {
    test("should handle very long prompts", async () => {
      const longPrompt = "A".repeat(5000);
      mockRequest.body = { prompt: longPrompt };
      mockGoogleLLMService.generateResponse.mockResolvedValue("Response");

      await testGoogleLLMController(mockRequest as Request, mockResponse as Response);

      expect(mockGoogleLLMService.generateResponse).toHaveBeenCalledWith(longPrompt);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          prompt: longPrompt,
        })
      );
    });

    test("should handle special characters in prompt", async () => {
      const specialPrompt = "Como ensinar: 2 + 2 = 4? (com símbolos: @#$%)";
      mockRequest.body = { prompt: specialPrompt };
      mockGoogleLLMService.generateResponse.mockResolvedValue("Response");

      await testGoogleLLMController(mockRequest as Request, mockResponse as Response);

      expect(mockGoogleLLMService.generateResponse).toHaveBeenCalledWith(specialPrompt);
    });
  });
});
