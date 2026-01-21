/**
 * Piper TTS Service Implementation
 *
 * Uses tts-pipelines with ONNX Runtime for offline text-to-speech synthesis.
 * Provides local voice output without internet connectivity.
 *
 * @module PiperTTSService
 */

import {
  ITTSService,
  TTSConfig,
  TTSSynthesisOptions,
  SynthesisResult,
  SynthesisResultWithTimings,
  VoiceProfile,
  PlaybackState,
  PlaybackCallback,
  TTSModelDownloadProgress,
  DEFAULT_TTS_CONFIG,
  DEFAULT_TTS_OPTIONS,
} from "../interface/ITTSService.js";
import { SupportedLanguage } from "../interface/ISTTService.js";
import * as crypto from "crypto";

// Dynamic import for tts-pipelines (ESM module)
let PiperTTS: unknown = null;
let TextSplitterStream: unknown = null;

/**
 * Voice mapping for Piper TTS
 * Maps our voice IDs to Piper model names
 * See: https://rhasspy.github.io/piper-samples/
 */
const PIPER_VOICE_MAP: Record<string, { modelId: string; language: SupportedLanguage }> = {
  // Portuguese Brazilian voices
  "sunita-pt-br": { modelId: "pt_BR-faber-medium", language: "pt-BR" },
  "pt-br-edresson": { modelId: "pt_BR-edresson-low", language: "pt-BR" },

  // Spanish voices (using es_MX as closest to Latin America)
  "sunita-es-419": { modelId: "es_MX-ald-medium", language: "es-419" },
  "es-mx-claude": { modelId: "es_MX-claude-high", language: "es-419" },

  // English US voices
  "sunita-en-us": { modelId: "en_US-amy-medium", language: "en-US" },
  "en-us-lessac": { modelId: "en_US-lessac-medium", language: "en-US" },

  // Default fallback (English)
  default: { modelId: "en_US-amy-medium", language: "en-US" },
};

/**
 * Available voice profiles for Piper TTS
 */
const AVAILABLE_VOICES: VoiceProfile[] = [
  {
    id: "sunita-pt-br",
    name: "Sunita (Português - Local)",
    language: "pt-BR",
    gender: "female",
    ageCategory: "adult",
    style: "friendly",
    isLocal: true,
    qualityRating: 4,
  },
  {
    id: "sunita-es-419",
    name: "Sunita (Español - Local)",
    language: "es-419",
    gender: "female",
    ageCategory: "adult",
    style: "friendly",
    isLocal: true,
    qualityRating: 4,
  },
  {
    id: "sunita-en-us",
    name: "Sunita (English - Local)",
    language: "en-US",
    gender: "female",
    ageCategory: "adult",
    style: "friendly",
    isLocal: true,
    qualityRating: 4,
  },
  {
    id: "pt-br-edresson",
    name: "Edresson (Português - Local)",
    language: "pt-BR",
    gender: "male",
    ageCategory: "adult",
    style: "professional",
    isLocal: true,
    qualityRating: 3,
  },
  {
    id: "en-us-lessac",
    name: "Lessac (English - Local)",
    language: "en-US",
    gender: "female",
    ageCategory: "adult",
    style: "professional",
    isLocal: true,
    qualityRating: 4,
  },
];

/**
 * Simple in-memory cache for synthesized audio
 */
interface CacheEntry {
  result: SynthesisResult;
  accessCount: number;
  lastAccessed: number;
}

/**
 * Piper TTS Service using tts-pipelines
 *
 * Provides offline text-to-speech synthesis using ONNX Runtime.
 * Models are downloaded and cached locally for offline use.
 */
export class PiperTTSService implements ITTSService {
  private config: TTSConfig;
  private currentVoiceId: string;
  private playbackState: PlaybackState = "idle";
  private cache = new Map<string, CacheEntry>();
  private cacheHits = 0;
  private cacheMisses = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ttsInstance: any = null;
  private isInitialized = false;
  private downloadedVoices = new Set<string>();

  constructor() {
    this.config = {
      ...DEFAULT_TTS_CONFIG,
      defaultVoiceId: "sunita-en-us", // Use English as default (most tested)
    };
    this.currentVoiceId = this.config.defaultVoiceId;
  }

  /**
   * Initialize the TTS service and load required modules
   */
  async initialize(config?: Partial<TTSConfig>): Promise<boolean> {
    if (config) {
      this.config = { ...this.config, ...config };
      if (config.defaultVoiceId) {
        this.currentVoiceId = config.defaultVoiceId;
      }
    }

    try {
      // Dynamic import of tts-pipelines
      if (!PiperTTS) {
        const ttsPipelines = await import("tts-pipelines");
        PiperTTS = ttsPipelines.PiperTTS;
        TextSplitterStream = ttsPipelines.TextSplitterStream;
      }

      // Initialize Piper TTS instance
      console.log("[PiperTTS] Initializing with from_pretrained...");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.ttsInstance = await (PiperTTS as any).from_pretrained();
      this.isInitialized = true;
      console.log(`[PiperTTS] Initialized successfully with voice: ${this.currentVoiceId}`);
      return true;
    } catch (error) {
      console.error("[PiperTTS] Failed to initialize:", error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Synthesize text to speech
   */
  async synthesize(text: string, options?: Partial<TTSSynthesisOptions>): Promise<SynthesisResult> {
    if (!this.isInitialized || !this.ttsInstance) {
      throw new Error("PiperTTS not initialized. Call initialize() first.");
    }

    const activeOptions = { ...DEFAULT_TTS_OPTIONS, ...this.config.defaultOptions, ...options };
    const startTime = Date.now();

    // Check text length
    if (text.length > this.config.maxTextLength) {
      throw new Error(`Text too long: ${text.length} > ${this.config.maxTextLength} characters`);
    }

    // Preprocess text
    const processedText = this.config.enablePreprocessing ? this.preprocessText(text) : text;

    // Check cache
    const cacheKey = this.generateCacheKey(processedText, activeOptions);
    if (this.config.enableCaching) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.cacheHits++;
        cached.accessCount++;
        cached.lastAccessed = Date.now();
        console.log(`[PiperTTS] Cache hit for: "${processedText.substring(0, 50)}..."`);
        return { ...cached.result, fromCache: true };
      }
      this.cacheMisses++;
    }

    try {
      // Use TextSplitterStream for streaming synthesis
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const streamer = new (TextSplitterStream as any)();
      streamer.push(processedText);
      streamer.close();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = (this.ttsInstance as any).stream(streamer);
      const chunks: unknown[] = [];

      // Collect all audio chunks
      for await (const { audio } of stream) {
        chunks.push(audio);
      }

      // Merge audio chunks
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mergedAudio = await (this.ttsInstance as any).merge_audio();
      if (!mergedAudio) {
        throw new Error("Failed to merge audio chunks");
      }

      // Convert blob to ArrayBuffer
      const audioBlob = mergedAudio.toBlob();
      const audioBuffer = await this.blobToArrayBuffer(audioBlob);

      // Clear TTS audio buffer for next synthesis
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.ttsInstance as any).clearAudio();

      const processingTimeMs = Date.now() - startTime;

      // Estimate duration based on text length (rough approximation)
      // Average speaking rate is ~150 words per minute = 2.5 words/second
      const wordCount = processedText.split(/\s+/).length;
      const estimatedDurationMs = (wordCount / 2.5) * 1000;

      const result: SynthesisResult = {
        id: `piper_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        audioData: audioBuffer,
        format: "wav", // tts-pipelines outputs WAV
        sampleRate: 22050, // Piper default
        durationMs: estimatedDurationMs,
        text: processedText,
        voiceId: activeOptions.voiceId || this.currentVoiceId,
        processingTimeMs,
        fromCache: false,
        timestamp: new Date().toISOString(),
      };

      // Store in cache
      if (this.config.enableCaching) {
        this.addToCache(cacheKey, result);
      }

      console.log(`[PiperTTS] Synthesized ${processedText.length} chars in ${processingTimeMs}ms`);
      return result;
    } catch (error) {
      console.error("[PiperTTS] Synthesis failed:", error);
      throw new Error(`Piper TTS synthesis failed: ${(error as Error).message}`);
    }
  }

  /**
   * Synthesize text with word timings (limited support)
   */
  async synthesizeWithTimings(text: string, options?: Partial<TTSSynthesisOptions>): Promise<SynthesisResultWithTimings> {
    // Piper TTS doesn't provide word-level timings natively
    // We'll estimate based on text length
    const result = await this.synthesize(text, options);

    const words = text.split(/\s+/);
    const avgTimePerWord = result.durationMs / words.length;
    let currentTime = 0;

    const wordTimings = words.map((word) => {
      const timing = {
        word,
        startTimeMs: Math.round(currentTime),
        endTimeMs: Math.round(currentTime + avgTimePerWord),
      };
      currentTime += avgTimePerWord;
      return timing;
    });

    return {
      ...result,
      wordTimings,
    };
  }

  /**
   * Speak text immediately (synthesize + return audio)
   */
  async speak(text: string, options?: Partial<TTSSynthesisOptions>, callback?: PlaybackCallback): Promise<string> {
    const sessionId = `playback_${Date.now()}`;

    try {
      this.playbackState = "playing";
      callback?.({
        type: "start",
        timestamp: new Date().toISOString(),
      });

      const result = await this.synthesize(text, options);

      callback?.({
        type: "complete",
        durationMs: result.durationMs,
        timestamp: new Date().toISOString(),
      });

      this.playbackState = "idle";
      return sessionId;
    } catch (error) {
      this.playbackState = "idle";
      callback?.({
        type: "error",
        error: {
          type: "synthesis_failed",
          message: (error as Error).message,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Play synthesized audio (server-side - returns audio data)
   */
  async play(synthesisResult: SynthesisResult, callback?: PlaybackCallback): Promise<string> {
    const sessionId = `playback_${Date.now()}`;
    this.playbackState = "playing";

    callback?.({
      type: "start",
      durationMs: synthesisResult.durationMs,
      timestamp: new Date().toISOString(),
    });

    // Server-side doesn't actually play audio
    // Just simulate playback completion
    callback?.({
      type: "complete",
      durationMs: synthesisResult.durationMs,
      timestamp: new Date().toISOString(),
    });

    this.playbackState = "idle";
    return sessionId;
  }

  async pause(): Promise<void> {
    this.playbackState = "paused";
  }

  async resume(): Promise<void> {
    this.playbackState = "playing";
  }

  async stop(): Promise<void> {
    this.playbackState = "stopped";
  }

  getPlaybackState(): PlaybackState {
    return this.playbackState;
  }

  getPlaybackPosition(): number {
    return 0; // Not applicable for server-side
  }

  // Not applicable for server-side
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async seek(_positionMs: number): Promise<void> {
    // noop
  }

  /**
   * Get available voice profiles
   */
  async getAvailableVoices(language?: SupportedLanguage): Promise<VoiceProfile[]> {
    if (language) {
      return AVAILABLE_VOICES.filter((v) => v.language === language);
    }
    return AVAILABLE_VOICES;
  }

  /**
   * Get current voice profile
   */
  async getCurrentVoice(): Promise<VoiceProfile | null> {
    return AVAILABLE_VOICES.find((v) => v.id === this.currentVoiceId) || null;
  }

  /**
   * Set active voice
   */
  async setVoice(voiceId: string): Promise<void> {
    const voice = AVAILABLE_VOICES.find((v) => v.id === voiceId);
    if (!voice) {
      throw new Error(`Voice not found: ${voiceId}`);
    }
    this.currentVoiceId = voiceId;
    console.log(`[PiperTTS] Voice set to: ${voiceId}`);
  }

  /**
   * Check if TTS model is ready
   */
  async isModelReady(): Promise<boolean> {
    return this.isInitialized && this.ttsInstance !== null;
  }

  /**
   * Download TTS voice for offline use
   * Note: tts-pipelines handles model downloads automatically
   */
  async downloadVoice(voiceId: string, onProgress?: (progress: TTSModelDownloadProgress) => void): Promise<void> {
    const voiceMapping = PIPER_VOICE_MAP[voiceId] ?? PIPER_VOICE_MAP["default"];
    if (!voiceMapping) {
      throw new Error(`Voice mapping not found for ${voiceId}`);
    }

    console.log(`[PiperTTS] Downloading voice: ${voiceId} (model: ${voiceMapping.modelId})`);

    onProgress?.({
      modelId: voiceMapping.modelId,
      voiceId,
      downloadedBytes: 0,
      totalBytes: 100 * 1024 * 1024, // Estimate ~100MB
      percentComplete: 0,
      estimatedTimeRemainingMs: 60000,
    });

    // tts-pipelines downloads models automatically on first use
    // We'll trigger a small synthesis to download the model
    try {
      if (this.ttsInstance) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const streamer = new (TextSplitterStream as any)();
        streamer.push("Test");
        streamer.close();

        // eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/no-explicit-any
        for await (const _unused of (this.ttsInstance as any).stream(streamer)) {
          // Just trigger the download
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.ttsInstance as any).clearAudio();
      }

      this.downloadedVoices.add(voiceId);

      onProgress?.({
        modelId: voiceMapping.modelId,
        voiceId,
        downloadedBytes: 100 * 1024 * 1024,
        totalBytes: 100 * 1024 * 1024,
        percentComplete: 100,
        estimatedTimeRemainingMs: 0,
      });

      console.log(`[PiperTTS] Voice downloaded: ${voiceId}`);
    } catch (error) {
      console.error(`[PiperTTS] Failed to download voice ${voiceId}:`, error);
      throw error;
    }
  }

  /**
   * Delete downloaded voice
   */
  async deleteVoice(voiceId: string): Promise<void> {
    // tts-pipelines manages its own storage
    this.downloadedVoices.delete(voiceId);
    console.log(`[PiperTTS] Voice marked as deleted: ${voiceId}`);
  }

  /**
   * Get current configuration
   */
  getConfig(): TTSConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<TTSConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    if (config.defaultVoiceId) {
      this.currentVoiceId = config.defaultVoiceId;
    }
  }

  /**
   * Clear synthesis cache
   */
  async clearCache(): Promise<void> {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    console.log("[PiperTTS] Cache cleared");
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ entries: number; sizeBytes: number; hitRate: number }> {
    let sizeBytes = 0;
    for (const entry of this.cache.values()) {
      sizeBytes += entry.result.audioData.byteLength;
    }

    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? this.cacheHits / total : 0;

    return {
      entries: this.cache.size,
      sizeBytes,
      hitRate,
    };
  }

  /**
   * Release all resources
   */
  async dispose(): Promise<void> {
    await this.clearCache();
    if (this.ttsInstance) {
      this.ttsInstance.clearAudio();
      this.ttsInstance = null;
    }
    this.isInitialized = false;
    console.log("[PiperTTS] Resources disposed");
  }

  // ==================== Private Helper Methods ====================

  /**
   * Preprocess text for better TTS output
   */
  private preprocessText(text: string): string {
    let processed = text;

    // Expand common educational abbreviations (Portuguese/Spanish/English)
    const abbreviations: Record<string, string> = {
      "prof.": "professor",
      "profa.": "professora",
      "dr.": "doutor",
      "dra.": "doutora",
      "sr.": "senhor",
      "sra.": "senhora",
      "etc.": "etcétera",
      "ex.": "exemplo",
      "pág.": "página",
      "págs.": "páginas",
      nº: "número",
      "vol.": "volume",
    };

    for (const [abbr, full] of Object.entries(abbreviations)) {
      processed = processed.replace(new RegExp(abbr.replace(".", "\\."), "gi"), full);
    }

    // Handle numbers with ordinal suffixes
    processed = processed.replace(/(\d+)º/g, "$1 grau");
    processed = processed.replace(/(\d+)ª/g, "$1 série");

    // Normalize whitespace
    processed = processed.replace(/\s+/g, " ").trim();

    return processed;
  }

  /**
   * Generate cache key for synthesis request
   */
  private generateCacheKey(text: string, options: TTSSynthesisOptions): string {
    const keyData = `${text}|${options.voiceId}|${options.rate}|${options.pitch}`;
    return crypto.createHash("md5").update(keyData).digest("hex");
  }

  /**
   * Add result to cache with LRU eviction
   */
  private addToCache(key: string, result: SynthesisResult): void {
    // Check if adding would exceed cache size
    let currentSize = 0;
    for (const entry of this.cache.values()) {
      currentSize += entry.result.audioData.byteLength;
    }

    // Evict entries if needed (LRU strategy)
    while (currentSize + result.audioData.byteLength > this.config.maxCacheSize && this.cache.size > 0) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;

      for (const [k, v] of this.cache.entries()) {
        if (v.lastAccessed < oldestTime) {
          oldestTime = v.lastAccessed;
          oldestKey = k;
        }
      }

      if (oldestKey) {
        const evicted = this.cache.get(oldestKey);
        if (evicted) {
          currentSize -= evicted.result.audioData.byteLength;
        }
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      result,
      accessCount: 1,
      lastAccessed: Date.now(),
    });
  }

  /**
   * Convert Blob to ArrayBuffer
   */
  private async blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return await blob.arrayBuffer();
  }
}
