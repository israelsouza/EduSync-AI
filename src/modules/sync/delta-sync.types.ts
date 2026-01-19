/**
 * Delta Sync Types
 *
 * Supports incremental synchronization by only downloading changed embeddings
 * instead of re-downloading the entire dataset.
 */

/**
 * Delta sync request
 */
export interface DeltaSyncRequest {
  /** Current local version */
  localVersion: string;

  /** Device identifier (optional, for tracking) */
  deviceId?: string;

  /** Pagination */
  limit?: number;
  offset?: number;
}

/**
 * Embedding change type
 */
export type ChangeType = "added" | "modified" | "deleted";

/**
 * Changed embedding record
 */
export interface EmbeddingChange {
  /** Embedding ID */
  id: string;

  /** Type of change */
  changeType: ChangeType;

  /** Full embedding data (if added or modified) */
  data?: {
    content: string;
    embedding: number[];
    metadata: Record<string, unknown>;
  };

  /** Version when this change occurred */
  changedInVersion: string;
}

/**
 * Delta sync response
 */
export interface DeltaSyncResponse {
  /** Success status */
  success: boolean;

  /** Current latest version on backend */
  latestVersion: string;

  /** Client's local version */
  localVersion: string;

  /** Is local version outdated? */
  isOutdated: boolean;

  /** Requires full re-sync? (if delta is too large) */
  requiresFullSync: boolean;

  /** Array of changes */
  changes: EmbeddingChange[];

  /** Total changes available */
  totalChanges: number;

  /** Metadata */
  metadata: {
    changesSince: string; // ISO timestamp
    generatedAt: string;
  };
}

/**
 * Version comparison result
 */
export interface VersionComparison {
  /** Is local version behind? */
  isOutdated: boolean;

  /** Version difference (number of versions behind) */
  versionDiff: number;

  /** Should trigger full sync? */
  shouldFullSync: boolean;

  /** Estimated changes */
  estimatedChanges: number;
}
