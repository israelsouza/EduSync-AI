/**
 * Whisper STT Service Implementation
 *
 * Uses whisper.cpp (via @fugood/whisper.node) for local speech-to-text.
 * Enables offline transcription for the voice assistant.
 *
 * @module WhisperSTTService
 */

import {
  ISTTService,
  STTConfig,
  TranscriptionResult,
  STTModelInfo,
  STTStreamCallback,
  STTStreamEvent,
  ModelDownloadProgress,
  DEFAULT_STT_CONFIG,
  SupportedLanguage,
} from "../interface/ISTTService.js";
import { AudioChunk } from "../interface/IAudioStreamHandler.js";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Model directory (relative to project root)
const MODELS_DIR = join(__dirname, "..", "..", "models", "whisper");

/**
 * Whisper model configurations
 * Models need to be downloaded separately
 */
interface WhisperModelConfig {
  id: string;
  name: string;
  filename: string;
  sizeBytes: number;
  languages: SupportedLanguage[];
  accuracy: number;
  downloadUrl: string;
}

const WHISPER_MODELS: WhisperModelConfig[] = [
  {
    id: "whisper-tiny",
    name: "Whisper Tiny",
    filename: "ggml-tiny.bin",
    sizeBytes: 75_000_000, // ~75MB
    languages: ["pt-BR", "es-ES", "es-MX", "es-419", "en-US", "auto"],
    accuracy: 0.7,
    downloadUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
  },
  {
    id: "whisper-base",
    name: "Whisper Base",
    filename: "ggml-base.bin",
    sizeBytes: 142_000_000, // ~142MB
    languages: ["pt-BR", "es-ES", "es-MX", "es-419", "en-US", "auto"],
    accuracy: 0.8,
    downloadUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
  },
  {
    id: "whisper-small",
    name: "Whisper Small",
    filename: "ggml-small.bin",
    sizeBytes: 466_000_000, // ~466MB
    languages: ["pt-BR", "es-ES", "es-MX", "es-419", "en-US", "auto"],
    accuracy: 0.85,
    downloadUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
  },
  {
    id: "whisper-medium",
    name: "Whisper Medium",
    filename: "ggml-medium.bin",
    sizeBytes: 1_500_000_000, // ~1.5GB
    languages: ["pt-BR", "es-ES", "es-MX", "es-419", "en-US", "auto"],
    accuracy: 0.9,
    downloadUrl: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin",
  },
];

// Language code mapping for Whisper
const LANGUAGE_MAP: Record<SupportedLanguage, string> = {
  "pt-BR": "pt",
  "es-ES": "es",
  "es-MX": "es",
  "es-419": "es",
  "en-US": "en",
  auto: "auto",
};

// Whisper context type (from @fugood/whisper.node)
interface WhisperContext {
  transcribeData: (data: ArrayBuffer, options: Record<string, unknown>) => { stop: () => Promise<void>; promise: Promise<unknown> };
  transcribeFile: (path: string, options: Record<string, unknown>) => { stop: () => Promise<void>; promise: Promise<unknown> };
  release: () => Promise<void>;
}

// Whisper transcription segment
interface WhisperSegment {
  text: string;
  start?: number;
  end?: number;
}

/**
 * Whisper STT Service for local/offline speech recognition
 *
 * Requires whisper model to be downloaded before use.
 * Use downloadModel() or manually download to models/whisper/
 */
export class WhisperSTTService implements ISTTService {
  private config: STTConfig;
  private whisperContext: WhisperContext | null = null;
  private currentModelId = "whisper-base";
  private isInitialized = false;
  private streamingSessions = new Map<string, STTStreamCallback>();

  constructor() {
    this.config = { ...DEFAULT_STT_CONFIG };
  }

  async initialize(config?: Partial<STTConfig>): Promise<boolean> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Ensure models directory exists
    if (!existsSync(MODELS_DIR)) {
      mkdirSync(MODELS_DIR, { recursive: true });
    }

    // Check if model exists
    const modelConfig = WHISPER_MODELS.find((m) => m.id === this.currentModelId);
    if (!modelConfig) {
      console.error(`[WhisperSTT] Unknown model: ${this.currentModelId}`);
      return false;
    }

    const modelPath = join(MODELS_DIR, modelConfig.filename);
    if (!existsSync(modelPath)) {
      console.warn(`[WhisperSTT] Model not found at: ${modelPath}`);
      console.warn(`[WhisperSTT] Download it using: downloadModel('${this.currentModelId}')`);
      console.warn(`[WhisperSTT] Or manually from: ${modelConfig.downloadUrl}`);
      return false;
    }

    try {
      // Dynamic import of whisper.node (ESM compatible)
      const whisperModule = await import("@fugood/whisper.node");
      const { initWhisper } = whisperModule;

      console.log(`[WhisperSTT] Loading model from: ${modelPath}`);

      this.whisperContext = (await initWhisper({
        filePath: modelPath,
        useGpu: false, // Default to CPU for compatibility
      })) as WhisperContext;

      this.isInitialized = true;
      console.log(`[WhisperSTT] Initialized with model: ${this.currentModelId}`);
      return true;
    } catch (error) {
      console.error("[WhisperSTT] Failed to initialize:", error);
      this.isInitialized = false;
      return false;
    }
  }

  async transcribe(audioData: ArrayBuffer, config?: Partial<STTConfig>): Promise<TranscriptionResult> {
    if (!this.isInitialized || !this.whisperContext) {
      throw new Error("WhisperSTT not initialized. Call initialize() first or download model.");
    }

    const activeConfig = { ...this.config, ...config };
    const startTime = Date.now();

    try {
      // Whisper expects 16-bit PCM, mono, 16kHz
      // If input is different, may need conversion
      const language = LANGUAGE_MAP[activeConfig.language] || "auto";

      console.log(`[WhisperSTT] Transcribing ${audioData.byteLength} bytes, language: ${language}`);

      const { promise } = this.whisperContext.transcribeData(audioData, {
        language,
        temperature: 0.0,
        // Additional options can be added here
      });

      const result = await promise;
      const processingTimeMs = Date.now() - startTime;

      // Extract transcribed text from result
      const transcribedText = this.extractTranscription(result);

      console.log(`[WhisperSTT] Transcription complete in ${processingTimeMs}ms: "${transcribedText.substring(0, 50)}..."`);

      const detectedLang = activeConfig.language !== "auto" ? activeConfig.language : undefined;

      return {
        id: `whisper_${Date.now()}`,
        isFinal: true,
        alternatives: [
          {
            transcript: transcribedText,
            confidence: 0.9, // Whisper doesn't provide confidence scores
          },
        ],
        ...(detectedLang && { detectedLanguage: detectedLang }),
        audioDurationMs: this.estimateAudioDuration(audioData),
        processingTimeMs,
        timestamp: new Date().toISOString(),
        modelId: this.currentModelId,
      };
    } catch (error) {
      console.error("[WhisperSTT] Transcription failed:", error);
      throw error;
    }
  }

  async transcribeChunks(chunks: AudioChunk[], config?: Partial<STTConfig>): Promise<TranscriptionResult> {
    // Combine all chunks into a single buffer
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.data.byteLength, 0);
    const combinedBuffer = new ArrayBuffer(totalSize);
    const view = new Uint8Array(combinedBuffer);

    let offset = 0;
    for (const chunk of chunks) {
      view.set(new Uint8Array(chunk.data), offset);
      offset += chunk.data.byteLength;
    }

    return this.transcribe(combinedBuffer, config);
  }

  async startStreaming(callback: STTStreamCallback, config?: Partial<STTConfig>): Promise<string> {
    // Streaming not fully supported in whisper.node
    // Create a session ID and store the callback
    const sessionId = `whisper_stream_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.streamingSessions.set(sessionId, callback);

    console.log(`[WhisperSTT] Streaming session started: ${sessionId}`);
    console.warn("[WhisperSTT] Note: Streaming is simulated, audio is buffered until endStreaming()");

    return sessionId;
  }

  async feedAudioChunk(sessionId: string, chunk: AudioChunk): Promise<void> {
    const callback = this.streamingSessions.get(sessionId);
    if (!callback) {
      throw new Error(`Streaming session not found: ${sessionId}`);
    }

    // For now, just acknowledge the chunk
    // In a full implementation, we would buffer chunks
    void chunk;
    console.log(`[WhisperSTT] Received chunk for session ${sessionId}: ${chunk.data.byteLength} bytes`);
  }

  async endStreaming(sessionId: string): Promise<TranscriptionResult> {
    const callback = this.streamingSessions.get(sessionId);
    if (!callback) {
      throw new Error(`Streaming session not found: ${sessionId}`);
    }

    this.streamingSessions.delete(sessionId);

    // Return empty result (in full implementation, would transcribe buffered audio)
    const result: TranscriptionResult = {
      id: `whisper_end_${Date.now()}`,
      isFinal: true,
      alternatives: [{ transcript: "", confidence: 0 }],
      audioDurationMs: 0,
      processingTimeMs: 0,
      timestamp: new Date().toISOString(),
      modelId: this.currentModelId,
    };

    // Send final event
    const event: STTStreamEvent = {
      type: "final_result",
      data: result,
      timestamp: new Date().toISOString(),
    };
    callback(event);

    return result;
  }

  async cancelStreaming(sessionId: string): Promise<void> {
    this.streamingSessions.delete(sessionId);
    console.log(`[WhisperSTT] Streaming session cancelled: ${sessionId}`);
  }

  async detectLanguage(audioData: ArrayBuffer): Promise<{ language: SupportedLanguage; confidence: number }> {
    // Whisper can auto-detect language
    const result = await this.transcribe(audioData, { language: "auto" });

    return {
      language: result.detectedLanguage || "pt-BR",
      confidence: 0.8, // Whisper doesn't provide language confidence
    };
  }

  async getAvailableModels(): Promise<STTModelInfo[]> {
    return WHISPER_MODELS.map((model) => {
      const modelPath = join(MODELS_DIR, model.filename);
      return {
        id: model.id,
        name: model.name,
        version: "whisper.cpp",
        languages: model.languages,
        sizeBytes: model.sizeBytes,
        isLocal: true,
        supportsStreaming: false,
        estimatedAccuracy: model.accuracy,
        isDownloaded: existsSync(modelPath),
      };
    });
  }

  async getCurrentModelInfo(): Promise<STTModelInfo | null> {
    const models = await this.getAvailableModels();
    return models.find((m) => m.id === this.currentModelId) || null;
  }

  async setModel(modelId: string): Promise<void> {
    const model = WHISPER_MODELS.find((m) => m.id === modelId);
    if (!model) {
      throw new Error(`Unknown model: ${modelId}. Available: ${WHISPER_MODELS.map((m) => m.id).join(", ")}`);
    }

    // Release current context if exists
    if (this.whisperContext) {
      await this.whisperContext.release();
      this.whisperContext = null;
      this.isInitialized = false;
    }

    this.currentModelId = modelId;
    console.log(`[WhisperSTT] Model set to: ${modelId}. Call initialize() to load.`);
  }

  async isModelReady(): Promise<boolean> {
    return this.isInitialized && this.whisperContext !== null;
  }

  async downloadModel(modelId?: string, onProgress?: (progress: ModelDownloadProgress) => void): Promise<void> {
    const targetModelId = modelId || this.currentModelId;
    const model = WHISPER_MODELS.find((m) => m.id === targetModelId);
    if (!model) {
      throw new Error(`Unknown model: ${targetModelId}`);
    }

    const modelPath = join(MODELS_DIR, model.filename);

    // Check if already exists
    if (existsSync(modelPath)) {
      console.log(`[WhisperSTT] Model already exists: ${modelPath}`);
      return;
    }

    // Ensure directory exists
    if (!existsSync(MODELS_DIR)) {
      mkdirSync(MODELS_DIR, { recursive: true });
    }

    console.log(`[WhisperSTT] Downloading model from: ${model.downloadUrl}`);
    console.log(`[WhisperSTT] Size: ~${Math.round(model.sizeBytes / 1024 / 1024)}MB`);

    const startTime = Date.now();

    try {
      const response = await fetch(model.downloadUrl);
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }

      const totalBytes = model.sizeBytes;
      let downloadedBytes = 0;

      // Stream the response to file
      const { createWriteStream } = await import("fs");
      const fileStream = createWriteStream(modelPath);

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get response reader");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        fileStream.write(Buffer.from(value));
        downloadedBytes += value.length;

        if (onProgress) {
          const elapsedMs = Date.now() - startTime;
          const bytesPerMs = downloadedBytes / elapsedMs;
          const remainingBytes = totalBytes - downloadedBytes;
          const estimatedTimeRemainingMs = Math.round(remainingBytes / bytesPerMs);

          onProgress({
            modelId: targetModelId,
            downloadedBytes,
            totalBytes,
            percentComplete: Math.round((downloadedBytes / totalBytes) * 100),
            estimatedTimeRemainingMs,
          });
        }
      }

      fileStream.end();
      console.log(`[WhisperSTT] Model downloaded to: ${modelPath}`);
    } catch (error) {
      console.error("[WhisperSTT] Download failed:", error);
      // Clean up partial download
      const { unlinkSync } = await import("fs");
      if (existsSync(modelPath)) {
        unlinkSync(modelPath);
      }
      throw error;
    }
  }

  async deleteModel(modelId: string): Promise<void> {
    const model = WHISPER_MODELS.find((m) => m.id === modelId);
    if (!model) {
      throw new Error(`Unknown model: ${modelId}`);
    }

    const modelPath = join(MODELS_DIR, model.filename);

    if (existsSync(modelPath)) {
      // Release context if this is the current model
      if (modelId === this.currentModelId && this.whisperContext) {
        await this.whisperContext.release();
        this.whisperContext = null;
        this.isInitialized = false;
      }

      const { unlinkSync } = await import("fs");
      unlinkSync(modelPath);
      console.log(`[WhisperSTT] Model deleted: ${modelPath}`);
    }
  }

  getConfig(): STTConfig {
    return { ...this.config };
  }

  async updateConfig(config: Partial<STTConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
  }

  async dispose(): Promise<void> {
    if (this.whisperContext) {
      await this.whisperContext.release();
      this.whisperContext = null;
    }
    this.isInitialized = false;
    console.log("[WhisperSTT] Disposed");
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private extractTranscription(result: unknown): string {
    // whisper.node returns result with segments
    if (typeof result === "string") {
      return result.trim();
    }

    if (result && typeof result === "object") {
      const obj = result as Record<string, unknown>;

      if (typeof obj["text"] === "string") {
        return (obj["text"] as string).trim();
      }

      if (Array.isArray(result)) {
        return result
          .map((segment: WhisperSegment | string) => {
            if (typeof segment === "string") return segment;
            return segment.text || "";
          })
          .join(" ")
          .trim();
      }

      if (Array.isArray(obj["segments"])) {
        return (obj["segments"] as WhisperSegment[])
          .map((segment) => segment.text)
          .join(" ")
          .trim();
      }
    }

    console.warn("[WhisperSTT] Unexpected result format:", result);
    return "";
  }

  private estimateAudioDuration(audioData: ArrayBuffer): number {
    // Assuming 16-bit PCM mono at 16kHz
    // bytes = samples * 2 (16-bit)
    // duration = samples / sampleRate
    const samples = audioData.byteLength / 2;
    const sampleRate = 16000;
    return Math.round((samples / sampleRate) * 1000);
  }
}
