/**
 * Local Vector Search Interface
 *
 * Defines how to perform vector similarity search on mobile devices
 * using pre-downloaded embeddings stored in WatermelonDB/SQLite.
 *
 * This enables offline RAG by allowing semantic search without backend.
 */

/**
 * Vector search result with similarity score
 */
export interface LocalSearchResult {
  /** Embedding ID */
  id: string;

  /** Text content */
  content: string;

  /** Similarity score (0-1, higher is better) */
  score: number;

  /** Metadata */
  metadata: {
    source: string;
    page?: number;
    chapter?: string;
  };
}

/**
 * Vector search options
 */
export interface VectorSearchOptions {
  /** Number of results to return */
  topK: number;

  /** Minimum similarity threshold (0-1) */
  minScore?: number;

  /** Filter by source document */
  sourceFilter?: string;

  /** Filter by chapter */
  chapterFilter?: string;
}

/**
 * Local Vector Search Service Interface
 */
export interface ILocalVectorSearch {
  /**
   * Search for similar embeddings using cosine similarity
   * @param queryEmbedding - 384-dimensional vector from query
   * @param options - Search configuration
   * @returns Array of similar embeddings sorted by score
   */
  search(queryEmbedding: number[], options: VectorSearchOptions): Promise<LocalSearchResult[]>;

  /**
   * Preload embeddings into memory for faster search (optional)
   * Useful for devices with sufficient RAM
   */
  preloadEmbeddings(): Promise<void>;

  /**
   * Get total number of embeddings in local storage
   */
  getEmbeddingCount(): Promise<number>;

  /**
   * Validate embedding dimensions
   * @param embedding - Vector to validate
   * @returns True if dimensions match (384)
   */
  validateDimensions(embedding: number[]): boolean;
}

/**
 * Cosine Similarity Calculation
 *
 * Formula: similarity = (A · B) / (||A|| * ||B||)
 *
 * Where:
 * - A · B = dot product (sum of element-wise multiplication)
 * - ||A|| = magnitude of A (square root of sum of squares)
 * - ||B|| = magnitude of B
 *
 * Result: Value between -1 and 1 (we use 0-1 by normalizing)
 */
export function cosineSimilarity(vectorA: number[], vectorB: number[]): number {
  if (vectorA.length !== vectorB.length) {
    throw new Error(`Vector dimensions mismatch: ${vectorA.length} vs ${vectorB.length}`);
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vectorA.length; i++) {
    const valA = vectorA[i];
    const valB = vectorB[i];
    if (valA !== undefined && valB !== undefined) {
      dotProduct += valA * valB;
      magnitudeA += valA * valA;
      magnitudeB += valB * valB;
    }
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  const similarity = dotProduct / (magnitudeA * magnitudeB);

  // Normalize to 0-1 range (cosine similarity is -1 to 1, but embeddings are usually 0-1)
  return Math.max(0, Math.min(1, similarity));
}

/**
 * Implementation Example for React Native
 *
 * ```typescript
 * import { database } from './database';
 * import { Q } from '@nozbe/watermelondb';
 *
 * class LocalVectorSearchService implements ILocalVectorSearch {
 *   async search(
 *     queryEmbedding: number[],
 *     options: VectorSearchOptions
 *   ): Promise<LocalSearchResult[]> {
 *     // 1. Fetch all embeddings from local DB
 *     const embeddings = await database
 *       .get('embeddings')
 *       .query(
 *         options.sourceFilter
 *           ? Q.where('source', options.sourceFilter)
 *           : Q.where('id', Q.notEq(null))
 *       )
 *       .fetch();
 *
 *     // 2. Calculate similarity for each
 *     const results: LocalSearchResult[] = [];
 *
 *     for (const embedding of embeddings) {
 *       const storedVector = JSON.parse(embedding.embedding); // Parse JSON array
 *       const score = cosineSimilarity(queryEmbedding, storedVector);
 *
 *       if (score >= (options.minScore || 0)) {
 *         results.push({
 *           id: embedding.id,
 *           content: embedding.content,
 *           score,
 *           metadata: {
 *             source: embedding.source,
 *             page: embedding.page,
 *             chapter: embedding.chapter,
 *           },
 *         });
 *       }
 *     }
 *
 *     // 3. Sort by score (descending) and take top-k
 *     return results
 *       .sort((a, b) => b.score - a.score)
 *       .slice(0, options.topK);
 *   }
 *
 *   validateDimensions(embedding: number[]): boolean {
 *     return embedding.length === 384;
 *   }
 * }
 * ```
 */

/**
 * Performance Optimization Tips
 *
 * 1. **Preload Strategy:**
 *    - Load all embeddings into memory on app start (if RAM allows)
 *    - Use IndexedDB/AsyncStorage for caching parsed vectors
 *
 * 2. **Batching:**
 *    - Process embeddings in chunks of 1000 to avoid blocking UI
 *    - Use Web Workers / Hermes threading for parallel computation
 *
 * 3. **Approximate Search (Advanced):**
 *    - Implement HNSW (Hierarchical Navigable Small World) graph
 *    - Use locality-sensitive hashing (LSH) for faster approximate search
 *
 * 4. **Filtering:**
 *    - Pre-filter by source/chapter before computing similarity
 *    - Use SQL queries to reduce candidate set
 *
 * 5. **Caching:**
 *    - Cache frequent queries (e.g., "Como ensinar subtração?")
 *    - Store query embeddings to avoid re-computation
 */

/**
 * Local Vector Search Configuration
 */
export const LOCAL_VECTOR_SEARCH_CONFIG = {
  /** Default top-k results */
  DEFAULT_TOP_K: 3,

  /** Minimum similarity score to include result */
  MIN_SIMILARITY_SCORE: 0.5,

  /** Expected embedding dimensions */
  EMBEDDING_DIMENSIONS: 384,

  /** Batch size for processing embeddings */
  BATCH_SIZE: 1000,

  /** Maximum embeddings to preload in memory */
  MAX_PRELOAD_COUNT: 10000,
};
