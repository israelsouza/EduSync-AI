/**
 * Local Embedding Generation Interface (Optional)
 *
 * Allows mobile devices to generate embeddings locally for user queries,
 * enabling fully offline RAG without needing to send queries to backend.
 *
 * **Trade-offs:**
 * - PRO: Complete offline operation
 * - PRO: Privacy (queries never leave device)
 * - CON: Requires ~100MB model download
 * - CON: Slower on low-end devices
 * - CON: Battery drain
 *
 * **Recommendation:** Optional feature, default to pre-computed embeddings cache
 */

/**
 * Embedding generation result
 */
export interface EmbeddingGenerationResult {
  /** 384-dimensional embedding vector */
  embedding: number[];

  /** Time taken to generate (ms) */
  generationTimeMs: number;

  /** Model used */
  model: string;
}

/**
 * Local Embedding Service Interface
 */
export interface ILocalEmbeddingService {
  /**
   * Generate embedding for a text query
   * @param text - Input text (user query)
   * @returns Embedding vector
   */
  generateEmbedding(text: string): Promise<EmbeddingGenerationResult>;

  /**
   * Check if embedding model is downloaded and ready
   */
  isModelReady(): Promise<boolean>;

  /**
   * Download embedding model to device (one-time setup)
   * @param onProgress - Progress callback (0-100)
   */
  downloadModel(onProgress?: (progress: number) => void): Promise<void>;

  /**
   * Get model info (size, version)
   */
  getModelInfo(): Promise<{
    name: string;
    version: string;
    sizeBytes: number;
    isDownloaded: boolean;
  }>;

  /**
   * Delete model from device to free space
   */
  deleteModel(): Promise<void>;
}

/**
 * Recommended Models for Mobile
 */
export const MOBILE_EMBEDDING_MODELS = {
  /**
   * all-MiniLM-L6-v2 (Quantized)
   * - Size: ~23MB (quantized from 80MB)
   * - Dimensions: 384
   * - Speed: ~50ms per query on modern device
   * - Quality: Good for general purpose
   */
  miniLM: {
    name: "Xenova/all-MiniLM-L6-v2",
    sizeBytes: 23 * 1024 * 1024,
    dimensions: 384,
    downloadUrl: "https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx",
  },

  /**
   * multilingual-MiniLM-L12-v2
   * - Size: ~118MB
   * - Dimensions: 384
   * - Speed: ~100ms per query
   * - Quality: Better for Portuguese/Spanish
   *
   * NOTE: This model is currently DISABLED due to HuggingFace returning HTTP 401
   * for the direct ONNX download URL. The model exists but requires authentication
   * or a different download approach (e.g., using transformers.js library).
   *
   * TODO: Re-enable when a working download URL is available or implement
   * alternative download method via transformers.js auto-download.
   *
   * Original URL (returns 401):
   * https://huggingface.co/Xenova/multilingual-MiniLM-L12-v2/resolve/main/onnx/model_quantized.onnx
   */
  // multilingualMiniLM: {
  //   name: "Xenova/multilingual-MiniLM-L12-v2",
  //   sizeBytes: 118 * 1024 * 1024,
  //   dimensions: 384,
  //   downloadUrl: "<requires authentication or transformers.js>",
  // },
};

/**
 * Implementation Strategy
 *
 * Option 1: ONNX Runtime (React Native)
 * ```bash
 * npm install onnxruntime-react-native
 * ```
 *
 * Option 2: TensorFlow Lite
 * ```bash
 * npm install @tensorflow/tfjs @tensorflow/tfjs-react-native
 * ```
 *
 * Option 3: Transformers.js (Expo)
 * ```bash
 * npm install @xenova/transformers
 * ```
 */

/**
 * Example Implementation with Transformers.js
 *
 * ```typescript
 * import { pipeline } from '@xenova/transformers';
 *
 * class LocalEmbeddingService implements ILocalEmbeddingService {
 *   private embedder: any;
 *
 *   async generateEmbedding(text: string): Promise<EmbeddingGenerationResult> {
 *     const startTime = Date.now();
 *
 *     if (!this.embedder) {
 *       this.embedder = await pipeline(
 *         'feature-extraction',
 *         'Xenova/all-MiniLM-L6-v2'
 *       );
 *     }
 *
 *     const output = await this.embedder(text, {
 *       pooling: 'mean',
 *       normalize: true,
 *     });
 *
 *     const embedding = Array.from(output.data);
 *     const generationTimeMs = Date.now() - startTime;
 *
 *     return {
 *       embedding,
 *       generationTimeMs,
 *       model: 'Xenova/all-MiniLM-L6-v2',
 *     };
 *   }
 *
 *   async isModelReady(): Promise<boolean> {
 *     // Check if model files exist in local storage
 *     const modelPath = `${RNFS.DocumentDirectoryPath}/models/all-MiniLM-L6-v2`;
 *     return await RNFS.exists(modelPath);
 *   }
 * }
 * ```
 */

/**
 * Alternative: Query Embedding Cache
 *
 * Instead of generating embeddings on-device, cache common queries:
 *
 * ```typescript
 * interface CachedQuery {
 *   query: string;
 *   embedding: number[];
 *   usageCount: number;
 * }
 *
 * // Pre-compute embeddings for common queries on backend
 * const COMMON_QUERIES_CACHE = [
 *   {
 *     query: "Como ensinar subtração com zero?",
 *     embedding: [0.21, -0.48, ...], // 384 dims
 *     usageCount: 0,
 *   },
 *   {
 *     query: "Estratégias para turmas multisseriadas",
 *     embedding: [0.15, -0.32, ...],
 *     usageCount: 0,
 *   },
 *   // ... top 1000 queries
 * ];
 *
 * // On query:
 * 1. Check if exact match in cache → use cached embedding
 * 2. Check if similar query (Levenshtein distance) → use similar embedding
 * 3. Fallback: Queue query for when online, show cached response
 * ```
 */

/**
 * Offline Strategy Decision Tree
 *
 * ```
 * User Query
 *     ↓
 * Is Exact Match in Cache? ─YES→ Use Cached Embedding → Local Vector Search
 *     ↓ NO
 * Is Device High-End? ─YES→ Generate Embedding Locally → Local Vector Search
 *     ↓ NO
 * Is Similar Query in Cache? ─YES→ Use Similar Embedding → Local Vector Search
 *     ↓ NO
 * Queue Query for Online → Show "Saved for when you connect" Message
 * ```
 */

/**
 * Configuration
 */
export const LOCAL_EMBEDDING_CONFIG = {
  /** Enable local embedding generation? */
  ENABLE_LOCAL_GENERATION: false, // Default: use cache only

  /** Maximum cache size for query embeddings */
  MAX_QUERY_CACHE_SIZE: 1000,

  /** Minimum device RAM required for local generation (MB) */
  MIN_RAM_MB: 2048,

  /** Minimum battery level to generate embeddings (%) */
  MIN_BATTERY_LEVEL: 30,

  /** Timeout for embedding generation (ms) */
  GENERATION_TIMEOUT_MS: 5000,
};

/**
 * MVP Recommendation
 *
 * Recommended approach:
 * 1. ✅ Implement local vector search (Phase 4.1)
 * 2. ✅ Use backend-generated embeddings (already cached)
 * 3. ❌ Skip local embedding generation for MVP
 * 4. 📋 Add query cache for top 100 common queries
 * 5. 📋 Queue unseen queries for when online
 *
 * This provides 95% offline functionality with 20% of the complexity.
 */
