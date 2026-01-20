import { CacheInvalidationService } from "./CacheInvalidationService";
import supabase from "../lib/supabaseClient";
import { compareVersions, generateVersion } from "../modules/export/version.utils";

jest.mock("../lib/supabaseClient", () => ({
  __esModule: true,
  default: {
    from: jest.fn(),
  },
}));

jest.mock("../modules/export/version.utils", () => ({
  compareVersions: jest.fn(),
  generateVersion: jest.fn().mockReturnValue("2026.01.19.100000"),
}));

describe("CacheInvalidationService", () => {
  let service: CacheInvalidationService;
  const mockCompareVersions = jest.mocked(compareVersions);
  const mockGenerateVersion = jest.mocked(generateVersion);

  beforeEach(() => {
    service = new CacheInvalidationService();
    jest.clearAllMocks();
  });

  describe("getLatestVersion", () => {
    it("should return latest version when found", async () => {
      const mockVersion = {
        version: "2026.01.19.100000",
      };

      const mockSupabaseChain = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockVersion, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockSupabaseChain);

      const result = await service.getLatestVersion();

      expect(supabase.from).toHaveBeenCalledWith("embedding_versions");
      expect(mockSupabaseChain.select).toHaveBeenCalledWith("version");
      expect(mockSupabaseChain.order).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(mockSupabaseChain.limit).toHaveBeenCalledWith(1);
      expect(result).toBe("2026.01.19.100000");
    });

    it("should generate version when no versions exist", async () => {
      const mockSupabaseChain = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockSupabaseChain);

      const result = await service.getLatestVersion();

      expect(mockGenerateVersion).toHaveBeenCalled();
      expect(result).toBe("2026.01.19.100000");
    });

    it("should generate version on database error", async () => {
      const mockSupabaseChain = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Database connection failed" },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockSupabaseChain);

      const result = await service.getLatestVersion();

      expect(mockGenerateVersion).toHaveBeenCalled();
      expect(result).toBe("2026.01.19.100000");
    });
  });

  describe("checkCacheStatus", () => {
    it("should return invalid status when local version is missing", async () => {
      const mockSupabaseChain = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { version: "2026.01.19.100000" },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockSupabaseChain);

      const result = await service.checkCacheStatus();

      expect(result.isValid).toBe(false);
      expect(result.invalidationReason).toBe("missing");
      expect(result.requiresFullSync).toBe(true);
    });

    it("should return valid status when cache is current", async () => {
      const mockSupabaseChain = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { version: "2026.01.19.100000" },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockSupabaseChain);
      mockCompareVersions.mockReturnValue(0);

      await service.updateLocalVersion("2026.01.19.100000");
      const result = await service.checkCacheStatus();

      expect(result.isValid).toBe(true);
      expect(result.localVersion).toBe("2026.01.19.100000");
    });

    it("should return invalid status when version is outdated", async () => {
      const mockSupabaseChain = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { version: "2026.01.19.120000" },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockSupabaseChain);
      mockCompareVersions.mockReturnValue(1);

      await service.updateLocalVersion("2026.01.19.100000");
      const result = await service.checkCacheStatus();

      expect(result.isValid).toBe(false);
      expect(result.invalidationReason).toBe("version_mismatch");
    });
  });

  describe("isOutdated", () => {
    it("should return true when local version is missing", async () => {
      const result = await service.isOutdated();

      expect(result).toBe(true);
    });

    it("should return false when versions are equal", async () => {
      const mockSupabaseChain = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { version: "2026.01.19.100000" },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockSupabaseChain);
      mockCompareVersions.mockReturnValue(0);

      await service.updateLocalVersion("2026.01.19.100000");
      const result = await service.isOutdated();

      expect(result).toBe(false);
    });

    it("should return true when local version is older", async () => {
      const mockSupabaseChain = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { version: "2026.01.19.120000" },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockSupabaseChain);
      mockCompareVersions.mockReturnValue(1);

      await service.updateLocalVersion("2026.01.19.100000");
      const result = await service.isOutdated();

      expect(result).toBe(true);
    });
  });

  describe("getDeltaUpdateList", () => {
    it("should return list of new document IDs", async () => {
      const mockDocuments = [{ id: "doc-123" }, { id: "doc-124" }, { id: "doc-125" }];

      const mockSupabaseChain = {
        select: jest.fn().mockReturnThis(),
        gt: jest.fn().mockResolvedValue({ data: mockDocuments, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockSupabaseChain);

      const result = await service.getDeltaUpdateList("2026.01.18.100000");

      expect(supabase.from).toHaveBeenCalledWith("pedagogical_knowledge_v384");
      expect(mockSupabaseChain.select).toHaveBeenCalledWith("id");
      expect(mockSupabaseChain.gt).toHaveBeenCalledWith("created_at", "2026-01-18T10:00:00Z");
      expect(result).toEqual(["doc-123", "doc-124", "doc-125"]);
    });

    it("should return empty array when no new documents", async () => {
      const mockSupabaseChain = {
        select: jest.fn().mockReturnThis(),
        gt: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockSupabaseChain);

      const result = await service.getDeltaUpdateList("2026.01.19.100000");

      expect(result).toEqual([]);
    });

    it("should return empty array on invalid version format", async () => {
      const result = await service.getDeltaUpdateList("invalid-version");

      expect(result).toEqual([]);
    });

    it("should return empty array on database error", async () => {
      const mockSupabaseChain = {
        select: jest.fn().mockReturnThis(),
        gt: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Query timeout" },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockSupabaseChain);

      const result = await service.getDeltaUpdateList("2026.01.18.100000");

      expect(result).toEqual([]);
    });
  });

  describe("invalidateCache", () => {
    it("should clear local version and timestamp", async () => {
      await service.updateLocalVersion("2026.01.19.100000");
      await service.invalidateCache();

      // After invalidation, should return true for isOutdated
      const result = await service.isOutdated();
      expect(result).toBe(true);
    });
  });

  describe("updateLocalVersion", () => {
    it("should update local version and timestamp", async () => {
      await service.updateLocalVersion("2026.01.19.100000");

      const mockSupabaseChain = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { version: "2026.01.19.100000" },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockSupabaseChain);
      mockCompareVersions.mockReturnValue(0);

      const result = await service.checkCacheStatus();
      expect(result.localVersion).toBe("2026.01.19.100000");
      expect(result.lastSyncTimestamp).toBeDefined();
    });
  });

  describe("isCacheExpired", () => {
    it("should return true when no timestamp exists", async () => {
      const result = await service.isCacheExpired();

      expect(result).toBe(true);
    });

    it("should return false when cache is fresh", async () => {
      await service.updateLocalVersion("2026.01.19.100000");

      const result = await service.isCacheExpired();

      expect(result).toBe(false);
    });

    it("should respect custom max age parameter", async () => {
      await service.updateLocalVersion("2026.01.19.100000");

      // Wait 1ms to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 1));

      const result = await service.isCacheExpired(0);

      expect(result).toBe(true);
    });
  });
});
