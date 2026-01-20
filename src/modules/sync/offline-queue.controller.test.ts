import { Request, Response, NextFunction } from "express";
import { syncOfflineQueriesController, getQueryStatsController } from "./offline-queue.controller";
import supabase from "../../lib/supabaseClient";

jest.mock("../../lib/supabaseClient", () => ({
  __esModule: true,
  default: {
    from: jest.fn(),
  },
}));

describe("Offline Queue Controller", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe("syncOfflineQueriesController", () => {
    const validPayload = {
      queries: [
        {
          id: "query-1",
          query: "How to teach subtraction?",
          response: "Use visual aids",
          timestamp: Date.now(),
          metadata: {
            responseSource: "local" as const,
            deviceId: "device-abc123",
            appVersion: "1.0.0",
          },
        },
      ],
      consentGiven: true,
    };

    it("should sync offline queries successfully with consent", async () => {
      mockRequest.body = validPayload;

      const mockSupabaseChain = {
        insert: jest.fn().mockResolvedValue({ error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockSupabaseChain);

      await syncOfflineQueriesController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(supabase.from).toHaveBeenCalledWith("offline_queries");
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it("should reject queries without user consent", async () => {
      mockRequest.body = {
        ...validPayload,
        consentGiven: false,
      };

      await syncOfflineQueriesController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("consent"),
        })
      );

      expect(supabase.from).not.toHaveBeenCalled();
    });

    it("should validate queries is an array", async () => {
      mockRequest.body = {
        queries: "not-an-array",
        consentGiven: true,
      };

      await syncOfflineQueriesController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("array"),
        })
      );
    });

    it("should reject empty queries array", async () => {
      mockRequest.body = {
        queries: [],
        consentGiven: true,
      };

      await syncOfflineQueriesController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("empty"),
        })
      );
    });
  });

  describe("getQueryStatsController", () => {
    it("should return query statistics successfully", async () => {
      const mockCountChain = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockResolvedValue({ count: 50, error: null }),
      };

      const mockDataChain = {
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({
          data: [{ responseSource: "local" }, { responseSource: "cache" }],
          error: null,
        }),
      };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ count: 150, error: null }) })
        .mockReturnValueOnce(mockDataChain)
        .mockReturnValueOnce(mockCountChain);

      await getQueryStatsController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(supabase.from).toHaveBeenCalledWith("offline_queries");
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          totalQueries: expect.any(Number),
        }),
      });
    });

    it("should handle database errors", async () => {
      (supabase.from as jest.Mock).mockImplementation(() => {
        throw new Error("Connection timeout");
      });

      await getQueryStatsController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
