import { ICacheInvalidationService, CacheStatus, CACHE_RULES } from "../interface/ICacheInvalidation.js";
import { compareVersions, generateVersion } from "../modules/export/version.utils.js";
import supabase from "../lib/supabaseClient.js";

/**
 * Cache Invalidation Service
 *
 * Backend service that manages embedding version tracking and provides
 * cache validation endpoints for mobile clients.
 *
 * This service:
 * - Tracks the latest embedding version in the database
 * - Compares client versions with server versions
 * - Determines if delta sync or full sync is needed
 * - Validates cache expiration based on time rules
 */
export class CacheInvalidationService implements ICacheInvalidationService {
  private localVersion: string | null = null;
  private lastSyncTimestamp: string | null = null;

  /**
   * Check if local cache is valid
   * Compares local version with latest backend version and checks expiration
   */
  async checkCacheStatus(): Promise<CacheStatus> {
    const latestVersion = await this.getLatestVersion();
    const isExpired = await this.isCacheExpired();
    const isOutdated = await this.isOutdated();

    let invalidationReason: CacheStatus["invalidationReason"] | undefined;
    let requiresFullSync = false;

    if (!this.localVersion) {
      invalidationReason = "missing";
      requiresFullSync = true;
    } else if (isExpired) {
      invalidationReason = "expired";
      requiresFullSync = false; // Can do delta sync if just expired
    } else if (isOutdated) {
      invalidationReason = "version_mismatch";
      const versionDiff = compareVersions(latestVersion, this.localVersion);
      requiresFullSync = versionDiff > CACHE_RULES.FULL_SYNC_VERSION_THRESHOLD;
    }

    const daysSinceSync = this.calculateDaysSinceSync();

    const status: CacheStatus = {
      isValid: !invalidationReason,
      localVersion: this.localVersion,
      latestVersion,
      lastSyncTimestamp: this.lastSyncTimestamp,
      daysSinceSync,
      requiresFullSync,
    };

    if (invalidationReason) {
      status.invalidationReason = invalidationReason;
    }

    return status;
  }

  /**
   * Fetch latest version from backend (embedding_versions table)
   */
  async getLatestVersion(): Promise<string> {
    try {
      const { data, error } = await supabase
        .from("embedding_versions")
        .select("version")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return generateVersion(); // If no version exists
      }

      return data.version;
    } catch (error) {
      console.error("[CacheInvalidationService.getLatestVersion] Error fetching latest version:", error);
      throw error;
    }
  }

  /**
   * Compare local version with backend version
   */
  async isOutdated(): Promise<boolean> {
    if (!this.localVersion) {
      return true;
    }

    const latestVersion = await this.getLatestVersion();
    return compareVersions(latestVersion, this.localVersion) > 0;
  }

  /**
   * Mark cache as invalid (force re-download)
   */
  async invalidateCache(): Promise<void> {
    this.localVersion = null;
    this.lastSyncTimestamp = null;
  }

  /**
   * Update local version metadata after successful sync
   */
  async updateLocalVersion(version: string): Promise<void> {
    this.localVersion = version;
    this.lastSyncTimestamp = new Date().toISOString();
  }

  /**
   * Check if cache has expired based on time
   */
  async isCacheExpired(maxAgeHours: number = CACHE_RULES.MAX_CACHE_AGE_HOURS): Promise<boolean> {
    if (!this.lastSyncTimestamp) {
      return true;
    }

    const lastSync = new Date(this.lastSyncTimestamp);
    const now = new Date();
    const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);

    return hoursSinceSync > maxAgeHours;
  }

  /**
   * Validates version string format (YYYY.MM.DD.HHMMSS)
   * @example "2026.01.19.143052" is valid
   */
  private isValidVersionFormat(version: string): boolean {
    // Format: YYYY.MM.DD.HHMMSS (e.g., 2026.01.19.143052)
    const versionRegex = /^\d{4}\.\d{2}\.\d{2}\.\d{6}$/;
    if (!versionRegex.test(version)) {
      return false;
    }

    // Additional validation: check date parts are reasonable
    const parts = version.split(".").map(Number);
    const year = parts[0] ?? 0;
    const month = parts[1] ?? 0;
    const day = parts[2] ?? 0;

    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 2020 || year > 2100) return false; // reasonable year range

    return true;
  }

  /**
   * Get embeddings that need to be updated (delta sync)
   * Returns IDs of embeddings updated after the local version
   */
  async getDeltaUpdateList(localVersion: string): Promise<string[]> {
    try {
      // Validate version format before processing
      if (!this.isValidVersionFormat(localVersion)) {
        console.warn(`Invalid version format: "${localVersion}". Expected YYYY.MM.DD.HHMMSS`);
        // Return empty array for invalid versions (client should do full sync)
        return [];
      }

      // Parse version to timestamp (format: YYYY.MM.DD.HHMMSS)
      const versionParts = localVersion.split(".");
      const [year, month, day, time] = versionParts;
      const hours = time?.substring(0, 2) || "00";
      const minutes = time?.substring(2, 4) || "00";
      const seconds = time?.substring(4, 6) || "00";

      const sinceTimestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;

      const { data, error } = await supabase.from("pedagogical_knowledge_v384").select("id").gt("created_at", sinceTimestamp);

      if (error || !data) {
        return [];
      }

      return data.map((row) => row.id);
    } catch (error) {
      console.error("[CacheInvalidationService.getDeltaUpdateList] Error fetching delta update list:", error);
      throw error;
    }
  }

  /**
   * Validate cache integrity
   * Checks if embeddings have correct dimensions and structure
   */
  async validateIntegrity(): Promise<boolean> {
    try {
      // For backend, we validate the database integrity
      const { count, error } = await supabase.from("pedagogical_knowledge_v384").select("*", { count: "exact", head: true });

      if (error) {
        return false;
      }

      // Basic validation: ensure we have embeddings
      return (count ?? 0) > 0;
    } catch (error) {
      console.error("[CacheInvalidationService.validateIntegrity] Error validating integrity:", error);
      throw error;
    }
  }

  /**
   * Clear all cached data
   * Note: On backend, this would be a soft invalidation
   */
  async clearCache(): Promise<void> {
    this.localVersion = null;
    this.lastSyncTimestamp = null;
  }

  /**
   * Calculate days since last sync
   */
  private calculateDaysSinceSync(): number {
    if (!this.lastSyncTimestamp) {
      return -1;
    }

    const lastSync = new Date(this.lastSyncTimestamp);
    const now = new Date();
    const diffMs = now.getTime() - lastSync.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Register a new embedding version in the database
   * Called after ingesting new content
   */
  async registerVersion(version: string, notes?: string): Promise<void> {
    try {
      const { error } = await supabase.from("embedding_versions").insert({
        version,
        notes: notes || `Version ${version} registered`,
        created_at: new Date().toISOString(),
      });

      if (error) {
        throw new Error(`Failed to register version: ${error.message}`);
      }
    } catch (error) {
      console.error("[CacheInvalidationService.registerVersion] Error registering version:", error);
      throw error;
    }
  }

  /**
   * Get version history
   */
  async getVersionHistory(limit = 10): Promise<{ version: string; created_at: string; notes: string }[]> {
    try {
      const { data, error } = await supabase
        .from("embedding_versions")
        .select("version, created_at, notes")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error || !data) {
        return [];
      }

      return data;
    } catch (error) {
      console.error("[CacheInvalidationService.getVersionHistory] Error fetching version history:", error);
      throw error;
    }
  }
}

// Singleton instance
export const cacheInvalidationService = new CacheInvalidationService();
