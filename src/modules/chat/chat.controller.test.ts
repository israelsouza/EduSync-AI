import { Request, Response, NextFunction } from "express";
import { chatController, contextService } from "./chat.controller";
import VectorFactory from "../../lib/vectorFactory";
import { createLLMService } from "../../lib/llmFactory";
import { SearchResult } from "../../interface/IVectorService";
import { IVectorService } from "../../interface/IVectorService";
import { ILLMService } from "../../interface/ILLMService";

// Mock the factory functions
jest.mock("../../lib/supabaseClient", () => ({
  default: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  },
}));

jest.mock("../../lib/vectorFactory");
jest.mock("../../lib/llmFactory");

const mockVectorFactoryCreate = VectorFactory.create as jest.MockedFunction<typeof VectorFactory.create>;
const mockCreateLLMService = createLLMService as jest.MockedFunction<typeof createLLMService>;

describe("POST /chat - Integration Tests", () => {
  let mockVectorService: jest.Mocked<IVectorService>;
  let mockLLMService: jest.Mocked<ILLMService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock ContextService methods
    jest.spyOn(contextService, "createSession").mockReturnValue("test-session-id");
    jest.spyOn(contextService, "addMessage").mockImplementation(() => undefined);
    jest.spyOn(contextService, "getFormattedContext").mockReturnValue("");
    jest.spyOn(contextService, "sessionExists").mockReturnValue(false);
    jest.spyOn(contextService, "stopCleanupInterval").mockImplementation(() => undefined);

    // Setup mock vector service
    mockVectorService = {
      search: jest.fn(),
    } as jest.Mocked<IVectorService>;

    // Setup mock LLM service
    mockLLMService = {
      generateResponse: jest.fn(),
      getModelInfo: jest.fn().mockReturnValue({
        provider: "google",
        model: "gemini-2.5-flash",
      }),
    } as jest.Mocked<ILLMService>;

    mockVectorFactoryCreate.mockReturnValue(mockVectorService);
    mockCreateLLMService.mockReturnValue(mockLLMService);

    // Setup Express mocks
    mockReq = {
      body: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();
  });

  afterAll(() => {
    // Stop the cleanup interval to prevent worker process hanging
    contextService.stopCleanupInterval();
  });

  describe("Success Cases", () => {
    test("should return RAG response for valid query", async () => {
      const mockChunks: SearchResult[] = [
        {
          content: "Use visual strategies for teaching subtraction.",
          metadata: { source: "manual.pdf", page: 10 },
          score: 0.85,
        },
      ];

      mockVectorService.search.mockResolvedValue(mockChunks);
      mockLLMService.generateResponse.mockResolvedValue("Para ensinar subtração com zero, use exemplos visuais como objetos físicos.");

      mockReq.body = {
        query: "Como ensinar subtração com zero?",
      };

      await chatController(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          answer: "Para ensinar subtração com zero, use exemplos visuais como objetos físicos.",
          sessionId: expect.any(String),
          sources: expect.arrayContaining([
            expect.objectContaining({
              content: "Use visual strategies for teaching subtraction.",
              metadata: { source: "manual.pdf", page: 10 },
              score: 0.85,
            }),
          ]),
          confidence: 0.85,
          isLowConfidence: false,
          model: {
            provider: "google",
            model: "gemini-2.5-flash",
          },
        })
      );
    });

    test("should handle low confidence responses", async () => {
      const mockChunks: SearchResult[] = [
        {
          content: "Vague content",
          metadata: {},
          score: 0.2,
        },
      ];

      mockVectorService.search.mockResolvedValue(mockChunks);

      mockReq.body = {
        query: "Very obscure topic",
      };

      await chatController(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          isLowConfidence: true,
          answer: expect.stringContaining("couldn't find specific guidance"),
        })
      );
      expect(mockLLMService.generateResponse).not.toHaveBeenCalled();
    });

    test("should trim whitespace from query", async () => {
      mockVectorService.search.mockResolvedValue([
        {
          content: "Content",
          metadata: {},
          score: 0.8,
        },
      ]);
      mockLLMService.generateResponse.mockResolvedValue("Answer");

      mockReq.body = {
        query: "  How to teach?  ",
      };

      await chatController(mockReq as Request, mockRes as Response, mockNext);

      // Expect trimmed query + conversation context (first message includes itself)
      expect(mockVectorService.search).toHaveBeenCalledWith(expect.stringContaining("How to teach?"), 3);
    });
  });

  describe("Validation Errors", () => {
    test("should call next with error if query is missing", async () => {
      mockReq.body = {};

      await chatController(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Query is required"),
          statusCode: 400,
        })
      );
    });

    test("should call next with error if query is empty string", async () => {
      mockReq.body = { query: "" };

      await chatController(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("Query is required"),
        })
      );
    });

    test("should call next with error if query exceeds 500 characters", async () => {
      mockReq.body = { query: "a".repeat(501) };

      await chatController(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("must not exceed 500 characters"),
        })
      );
    });
  });

  describe("Error Handling", () => {
    test("should handle vector service errors", async () => {
      mockVectorService.search.mockRejectedValue(new Error("Database connection failed"));

      mockReq.body = { query: "Test query" };

      await chatController(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    test("should handle LLM service errors", async () => {
      mockVectorService.search.mockResolvedValue([
        {
          content: "Content",
          metadata: {},
          score: 0.8,
        },
      ]);
      mockLLMService.generateResponse.mockRejectedValue(new Error("API rate limit exceeded"));

      mockReq.body = { query: "Test query" };

      await chatController(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("End-to-End RAG Pipeline", () => {
    test("should execute full RAG pipeline with multiple chunks", async () => {
      const mockChunks: SearchResult[] = [
        {
          content: "Strategy 1: Use visual aids",
          metadata: { source: "manual_1.pdf", page: 10 },
          score: 0.9,
        },
        {
          content: "Strategy 2: Group work",
          metadata: { source: "manual_2.pdf", page: 25 },
          score: 0.8,
        },
        {
          content: "Strategy 3: Peer tutoring",
          metadata: { source: "manual_1.pdf", page: 45 },
          score: 0.75,
        },
      ];

      mockVectorService.search.mockResolvedValue(mockChunks);
      mockLLMService.generateResponse.mockResolvedValue("Combine visual aids with group work and peer tutoring for best results.");

      mockReq.body = {
        query: "What are the best strategies for multi-grade classrooms?",
      };

      await chatController(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockVectorService.search).toHaveBeenCalledWith(
        expect.stringContaining("What are the best strategies for multi-grade classrooms?"),
        3
      );
      expect(mockLLMService.generateResponse).toHaveBeenCalled();
    });

    test("should format context correctly for LLM", async () => {
      const mockChunks: SearchResult[] = [
        {
          content: "Teaching strategy content",
          metadata: { source: "guide.pdf", page: 5, chapter: "Introduction" },
          score: 0.85,
        },
      ];

      mockVectorService.search.mockResolvedValue(mockChunks);
      mockLLMService.generateResponse.mockResolvedValue("Response");

      mockReq.body = { query: "Test query" };

      await chatController(mockReq as Request, mockRes as Response, mockNext);

      const llmPrompt = mockLLMService.generateResponse.mock.calls[0]?.[0];
      expect(llmPrompt).toContain("[Source 1]");
      expect(llmPrompt).toContain("guide.pdf");
      expect(llmPrompt).toContain("Page 5");
      expect(llmPrompt).toContain("Teaching strategy content");
      expect(llmPrompt).toContain("Test query");
    });
  });
});
