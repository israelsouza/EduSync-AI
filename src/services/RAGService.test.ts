import { RAGService, RAGConfig } from "./RAGService";
import { IVectorService, SearchResult } from "../interface/IVectorService";
import { ILLMService } from "../interface/ILLMService";
import { LOW_CONFIDENCE_MESSAGE } from "../prompts/systemPrompt";

describe("RAGService", () => {
  let ragService: RAGService;
  let mockVectorService: jest.Mocked<IVectorService>;
  let mockLLMService: jest.Mocked<ILLMService>;

  const mockModelInfo = { provider: "google", model: "gemini-2.5-flash" };

  const createMockChunks = (count: number, baseScore = 0.8): SearchResult[] => {
    return Array.from({ length: count }, (_, i) => ({
      content: `Chunk ${i + 1} content about teaching strategies.`,
      metadata: {
        source: `manual_${i + 1}.pdf`,
        page: i + 10,
        chapter: `Chapter ${i + 1}`,
      },
      score: baseScore - i * 0.1,
    }));
  };

  beforeEach(() => {
    mockVectorService = {
      search: jest.fn(),
    };

    mockLLMService = {
      generateResponse: jest.fn(),
      getModelInfo: jest.fn().mockReturnValue(mockModelInfo),
    };

    ragService = new RAGService(mockVectorService, mockLLMService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    test("should initialize with default config", () => {
      const config = ragService.getConfig();

      expect(config.confidenceThreshold).toBe(0.5);
      expect(config.topK).toBe(3);
    });

    test("should accept custom config", () => {
      const customConfig: Partial<RAGConfig> = {
        confidenceThreshold: 0.7,
        topK: 5,
      };

      const customService = new RAGService(mockVectorService, mockLLMService, customConfig);
      const config = customService.getConfig();

      expect(config.confidenceThreshold).toBe(0.7);
      expect(config.topK).toBe(5);
    });

    test("should merge partial config with defaults", () => {
      const partialConfig: Partial<RAGConfig> = {
        confidenceThreshold: 0.6,
      };

      const customService = new RAGService(mockVectorService, mockLLMService, partialConfig);
      const config = customService.getConfig();

      expect(config.confidenceThreshold).toBe(0.6);
      expect(config.topK).toBe(3);
    });
  });

  describe("generateResponse - Success Cases", () => {
    test("should generate response with valid context", async () => {
      const mockChunks = createMockChunks(3);
      const mockAnswer = "Use visual strategies for teaching subtraction.";

      mockVectorService.search.mockResolvedValue(mockChunks);
      mockLLMService.generateResponse.mockResolvedValue(mockAnswer);

      const response = await ragService.generateResponse("Como ensinar subtração?");

      expect(mockVectorService.search).toHaveBeenCalledWith("Como ensinar subtração?", 3);
      expect(mockLLMService.generateResponse).toHaveBeenCalled();
      expect(response.answer).toBe(mockAnswer);
      expect(response.sources).toEqual(mockChunks);
      expect(response.isLowConfidence).toBe(false);
      expect(response.model).toEqual(mockModelInfo);
    });

    test("should calculate confidence correctly", async () => {
      const mockChunks = createMockChunks(3, 0.9);
      mockVectorService.search.mockResolvedValue(mockChunks);
      mockLLMService.generateResponse.mockResolvedValue("Answer");

      const response = await ragService.generateResponse("test query");

      expect(response.confidence).toBeCloseTo(0.8, 1);
    });

    test("should format context with source information", async () => {
      const mockChunks = createMockChunks(2);
      mockVectorService.search.mockResolvedValue(mockChunks);
      mockLLMService.generateResponse.mockResolvedValue("Answer");

      await ragService.generateResponse("test query");

      const promptArg = mockLLMService.generateResponse.mock.calls[0]?.[0];
      expect(promptArg).toContain("[Source 1]");
      expect(promptArg).toContain("manual_1.pdf");
      expect(promptArg).toContain("Page 10");
      expect(promptArg).toContain("Chunk 1 content");
    });

    test("should replace placeholders in system prompt", async () => {
      const mockChunks = createMockChunks(1);
      mockVectorService.search.mockResolvedValue(mockChunks);
      mockLLMService.generateResponse.mockResolvedValue("Answer");

      await ragService.generateResponse("How to teach fractions?");

      const promptArg = mockLLMService.generateResponse.mock.calls[0]?.[0];
      expect(promptArg).not.toContain("{context}");
      expect(promptArg).not.toContain("{query}");
    });
  });

  describe("generateResponse - Low Confidence Cases", () => {
    test("should return low confidence message when score below threshold", async () => {
      const lowScoreChunks = createMockChunks(3, 0.3);
      mockVectorService.search.mockResolvedValue(lowScoreChunks);

      const response = await ragService.generateResponse("Very obscure topic");

      expect(response.answer).toBe(LOW_CONFIDENCE_MESSAGE);
      expect(response.isLowConfidence).toBe(true);
      expect(mockLLMService.generateResponse).not.toHaveBeenCalled();
    });

    test("should return low confidence message when no chunks found", async () => {
      mockVectorService.search.mockResolvedValue([]);

      const response = await ragService.generateResponse("Unknown topic");

      expect(response.answer).toBe(LOW_CONFIDENCE_MESSAGE);
      expect(response.isLowConfidence).toBe(true);
      expect(response.confidence).toBe(0);
    });

    test("should include sources even on low confidence", async () => {
      const lowScoreChunks = createMockChunks(2, 0.2);
      mockVectorService.search.mockResolvedValue(lowScoreChunks);

      const response = await ragService.generateResponse("test");

      expect(response.sources).toEqual(lowScoreChunks);
    });

    test("should use custom confidence threshold", async () => {
      const customService = new RAGService(mockVectorService, mockLLMService, {
        confidenceThreshold: 0.9,
      });

      const mockChunks = createMockChunks(3, 0.85);
      mockVectorService.search.mockResolvedValue(mockChunks);

      const response = await customService.generateResponse("test");

      expect(response.isLowConfidence).toBe(true);
    });
  });

  describe("generateResponse - Error Handling", () => {
    test("should propagate vector service errors", async () => {
      mockVectorService.search.mockRejectedValue(new Error("Database connection failed"));

      await expect(ragService.generateResponse("test")).rejects.toThrow("Database connection failed");
    });

    test("should propagate LLM service errors", async () => {
      const mockChunks = createMockChunks(3);
      mockVectorService.search.mockResolvedValue(mockChunks);
      mockLLMService.generateResponse.mockRejectedValue(new Error("API rate limit exceeded"));

      await expect(ragService.generateResponse("test")).rejects.toThrow("API rate limit exceeded");
    });
  });

  describe("generateResponse - Edge Cases", () => {
    test("should handle chunks without scores", async () => {
      const chunksWithoutScores: SearchResult[] = [
        { content: "Content 1", metadata: {} },
        { content: "Content 2", metadata: {} },
      ];
      mockVectorService.search.mockResolvedValue(chunksWithoutScores);

      const response = await ragService.generateResponse("test");

      expect(response.confidence).toBe(0);
      expect(response.isLowConfidence).toBe(true);
    });

    test("should handle chunks with partial metadata", async () => {
      const chunksWithPartialMetadata: SearchResult[] = [{ content: "Content", metadata: { source: "only_source.pdf" }, score: 0.8 }];
      mockVectorService.search.mockResolvedValue(chunksWithPartialMetadata);
      mockLLMService.generateResponse.mockResolvedValue("Answer");

      await ragService.generateResponse("test");

      const promptArg = mockLLMService.generateResponse.mock.calls[0]?.[0];
      expect(promptArg).toContain("only_source.pdf");
    });

    test("should handle empty metadata", async () => {
      const chunksWithEmptyMetadata: SearchResult[] = [{ content: "Content", metadata: {}, score: 0.8 }];
      mockVectorService.search.mockResolvedValue(chunksWithEmptyMetadata);
      mockLLMService.generateResponse.mockResolvedValue("Answer");

      await ragService.generateResponse("test");

      const promptArg = mockLLMService.generateResponse.mock.calls[0]?.[0];
      expect(promptArg).toContain("Official Pedagogical Manual");
    });

    test("should handle very long queries", async () => {
      const longQuery = "Como ensinar ".repeat(100) + "matemática?";
      const mockChunks = createMockChunks(3);
      mockVectorService.search.mockResolvedValue(mockChunks);
      mockLLMService.generateResponse.mockResolvedValue("Answer");

      const response = await ragService.generateResponse(longQuery);

      expect(mockVectorService.search).toHaveBeenCalledWith(longQuery, 3);
      expect(response.isLowConfidence).toBe(false);
    });
  });

  describe("getConfig", () => {
    test("should return a copy of config", () => {
      const config1 = ragService.getConfig();
      const config2 = ragService.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });
});
