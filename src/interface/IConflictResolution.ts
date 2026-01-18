/**
 * Conflict Resolution Strategy
 *
 * Handles version conflicts and data integrity issues during synchronization.
 * Defines rules for when local and remote data diverge.
 */

/**
 * Conflict type
 */
export type ConflictType =
  | "version_mismatch" // Local version != expected version
  | "data_corruption" // Local data integrity check failed
  | "concurrent_update" // Backend updated while client was syncing
  | "partial_sync" // Previous sync didn't complete
  | "schema_mismatch"; // Database schema version incompatible

/**
 * Conflict severity
 */
export type ConflictSeverity = "low" | "medium" | "high" | "critical";

/**
 * Resolution strategy
 */
export type ResolutionStrategy =
  | "server_wins" // Always trust backend (default for embeddings)
  | "client_wins" // Keep local data (not applicable for embeddings)
  | "merge" // Attempt to merge (complex, not used in MVP)
  | "prompt_user" // Ask user to decide
  | "discard_and_resync"; // Delete local data and re-download

/**
 * Conflict detection result
 */
export interface Conflict {
  /** Unique conflict ID */
  id: string;

  /** Type of conflict */
  type: ConflictType;

  /** Severity level */
  severity: ConflictSeverity;

  /** Description for logging/debugging */
  description: string;

  /** Local version involved */
  localVersion: string;

  /** Backend version involved */
  remoteVersion: string;

  /** Recommended resolution */
  recommendedResolution: ResolutionStrategy;

  /** Timestamp when detected */
  detectedAt: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Resolution result
 */
export interface ResolutionResult {
  /** Was conflict resolved? */
  resolved: boolean;

  /** Strategy applied */
  strategyUsed: ResolutionStrategy;

  /** Actions taken */
  actions: string[];

  /** New version after resolution */
  newVersion?: string;

  /** Error message (if resolution failed) */
  error?: string;
}

/**
 * Conflict Resolution Service Interface
 */
export interface IConflictResolution {
  /**
   * Detect conflicts between local and remote state
   * @param localVersion - Client's current version
   * @param remoteVersion - Backend's latest version
   * @param localChecksum - Integrity checksum of local data
   */
  detectConflicts(localVersion: string, remoteVersion: string, localChecksum?: string): Promise<Conflict[]>;

  /**
   * Resolve a conflict using recommended strategy
   * @param conflict - Detected conflict
   */
  resolveConflict(conflict: Conflict): Promise<ResolutionResult>;

  /**
   * Resolve all conflicts automatically
   * @param conflicts - Array of conflicts
   */
  resolveAll(conflicts: Conflict[]): Promise<ResolutionResult[]>;

  /**
   * Validate data integrity after resolution
   * @param version - Version to validate
   */
  validateIntegrity(version: string): Promise<boolean>;
}

/**
 * Conflict Resolution Rules (for embeddings sync)
 */
export const CONFLICT_RESOLUTION_RULES = {
  /**
   * Version Mismatch: Server always wins
   * Rationale: Embeddings are read-only on client, backend is source of truth
   */
  version_mismatch: {
    strategy: "server_wins" as ResolutionStrategy,
    action: "Clear local embeddings and re-download from backend",
  },

  /**
   * Data Corruption: Discard and resync
   * Rationale: Corrupted embeddings are unusable, must be replaced
   */
  data_corruption: {
    strategy: "discard_and_resync" as ResolutionStrategy,
    action: "Delete corrupted embeddings, trigger full sync",
  },

  /**
   * Concurrent Update: Server wins
   * Rationale: Backend updated while sync was in progress, use latest version
   */
  concurrent_update: {
    strategy: "server_wins" as ResolutionStrategy,
    action: "Cancel current sync, restart with latest version",
  },

  /**
   * Partial Sync: Resume or restart
   * Rationale: Continue from last completed batch if possible
   */
  partial_sync: {
    strategy: "server_wins" as ResolutionStrategy,
    action: "Check download_queue for pending tasks, resume or restart",
  },

  /**
   * Schema Mismatch: Prompt user to update app
   * Rationale: Database schema incompatibility requires app update
   */
  schema_mismatch: {
    strategy: "prompt_user" as ResolutionStrategy,
    action: "Show update required message, block sync until app is updated",
  },
};

/**
 * Conflict Resolution Steps (for MVP)
 *
 * 1. Detection:
 *    - Compare localVersion with remoteVersion via /api/sync/compare
 *    - Validate local data integrity (embedding dimensions, missing fields)
 *    - Check for incomplete download tasks in download_queue
 *
 * 2. Classification:
 *    - Determine conflict type based on checks above
 *    - Assign severity (high for corruption, medium for version mismatch)
 *    - Select recommended resolution strategy from rules
 *
 * 3. Resolution:
 *    - For 'server_wins': Clear local cache, trigger full sync
 *    - For 'discard_and_resync': Delete embeddings table, reset sync_metadata
 *    - For 'prompt_user': Show UI dialog, wait for user action
 *
 * 4. Validation:
 *    - After resolution, validate embedding count matches expected
 *    - Verify sync_metadata is updated correctly
 *    - Confirm integrity checks pass
 *
 * 5. Logging:
 *    - Log all conflicts and resolutions for debugging
 *    - Send telemetry to backend (if user consented)
 *    - Track resolution success rate
 */

/**
 * Conflict Resolution Events
 */
export type ConflictEvent =
  | { type: "conflict_detected"; conflict: Conflict }
  | { type: "resolution_started"; conflictId: string; strategy: ResolutionStrategy }
  | { type: "resolution_completed"; result: ResolutionResult }
  | { type: "resolution_failed"; conflictId: string; error: string }
  | { type: "integrity_restored"; version: string };

/**
 * Helper: Create conflict object
 */
export function createConflict(type: ConflictType, localVersion: string, remoteVersion: string, description: string): Conflict {
  const severityMap: Record<ConflictType, ConflictSeverity> = {
    version_mismatch: "medium",
    data_corruption: "high",
    concurrent_update: "medium",
    partial_sync: "low",
    schema_mismatch: "critical",
  };

  return {
    id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    severity: severityMap[type],
    description,
    localVersion,
    remoteVersion,
    recommendedResolution: CONFLICT_RESOLUTION_RULES[type].strategy,
    detectedAt: new Date().toISOString(),
  };
}
