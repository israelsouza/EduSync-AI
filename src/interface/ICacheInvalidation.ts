/**
 * Cache Invalidation Service Interface
 *
 * Manages cache invalidation logic for embeddings based on version tracking.
 * Determines when local data is stale and needs to be refreshed.
 *
 * Strategy: Version-based invalidation using semantic versioning from backend
 */

/**
 * Cache Status
 */
export interface CacheStatus {
  /** Is the cache valid and up-to-date? */
  isValid: boolean;

  /** Current local version */
  localVersion: string | null;

  /** Latest available version from backend */
  latestVersion: string | null;

  /** Reason for invalidation (if invalid) */
  invalidationReason?: "version_mismatch" | "expired" | "corrupted" | "missing";

  /** Last successful sync timestamp */
  lastSyncTimestamp: string | null;

  /** Days since last sync */
  daysSinceSync: number;

  /** Requires full re-download? */
  requiresFullSync: boolean;
}

/**
 * Cache Invalidation Strategy
 */
export interface ICacheInvalidationService {
  /**
   * Check if local cache is valid
   * @returns Cache status with validation details
   */
  checkCacheStatus(): Promise<CacheStatus>;

  /**
   * Fetch latest version from backend
   * @returns Latest available version string
   */
  getLatestVersion(): Promise<string>;

  /**
   * Compare local version with backend version
   * @returns True if local version is outdated
   */
  isOutdated(): Promise<boolean>;

  /**
   * Mark cache as invalid (force re-download)
   */
  invalidateCache(): Promise<void>;

  /**
   * Update local version metadata after successful sync
   * @param version - New version string
   */
  updateLocalVersion(version: string): Promise<void>;

  /**
   * Check if cache has expired based on time
   * @param maxAgeHours - Maximum age in hours (default: 720 = 30 days)
   */
  isCacheExpired(maxAgeHours?: number): Promise<boolean>;

  /**
   * Get embeddings that need to be updated (delta sync)
   * @param localVersion - Current local version
   * @param latestVersion - Latest backend version
   * @returns Array of embedding IDs to update
   */
  getDeltaUpdateList(localVersion: string, latestVersion: string): Promise<string[]>;

  /**
   * Validate cache integrity (check for corruption)
   * @returns True if cache is intact
   */
  validateIntegrity(): Promise<boolean>;

  /**
   * Clear all cached data
   */
  clearCache(): Promise<void>;
}

/**
 * Cache Invalidation Rules
 */
export const CACHE_RULES = {
  /** Maximum cache age in hours (default: 30 days) */
  MAX_CACHE_AGE_HOURS: 720,

  /** Force full sync if version difference > threshold */
  FULL_SYNC_VERSION_THRESHOLD: 10,

  /** Check for updates interval in hours (default: 24 hours) */
  UPDATE_CHECK_INTERVAL_HOURS: 24,

  /** Background sync when on WiFi only */
  SYNC_WIFI_ONLY: true,

  /** Minimum battery level for background sync (%) */
  MIN_BATTERY_LEVEL_PERCENT: 20,
};

/**
 * Invalidation Event Types
 */
export type InvalidationEvent =
  | { type: "cache_invalid"; reason: string; requiresFullSync: boolean }
  | { type: "cache_valid"; version: string; lastSyncTimestamp: string }
  | { type: "version_updated"; oldVersion: string; newVersion: string }
  | { type: "cache_cleared" }
  | { type: "integrity_failed"; corruptedCount: number };

/**
 * Implementation Notes:
 *
 * 1. Version Comparison:
 *    - Use semantic versioning (YYYY.MM.DD.HHMMSS)
 *    - Compare versions using compareVersions() utility
 *    - Store last sync version in sync_metadata table
 *
 * 2. Delta Sync Strategy:
 *    - If version difference is small, only update changed embeddings
 *    - If difference is large (> threshold), trigger full re-download
 *    - Track individual embedding versions for granular updates
 *
 * 3. Time-Based Expiration:
 *    - Check last_sync_timestamp from sync_metadata
 *    - Invalidate if exceeds MAX_CACHE_AGE_HOURS
 *    - Allow manual refresh regardless of expiration
 *
 * 4. Integrity Validation:
 *    - Verify embedding array lengths (should be 384 dimensions)
 *    - Check for missing required fields
 *    - Validate JSON structure of stored embeddings
 *    - Count expected vs actual embeddings
 *
 * 5. Network Conditions:
 *    - Only auto-sync on WiFi to save mobile data
 *    - Check battery level before starting background sync
 *    - Pause sync if battery drops below threshold
 */
