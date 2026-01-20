/**
 * Offline Query Queue Interface
 *
 * Manages queries made while offline, syncing them to backend when connectivity returns.
 * Enables analytics, query logging, and future response improvements.
 */

/**
 * Query status in the queue
 */
export type QueryStatus =
  | "pending" // Waiting for connectivity
  | "syncing" // Currently uploading to backend
  | "synced" // Successfully synced
  | "failed"; // Sync failed after retries

/**
 * Query priority
 */
export type QueryPriority = "low" | "normal" | "high";

/**
 * Queued query record
 */
export interface QueuedQuery {
  /** Unique identifier */
  id: string;

  /** Teacher's query text */
  query: string;

  /** Response provided (offline or cached) */
  response: string;

  /** Timestamp when query was made */
  timestamp: number;

  /** Current sync status */
  status: QueryStatus;

  /** Priority for sync */
  priority: QueryPriority;

  /** Number of sync attempts */
  retryCount: number;

  /** Last error message (if failed) */
  errorMessage?: string;

  /** Metadata */
  metadata: {
    /** Was response generated locally or from cache? */
    responseSource: "local" | "cache" | "fallback";

    /** Conversation context at time of query */
    conversationId?: string;

    /** Device info */
    deviceId: string;

    /** App version */
    appVersion: string;
  };
}

/**
 * Sync result for a batch
 */
export interface QuerySyncResult {
  /** Number of queries synced successfully */
  syncedCount: number;

  /** Number of queries failed */
  failedCount: number;

  /** Query IDs that were synced */
  syncedIds: string[];

  /** Query IDs that failed */
  failedIds: string[];

  /** Errors encountered */
  errors: {
    queryId: string;
    error: string;
  }[];
}

/**
 * Queue statistics
 */
export interface QueueStats {
  /** Total queries in queue */
  totalQueries: number;

  /** Queries by status */
  byStatus: {
    pending: number;
    syncing: number;
    synced: number;
    failed: number;
  };

  /** Oldest unsynced query timestamp */
  oldestPendingTimestamp?: number;

  /** Estimated sync time (ms) */
  estimatedSyncTimeMs: number;
}

/**
 * Offline Query Queue Service Interface
 */
export interface IOfflineQueryQueue {
  /**
   * Add query to queue
   * @param query - Query details
   * @returns Queue ID
   */
  enqueue(query: Omit<QueuedQuery, "id" | "status" | "retryCount">): Promise<string>;

  /**
   * Sync pending queries to backend
   * @param maxBatchSize - Maximum queries per sync batch
   * @returns Sync result
   */
  syncPendingQueries(maxBatchSize?: number): Promise<QuerySyncResult>;

  /**
   * Get queue statistics
   */
  getStats(): Promise<QueueStats>;

  /**
   * Get queries by status
   */
  getQueriesByStatus(status: QueryStatus, limit?: number): Promise<QueuedQuery[]>;

  /**
   * Retry failed queries
   */
  retryFailedQueries(): Promise<QuerySyncResult>;

  /**
   * Clear synced queries (cleanup)
   * @param olderThanDays - Remove queries older than X days
   */
  clearSyncedQueries(olderThanDays?: number): Promise<number>;

  /**
   * Mark query as synced (manually)
   */
  markAsSynced(queryId: string): Promise<void>;

  /**
   * Delete query from queue
   */
  deleteQuery(queryId: string): Promise<void>;
}

/**
 * WatermelonDB Schema Extension
 *
 * Add to mobile-storage.schema.ts:
 *
 * ```typescript
 * {
 *   name: 'offline_queries',
 *   columns: [
 *     { name: 'query', type: 'string' },
 *     { name: 'response', type: 'string' },
 *     { name: 'timestamp', type: 'number', isIndexed: true },
 *     { name: 'status', type: 'string', isIndexed: true },
 *     { name: 'priority', type: 'string' },
 *     { name: 'retry_count', type: 'number' },
 *     { name: 'error_message', type: 'string', isOptional: true },
 *     { name: 'response_source', type: 'string' },
 *     { name: 'conversation_id', type: 'string', isOptional: true },
 *     { name: 'device_id', type: 'string' },
 *     { name: 'app_version', type: 'string' },
 *   ]
 * }
 * ```
 */

/**
 * Example Implementation (React Native)
 *
 * ```typescript
 * import { Q } from '@nozbe/watermelondb';
 * import { OfflineQuery } from '../models/OfflineQuery';
 *
 * class OfflineQueryQueueService implements IOfflineQueryQueue {
 *   async enqueue(query: Omit<QueuedQuery, 'id' | 'status' | 'retryCount'>): Promise<string> {
 *     const record = await database.write(async () => {
 *       return await database.get<OfflineQuery>('offline_queries').create((q) => {
 *         q.query = query.query;
 *         q.response = query.response;
 *         q.timestamp = query.timestamp;
 *         q.status = 'pending';
 *         q.priority = query.priority;
 *         q.retryCount = 0;
 *         q.responseSource = query.metadata.responseSource;
 *         q.conversationId = query.metadata.conversationId;
 *         q.deviceId = query.metadata.deviceId;
 *         q.appVersion = query.metadata.appVersion;
 *       });
 *     });
 *
 *     return record.id;
 *   }
 *
 *   async syncPendingQueries(maxBatchSize = 50): Promise<QuerySyncResult> {
 *     const pendingQueries = await database
 *       .get<OfflineQuery>('offline_queries')
 *       .query(
 *         Q.where('status', 'pending'),
 *         Q.sortBy('priority', Q.desc),
 *         Q.sortBy('timestamp', Q.asc),
 *         Q.take(maxBatchSize)
 *       )
 *       .fetch();
 *
 *     if (pendingQueries.length === 0) {
 *       return { syncedCount: 0, failedCount: 0, syncedIds: [], failedIds: [], errors: [] };
 *     }
 *
 *     // Mark as syncing
 *     await database.write(async () => {
 *       await Promise.all(
 *         pendingQueries.map((q) =>
 *           q.update((record) => {
 *             record.status = 'syncing';
 *           })
 *         )
 *       );
 *     });
 *
 *     // Send to backend
 *     try {
 *       const response = await fetch(`${API_URL}/api/sync/queries`, {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify({
 *           queries: pendingQueries.map((q) => ({
 *             id: q.id,
 *             query: q.query,
 *             response: q.response,
 *             timestamp: q.timestamp,
 *             metadata: {
 *               responseSource: q.responseSource,
 *               conversationId: q.conversationId,
 *               deviceId: q.deviceId,
 *               appVersion: q.appVersion,
 *             },
 *           })),
 *         }),
 *       });
 *
 *       const result = await response.json();
 *
 *       // Update status
 *       await database.write(async () => {
 *         for (const id of result.syncedIds) {
 *           const query = pendingQueries.find((q) => q.id === id);
 *           if (query) {
 *             await query.update((record) => {
 *               record.status = 'synced';
 *             });
 *           }
 *         }
 *
 *         for (const id of result.failedIds) {
 *           const query = pendingQueries.find((q) => q.id === id);
 *           if (query) {
 *             await query.update((record) => {
 *               record.status = 'failed';
 *               record.retryCount += 1;
 *             });
 *           }
 *         }
 *       });
 *
 *       return result;
 *     } catch (error) {
 *       // Rollback to pending
 *       await database.write(async () => {
 *         await Promise.all(
 *           pendingQueries.map((q) =>
 *             q.update((record) => {
 *               record.status = 'pending';
 *               record.retryCount += 1;
 *               record.errorMessage = error.message;
 *             })
 *           )
 *         );
 *       });
 *
 *       throw error;
 *     }
 *   }
 *
 *   async clearSyncedQueries(olderThanDays = 30): Promise<number> {
 *     const cutoffTimestamp = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
 *
 *     const oldQueries = await database
 *       .get<OfflineQuery>('offline_queries')
 *       .query(
 *         Q.where('status', 'synced'),
 *         Q.where('timestamp', Q.lt(cutoffTimestamp))
 *       )
 *       .fetch();
 *
 *     await database.write(async () => {
 *       await Promise.all(oldQueries.map((q) => q.markAsDeleted()));
 *     });
 *
 *     return oldQueries.length;
 *   }
 * }
 * ```
 */

/**
 * Auto-Sync Strategy
 *
 * ```typescript
 * // Trigger sync when:
 * 1. App comes online (connectivity change listener)
 * 2. App enters foreground (AppState change)
 * 3. Manual sync button pressed
 * 4. Every X minutes if online (background task)
 *
 * // Example:
 * useEffect(() => {
 *   const unsubscribeConnectivity = NetInfo.addEventListener((state) => {
 *     if (state.isConnected && state.isInternetReachable) {
 *       queryQueueService.syncPendingQueries();
 *     }
 *   });
 *
 *   const subscription = AppState.addEventListener('change', (nextState) => {
 *     if (nextState === 'active') {
 *       queryQueueService.syncPendingQueries();
 *     }
 *   });
 *
 *   return () => {
 *     unsubscribeConnectivity();
 *     subscription.remove();
 *   };
 * }, []);
 * ```
 */

/**
 * Configuration
 */
export const OFFLINE_QUEUE_CONFIG = {
  /** Maximum queries to store in queue */
  MAX_QUEUE_SIZE: 1000,

  /** Maximum batch size for sync */
  DEFAULT_BATCH_SIZE: 50,

  /** Maximum retry attempts before marking as permanently failed */
  MAX_RETRY_ATTEMPTS: 3,

  /** Days to keep synced queries before cleanup */
  CLEANUP_AFTER_DAYS: 30,

  /** Auto-sync interval when online (ms) */
  AUTO_SYNC_INTERVAL_MS: 5 * 60 * 1000, // 5 minutes
};

/**
 * Privacy Considerations
 *
 * - Queries contain pedagogical context (may include student info)
 * - Always anonymize before syncing:
 *   - Strip student names
 *   - Replace specific ages with ranges
 *   - Generalize location references
 *
 * - Only sync if user consented to analytics
 * - Provide option to disable query logging
 */
