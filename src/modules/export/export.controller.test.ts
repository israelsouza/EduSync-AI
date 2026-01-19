import { Request, Response, NextFunction } from "express";
import { exportEmbeddingsController } from "./export.controller";
import supabase from "../../lib/supabaseClient";
import { AppError } from "../../shared/AppError";

// Mock Supabase client
jest.mock("../../lib/supabaseClient", () => ({
  __esModule: true,
  default: {
    from: jest.fn(),
  },
}));

describe("Export Controller", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      query: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe("exportEmbeddingsController", () => {
    it("should export embeddings successfully with default parameters", async () => {
      const mockEmbeddings = [
        {
          id: "test-id-1",
          content: "Test content 1",
          embedding: [0.1, 0.2, 0.3],
          metadata: { source: "test.pdf", page: 1 },
        },
        {
          id: "test-id-2",
          content: "Test content 2",
          embedding: [0.4, 0.5, 0.6],
          metadata: { source: "test.pdf", page: 2 },
        },
      ];

      const mockSupabaseChain = {
        select: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockEmbeddings, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockSupabaseChain);

      // Mock count query
      const mockCountChain = {
        select: jest.fn().mockResolvedValue({ count: 100, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValueOnce(mockSupabaseChain).mockReturnValueOnce(mockCountChain);

      await exportEmbeddingsController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            count: 2,
            embeddings: expect.arrayContaining([
              expect.objectContaining({
                id: "test-id-1",
                content: "Test content 1",
              }),
            ]),
            model: expect.objectContaining({
              name: "Xenova/all-MiniLM-L6-v2",
              dimensions: 384,
            }),
            metadata: expect.objectContaining({
              compressionEnabled: true,
            }),
          }),
        })
      );
    });

    it("should validate limit parameter", async () => {
      mockRequest.query = { limit: "10000" }; // Exceeds max of 5000

      await exportEmbeddingsController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect((mockNext as jest.Mock).mock.calls[0][0].message).toBe("Limit must be between 1 and 5000");
    });

    it("should validate offset parameter", async () => {
      mockRequest.query = { offset: "-1" }; // Negative offset

      await exportEmbeddingsController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect((mockNext as jest.Mock).mock.calls[0][0].message).toBe("Offset must be a non-negative number");
    });

    it("should handle Supabase errors", async () => {
      const mockSupabaseChain = {
        select: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: { message: "Database error" } }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockSupabaseChain);

      await exportEmbeddingsController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect((mockNext as jest.Mock).mock.calls[0][0].message).toContain("Failed to fetch embeddings");
    });

    it("should handle empty results", async () => {
      const mockSupabaseChain = {
        select: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockSupabaseChain);

      await exportEmbeddingsController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      expect((mockNext as jest.Mock).mock.calls[0][0].message).toBe("No embeddings found in database");
    });

    it("should set pagination headers", async () => {
      mockRequest.query = { limit: "50", offset: "100" };

      const mockEmbeddings = [
        {
          id: "test-id-1",
          content: "Test content",
          embedding: [0.1, 0.2],
          metadata: {},
        },
      ];

      const mockSupabaseChain = {
        select: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockEmbeddings, error: null }),
      };

      const mockCountChain = {
        select: jest.fn().mockResolvedValue({ count: 500, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValueOnce(mockSupabaseChain).mockReturnValueOnce(mockCountChain);

      await exportEmbeddingsController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith("X-Total-Count", "500");
      expect(mockResponse.setHeader).toHaveBeenCalledWith("X-Offset", "100");
      expect(mockResponse.setHeader).toHaveBeenCalledWith("X-Limit", "50");
    });
  });
});
