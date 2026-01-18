/**
 * Export Types - Data structures for embeddings export endpoint
 *
 * Used by mobile clients to download pre-computed embeddings
 * for offline-first operation
 */

/**
 * Vector embedding with metadata
 */
export interface EmbeddingRecord {
  /** Unique identifier (deterministic hash-based UUID) */
  id: string;
  /** The text content */
  content: string;
  /** 384-dimensional embedding vector */
  embedding: number[];
  /** Source document metadata */
  metadata: {
    source: string;
    page?: number;
    chapter?: string;
    [key: string]: unknown;
  };
}

/**
 * Versioned bundle of embeddings for mobile download
 */
export interface EmbeddingBundle {
  /** Bundle version (timestamp or semantic version) */
  version: string;
  /** Total number of embeddings in this bundle */
  count: number;
  /** Embedding model information */
  model: {
    name: string;
    dimensions: number;
  };
  /** Array of embedding records */
  embeddings: EmbeddingRecord[];
  /** Bundle metadata */
  metadata: {
    createdAt: string;
    tableName: string;
    compressionEnabled: boolean;
  };
}

/**
 * Request parameters for export endpoint
 */
export interface ExportRequest {
  /** Optional: specific version to download (for delta sync) */
  version?: string;
  /** Optional: limit number of embeddings */
  limit?: number;
  /** Optional: offset for pagination */
  offset?: number;
}

/**
 * Response from export endpoint
 */
export interface ExportResponse {
  /** Success status */
  success: boolean;
  /** The embedding bundle */
  data: EmbeddingBundle;
  /** Optional error message */
  error?: string;
}
