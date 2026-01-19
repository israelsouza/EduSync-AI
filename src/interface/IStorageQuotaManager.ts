/**
 * Storage Quota Manager Interface
 *
 * Manages local storage quotas, monitors usage, and implements cleanup strategies
 * to prevent the app from consuming excessive device storage.
 */

/**
 * Storage Usage Statistics
 */
export interface StorageUsage {
  /** Total embeddings stored locally */
  totalEmbeddings: number;

  /** Storage size in bytes */
  usedBytes: number;

  /** Storage size in human-readable format (e.g., "45.3 MB") */
  usedFormatted: string;

  /** Available storage on device (bytes) */
  availableBytes: number;

  /** Percentage of quota used (0-100) */
  quotaPercentage: number;

  /** Is quota exceeded? */
  isQuotaExceeded: boolean;

  /** Oldest embedding timestamp */
  oldestEmbeddingDate: string | null;

  /** Newest embedding timestamp */
  newestEmbeddingDate: string | null;
}

/**
 * Cleanup Strategy
 */
export interface CleanupStrategy {
  /** Strategy name */
  name: "lru" | "oldest_first" | "low_usage" | "partial";

  /** Description */
  description: string;

  /** Priority (1 = highest) */
  priority: number;

  /** Target percentage to clean (e.g., 0.2 = remove 20%) */
  targetPercentage: number;
}

/**
 * Cleanup Result
 */
export interface CleanupResult {
  /** Number of embeddings removed */
  embeddingsRemoved: number;

  /** Bytes freed */
  bytesFreed: number;

  /** Strategy used */
  strategy: string;

  /** Duration in milliseconds */
  durationMs: number;

  /** Success status */
  success: boolean;

  /** Error message (if failed) */
  error?: string;
}

/**
 * Storage Quota Manager Interface
 */
export interface IStorageQuotaManager {
  /**
   * Get current storage usage statistics
   */
  getUsage(): Promise<StorageUsage>;

  /**
   * Check if storage quota is exceeded
   */
  isQuotaExceeded(): Promise<boolean>;

  /**
   * Check if device has sufficient free storage
   * @param requiredBytes - Minimum required free space
   */
  hasSufficientStorage(requiredBytes: number): Promise<boolean>;

  /**
   * Monitor storage usage and trigger cleanup if needed
   * Should be called periodically in the background
   */
  monitorAndCleanup(): Promise<CleanupResult | null>;

  /**
   * Execute cleanup strategy manually
   * @param strategy - Cleanup strategy to use
   * @param targetPercentage - Percentage to clean (0-1)
   */
  executeCleanup(strategy: CleanupStrategy["name"], targetPercentage?: number): Promise<CleanupResult>;

  /**
   * Get recommended cleanup strategy based on current usage
   */
  getRecommendedCleanup(): Promise<CleanupStrategy>;

  /**
   * Set storage quota limits
   * @param maxBytes - Maximum storage size in bytes
   * @param maxEmbeddings - Maximum number of embeddings
   */
  setQuotaLimits(maxBytes: number, maxEmbeddings: number): Promise<void>;

  /**
   * Get current quota limits
   */
  getQuotaLimits(): Promise<{ maxBytes: number; maxEmbeddings: number }>;

  /**
   * Subscribe to storage warnings
   * @param callback - Called when storage reaches warning threshold
   */
  onStorageWarning(callback: (usage: StorageUsage) => void): () => void;

  /**
   * Calculate estimated storage needed for a download
   * @param embeddingCount - Number of embeddings to download
   * @returns Estimated bytes needed
   */
  estimateStorageNeeded(embeddingCount: number): number;
}

/**
 * Storage Quota Configuration
 */
export interface StorageQuotaConfig {
  /** Maximum storage size in bytes (default: 100MB) */
  maxStorageBytes: number;

  /** Maximum number of embeddings (default: 10,000) */
  maxEmbeddings: number;

  /** Warning threshold percentage (default: 0.8 = 80%) */
  warningThreshold: number;

  /** Cleanup threshold percentage (default: 0.9 = 90%) */
  cleanupThreshold: number;

  /** Minimum free device storage required (default: 50MB) */
  minFreeStorageBytes: number;

  /** Enable automatic cleanup */
  enableAutoCleanup: boolean;

  /** Default cleanup strategy */
  defaultCleanupStrategy: CleanupStrategy["name"];
}

/**
 * Default configuration
 */
export const DEFAULT_QUOTA_CONFIG: StorageQuotaConfig = {
  maxStorageBytes: 100 * 1024 * 1024, // 100MB
  maxEmbeddings: 10_000,
  warningThreshold: 0.8, // 80%
  cleanupThreshold: 0.9, // 90%
  minFreeStorageBytes: 50 * 1024 * 1024, // 50MB
  enableAutoCleanup: true,
  defaultCleanupStrategy: "lru",
};

/**
 * Cleanup Strategies
 */
export const CLEANUP_STRATEGIES: CleanupStrategy[] = [
  {
    name: "lru",
    description: "Least Recently Used - Remove embeddings not accessed recently",
    priority: 1,
    targetPercentage: 0.2, // Remove 20%
  },
  {
    name: "oldest_first",
    description: "Remove oldest embeddings by sync date",
    priority: 2,
    targetPercentage: 0.2,
  },
  {
    name: "low_usage",
    description: "Remove embeddings with lowest usage frequency",
    priority: 3,
    targetPercentage: 0.15, // Remove 15%
  },
  {
    name: "partial",
    description: "Keep only most relevant embeddings based on topic clustering",
    priority: 4,
    targetPercentage: 0.3, // Remove 30%
  },
];

/**
 * Storage Event Types
 */
export type StorageEvent =
  | { type: "quota_warning"; usage: StorageUsage }
  | { type: "quota_exceeded"; usage: StorageUsage }
  | { type: "cleanup_started"; strategy: string }
  | { type: "cleanup_completed"; result: CleanupResult }
  | { type: "cleanup_failed"; error: string }
  | { type: "insufficient_space"; requiredBytes: number; availableBytes: number };

/**
 * Implementation Notes:
 *
 * 1. Storage Monitoring:
 *    - Track total embeddings count in sync_metadata table
 *    - Calculate approximate size: (embeddings_count * avg_embedding_size)
 *    - Average embedding size ≈ 10KB (384 floats + content + metadata)
 *
 * 2. Cleanup Strategies:
 *    - LRU: Track last_accessed_at timestamp per embedding (requires schema update)
 *    - Oldest First: Remove embeddings with oldest sync_version
 *    - Low Usage: Track access_count per embedding (requires schema update)
 *    - Partial: Keep only embeddings from frequently accessed sources
 *
 * 3. Auto-Cleanup Trigger:
 *    - Monitor storage during each sync
 *    - Trigger cleanup when usage > cleanupThreshold
 *    - Stop downloads if insufficient space detected
 *
 * 4. Device Storage Check:
 *    - Use React Native FileSystem API to check available space
 *    - Prevent downloads if device storage < minFreeStorageBytes
 *    - Show warnings at warningThreshold
 *
 * 5. User Control:
 *    - Allow users to adjust quota limits in settings
 *    - Provide manual cleanup button
 *    - Show storage usage statistics in UI
 */
