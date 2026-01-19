/**
 * Download Manager Service Interface
 *
 * Manages background download of embeddings from backend to mobile device.
 * Implements batching, retry logic, and progress tracking.
 *
 * This interface should be implemented in the React Native frontend.
 */

export interface DownloadProgress {
  /** Current batch being downloaded */
  currentBatch: number;
  /** Total batches to download */
  totalBatches: number;
  /** Number of embeddings downloaded so far */
  downloadedCount: number;
  /** Total embeddings to download */
  totalCount: number;
  /** Download progress percentage (0-100) */
  percentage: number;
  /** Current download speed in KB/s */
  speedKBps: number;
  /** Estimated time remaining in seconds */
  estimatedTimeSeconds: number;
}

export interface DownloadTask {
  id: string;
  offset: number;
  limit: number;
  status: "pending" | "downloading" | "completed" | "failed";
  retryCount: number;
  error?: string;
}

/**
 * Download Manager Interface
 */
export interface IDownloadManager {
  /**
   * Start downloading embeddings from backend
   * @param version - Specific version to download (optional)
   * @returns Promise that resolves when download completes
   */
  startDownload(version?: string): Promise<void>;

  /**
   * Pause ongoing download
   */
  pauseDownload(): Promise<void>;

  /**
   * Resume paused download
   */
  resumeDownload(): Promise<void>;

  /**
   * Cancel ongoing download and clear queue
   */
  cancelDownload(): Promise<void>;

  /**
   * Get current download progress
   */
  getProgress(): DownloadProgress | null;

  /**
   * Subscribe to progress updates
   * @param callback - Function called on each progress update
   * @returns Unsubscribe function
   */
  onProgress(callback: (progress: DownloadProgress) => void): () => void;

  /**
   * Check if download is currently in progress
   */
  isDownloading(): boolean;

  /**
   * Get list of pending download tasks
   */
  getPendingTasks(): Promise<DownloadTask[]>;

  /**
   * Retry failed download tasks
   */
  retryFailed(): Promise<void>;
}

/**
 * Download Manager Configuration
 */
export interface DownloadManagerConfig {
  /** Backend API base URL */
  apiBaseUrl: string;

  /** Batch size for each download request (default: 500) */
  batchSize: number;

  /** Maximum concurrent downloads (default: 2) */
  maxConcurrent: number;

  /** Maximum retry attempts per task (default: 3) */
  maxRetries: number;

  /** Retry delay in milliseconds (default: 5000) */
  retryDelayMs: number;

  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs: number;

  /** Enable compression (Accept-Encoding: gzip) */
  enableCompression: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_DOWNLOAD_CONFIG: DownloadManagerConfig = {
  apiBaseUrl: process.env["API_BASE_URL"] || "http://localhost:3000",
  batchSize: 500,
  maxConcurrent: 2,
  maxRetries: 3,
  retryDelayMs: 5000,
  timeoutMs: 30000,
  enableCompression: true,
};

/**
 * Download Event Types
 */
export type DownloadEvent =
  | { type: "started"; totalBatches: number; totalCount: number }
  | { type: "progress"; progress: DownloadProgress }
  | { type: "batch_completed"; batchNumber: number; embeddingsCount: number }
  | { type: "batch_failed"; batchNumber: number; error: string; retryCount: number }
  | { type: "completed"; totalDownloaded: number; durationMs: number }
  | { type: "cancelled" }
  | { type: "error"; error: string };

/**
 * Download Manager Event Emitter Interface
 */
export interface IDownloadEventEmitter {
  on(event: "download_event", callback: (event: DownloadEvent) => void): void;
  off(event: "download_event", callback: (event: DownloadEvent) => void): void;
  emit(event: "download_event", data: DownloadEvent): void;
}
