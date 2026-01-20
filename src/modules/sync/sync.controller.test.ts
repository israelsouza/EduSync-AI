import { Request, Response, NextFunction } from "express";
import { getVersionController, checkEligibilityController } from "./sync.controller";
import { cacheInvalidationService } from "../../services/CacheInvalidationService";

// Mock CacheInvalidationService
jest.mock("../../services/CacheInvalidationService", () => ({
  cacheInvalidationService: {
    getLatestVersion: jest.fn(),
    getVersionHistory: jest.fn(),
  },
}));

describe("Sync Controller", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {},
      query: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe("getVersionController", () => {
    it("should return latest version successfully", async () => {
      const mockVersion = "2026.01.19.100000";
      const mockHistory = [
        { version: "2026.01.19.100000", created_at: "2026-01-19T10:00:00Z", notes: "Latest" },
        { version: "2026.01.18.090000", created_at: "2026-01-18T09:00:00Z", notes: "Previous" },
      ];

      (cacheInvalidationService.getLatestVersion as jest.Mock).mockResolvedValue(mockVersion);
      (cacheInvalidationService.getVersionHistory as jest.Mock).mockResolvedValue(mockHistory);

      await getVersionController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(cacheInvalidationService.getLatestVersion).toHaveBeenCalled();
      expect(cacheInvalidationService.getVersionHistory).toHaveBeenCalledWith(5);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          currentVersion: mockVersion,
          timestamp: expect.any(String),
          history: mockHistory,
        },
      });
    });

    it("should handle errors from service", async () => {
      const error = new Error("Database connection failed");
      (cacheInvalidationService.getLatestVersion as jest.Mock).mockRejectedValue(error);

      await getVersionController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe("checkEligibilityController", () => {
    it("should allow sync when all conditions are met", async () => {
      mockRequest.body = {
        localVersion: "2026.01.18.100000",
        connectionType: "wifi",
        batteryLevel: 50,
        isCharging: false,
        freeStorageBytes: 100 * 1024 * 1024, // 100MB
      };

      (cacheInvalidationService.getLatestVersion as jest.Mock).mockResolvedValue("2026.01.19.100000");

      await checkEligibilityController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          canSync: true,
          blockingReasons: [],
          syncType: expect.any(String),
          versionStatus: expect.objectContaining({
            localVersion: "2026.01.18.100000",
            latestVersion: "2026.01.19.100000",
          }),
        }),
      });
    });

    it("should block sync when not on WiFi", async () => {
      mockRequest.body = {
        localVersion: "2026.01.18.100000",
        connectionType: "cellular",
        batteryLevel: 50,
        isCharging: false,
        freeStorageBytes: 100 * 1024 * 1024,
      };

      (cacheInvalidationService.getLatestVersion as jest.Mock).mockResolvedValue("2026.01.19.100000");

      await checkEligibilityController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          canSync: false,
          blockingReasons: expect.arrayContaining([expect.stringContaining("WiFi")]),
        }),
      });
    });

    it("should block sync when battery is low", async () => {
      mockRequest.body = {
        localVersion: "2026.01.18.100000",
        connectionType: "wifi",
        batteryLevel: 10,
        isCharging: false,
        freeStorageBytes: 100 * 1024 * 1024,
      };

      (cacheInvalidationService.getLatestVersion as jest.Mock).mockResolvedValue("2026.01.19.100000");

      await checkEligibilityController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          canSync: false,
          blockingReasons: expect.arrayContaining([expect.stringContaining("Battery")]),
        }),
      });
    });

    it("should block sync when storage is insufficient", async () => {
      mockRequest.body = {
        localVersion: "2026.01.18.100000",
        connectionType: "wifi",
        batteryLevel: 50,
        isCharging: false,
        freeStorageBytes: 10 * 1024 * 1024, // Only 10MB
      };

      (cacheInvalidationService.getLatestVersion as jest.Mock).mockResolvedValue("2026.01.19.100000");

      await checkEligibilityController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          canSync: false,
          blockingReasons: expect.arrayContaining([expect.stringContaining("storage")]),
        }),
      });
    });

    it("should allow sync when charging even with low battery", async () => {
      mockRequest.body = {
        localVersion: "2026.01.18.100000",
        connectionType: "wifi",
        batteryLevel: 10,
        isCharging: true, // Charging
        freeStorageBytes: 100 * 1024 * 1024,
      };

      (cacheInvalidationService.getLatestVersion as jest.Mock).mockResolvedValue("2026.01.19.100000");

      await checkEligibilityController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          canSync: true,
          blockingReasons: [],
        }),
      });
    });

    it("should handle errors from service", async () => {
      mockRequest.body = {
        localVersion: "2026.01.18.100000",
        connectionType: "wifi",
        batteryLevel: 50,
        isCharging: false,
        freeStorageBytes: 100 * 1024 * 1024,
      };

      const error = new Error("Service unavailable");
      (cacheInvalidationService.getLatestVersion as jest.Mock).mockRejectedValue(error);

      await checkEligibilityController(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
