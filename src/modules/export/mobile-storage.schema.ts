/**
 * Mobile Storage Schema Documentation
 *
 * This file documents the local storage structure for offline-first mobile operation.
 * The mobile app will download embeddings from the backend and store them locally
 * using either WatermelonDB (React Native) or SQLite.
 *
 * Related: Phase 2 - Milestone 3 (Sincronização e Offline-First)
 */

/**
 * TABLE: embeddings
 *
 * Stores vector embeddings for offline semantic search
 */
export interface LocalEmbeddingSchema {
  id: string; // Primary Key - UUID from backend
  content: string; // Text content (indexed for full-text search)
  embedding: string; // JSON stringified array of 384 floats
  source: string; // Document source filename
  page: number | null; // Page number in source document
  chapter: string | null; // Chapter name
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
  sync_version: string; // Version when this was downloaded (e.g., "2026.01.18.143025")
}

/**
 * TABLE: sync_metadata
 *
 * Tracks synchronization state and versions
 */
export interface SyncMetadataSchema {
  id: string; // Primary Key
  last_sync_version: string; // Last successfully synced version
  last_sync_timestamp: string; // ISO timestamp of last sync
  total_embeddings: number; // Total count of local embeddings
  storage_size_bytes: number; // Approximate storage usage
  sync_status: "idle" | "syncing" | "error"; // Current sync state
  error_message: string | null; // Last sync error (if any)
}

/**
 * TABLE: download_queue
 *
 * Manages background download tasks
 */
export interface DownloadQueueSchema {
  id: string; // Primary Key
  offset: number; // Pagination offset for this batch
  limit: number; // Number of embeddings in this batch
  status: "pending" | "downloading" | "completed" | "failed"; // Download state
  retry_count: number; // Number of retry attempts
  created_at: string; // ISO timestamp
  completed_at: string | null; // ISO timestamp when completed
  error_message: string | null; // Error details (if failed)
}

/**
 * WatermelonDB Schema Definition (React Native)
 *
 * This would be implemented in the frontend repository as:
 * src/database/schema.ts
 */
export const watermelonDBSchema = {
  version: 1,
  tables: [
    {
      name: "embeddings",
      columns: [
        { name: "content", type: "string", isIndexed: true },
        { name: "embedding", type: "string" }, // JSON array
        { name: "source", type: "string", isIndexed: true },
        { name: "page", type: "number", isOptional: true },
        { name: "chapter", type: "string", isOptional: true },
        { name: "sync_version", type: "string", isIndexed: true },
        { name: "created_at", type: "number" },
        { name: "updated_at", type: "number" },
      ],
    },
    {
      name: "sync_metadata",
      columns: [
        { name: "last_sync_version", type: "string" },
        { name: "last_sync_timestamp", type: "number" },
        { name: "total_embeddings", type: "number" },
        { name: "storage_size_bytes", type: "number" },
        { name: "sync_status", type: "string" },
        { name: "error_message", type: "string", isOptional: true },
      ],
    },
    {
      name: "download_queue",
      columns: [
        { name: "offset", type: "number" },
        { name: "limit", type: "number" },
        { name: "status", type: "string", isIndexed: true },
        { name: "retry_count", type: "number" },
        { name: "created_at", type: "number" },
        { name: "completed_at", type: "number", isOptional: true },
        { name: "error_message", type: "string", isOptional: true },
      ],
    },
  ],
};

/**
 * Storage Quotas and Limits
 */
export const STORAGE_LIMITS = {
  /** Maximum embeddings to store locally (default: 10,000) */
  MAX_EMBEDDINGS: 10_000,

  /** Maximum storage size in bytes (default: 100MB) */
  MAX_STORAGE_BYTES: 100 * 1024 * 1024,

  /** Batch size for downloads (default: 500) */
  DOWNLOAD_BATCH_SIZE: 500,

  /** Maximum retry attempts for failed downloads */
  MAX_RETRY_ATTEMPTS: 3,

  /** Cache expiration in days (default: 30 days) */
  CACHE_EXPIRATION_DAYS: 30,

  /** Minimum free storage required (default: 50MB) */
  MIN_FREE_STORAGE_BYTES: 50 * 1024 * 1024,
};
