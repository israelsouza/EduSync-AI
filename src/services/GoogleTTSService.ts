/**
 * Google TTS Service Implementation
 *
 * Uses Google Cloud Text-to-Speech API for speech synthesis.
 * Provides high-quality voice output for the Sunita persona.
 *
 * @module GoogleTTSService
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
import { env } from "../config/env.js";

/**
 * Voice mapping for Google TTS
 * Maps our voice IDs to Google's voice names
 */
const GOOGLE_VOICE_MAP: Record<string, { name: string; languageCode: string }> = {
  // Portuguese Brazilian voices
  "sunita-pt-br": { name: "pt-BR-Wavenet-A", languageCode: "pt-BR" }, // Female, friendly
  "sunita-pt-br-alt": { name: "pt-BR-Wavenet-B", languageCode: "pt-BR" }, // Male alternative
  "pt-br-standard": { name: "pt-BR-Standard-A", languageCode: "pt-BR" },

  // Spanish Latin America voices
  "sunita-es-419": { name: "es-US-Wavenet-A", languageCode: "es-US" }, // Female
  "es-419-standard": { name: "es-US-Standard-A", languageCode: "es-US" },

  // Spanish Mexico voices
  "sunita-es-mx": { name: "es-US-Wavenet-A", languageCode: "es-US" },

  // English US voices
  "sunita-en-us": { name: "en-US-Wavenet-F", languageCode: "en-US" }, // Female, friendly
  "en-us-standard": { name: "en-US-Standard-C", languageCode: "en-US" },
};

/**
 * Available voice profiles
 */
const AVAILABLE_VOICES: VoiceProfile[] = [
  {
    id: "sunita-pt-br",
    name: "Sunita (Português)",
    language: "pt-BR",
    gender: "female",
    ageCategory: "adult",
    style: "friendly",
    isLocal: false,
    qualityRating: 5,
  },
  {
    id: "sunita-es-419",
    name: "Sunita (Español)",
    language: "es-419",
    gender: "female",
    ageCategory: "adult",
    style: "friendly",
    isLocal: false,
    qualityRating: 5,
  },
  {
    id: "sunita-en-us",
    name: "Sunita (English)",
    language: "en-US",
    gender: "female",
    ageCategory: "adult",
    style: "friendly",
    isLocal: false,
    qualityRating: 5,
  },
  {
    id: "pt-br-standard",
    name: "Standard (Português)",
    language: "pt-BR",
    gender: "female",
    ageCategory: "adult",
    style: "professional",
    isLocal: false,
    qualityRating: 3,
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
 * Google Cloud Text-to-Speech Service
 *
 * Note: This implementation uses the REST API directly for simplicity.
 * For production, consider using the official @google-cloud/text-to-speech SDK.
 */
export class GoogleTTSService implements ITTSService {
  private config: TTSConfig;
  private apiKey: string;
  private currentVoiceId: string;
  private playbackState: PlaybackState = "idle";
  private cache = new Map<string, CacheEntry>();
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor() {
    this.apiKey = env.googleApiKey;
    this.config = { ...DEFAULT_TTS_CONFIG };
    this.currentVoiceId = this.config.defaultVoiceId;
  }

  async initialize(config?: Partial<TTSConfig>): Promise<boolean> {
    if (config) {
      this.config = { ...this.config, ...config };
      if (config.defaultVoiceId) {
        this.currentVoiceId = config.defaultVoiceId;
      }
    }

    // Validate API key
    if (!this.apiKey) {
      console.warn("[GoogleTTS] No API key configured. TTS will not work.");
      return false;
    }

    console.log(`[GoogleTTS] Initialized with voice: ${this.currentVoiceId}`);
    return true;
  }

  async synthesize(text: string, options?: Partial<TTSSynthesisOptions>): Promise<SynthesisResult> {
    const activeOptions = { ...DEFAULT_TTS_OPTIONS, ...this.config.defaultOptions, ...options };
    const startTime = Date.now();

    // Check text length
    if (text.length > this.config.maxTextLength) {
      throw new Error(`Text too long: ${text.length} > ${this.config.maxTextLength} characters`);
    }

    // Preprocess text if enabled
    const processedText = this.config.enablePreprocessing ? this.preprocessText(text) : text;

    // Check cache
    if (this.config.enableCaching) {
      const cacheKey = this.getCacheKey(processedText, activeOptions);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.cacheHits++;
        cached.accessCount++;
        cached.lastAccessed = Date.now();
        console.log(`[GoogleTTS] Cache hit for text: "${processedText.substring(0, 50)}..."`);
        return { ...cached.result, fromCache: true };
      }
      this.cacheMisses++;
    }

    // Get voice configuration (with guaranteed fallback)
    const voiceConfig = GOOGLE_VOICE_MAP[activeOptions.voiceId] ??
      GOOGLE_VOICE_MAP["sunita-pt-br"] ?? { name: "pt-BR-Wavenet-A", languageCode: "pt-BR" };

    // Build request
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.apiKey}`;

    const requestBody = {
      input: activeOptions.enableSSML ? { ssml: processedText } : { text: processedText },
      voice: {
        languageCode: voiceConfig.languageCode,
        name: voiceConfig.name,
      },
      audioConfig: {
        audioEncoding: this.getGoogleAudioEncoding(activeOptions.outputFormat),
        sampleRateHertz: activeOptions.sampleRate,
        speakingRate: activeOptions.rate,
        pitch: activeOptions.pitch * 20, // Google uses -20.0 to 20.0 scale
        volumeGainDb: (activeOptions.volume - 1) * 10, // Convert 0-1 to dB gain
      },
    };

    console.log(`[GoogleTTS] Synthesizing: "${processedText.substring(0, 50)}..." with voice ${voiceConfig.name}`);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { error?: { message?: string } };
        throw new Error(`Google TTS Error: ${errorData.error?.message || response.statusText}`);
      }

      const data = (await response.json()) as { audioContent: string };

      // Decode base64 audio
      const audioBuffer = Buffer.from(data.audioContent, "base64");
      const audioData = audioBuffer.buffer.slice(audioBuffer.byteOffset, audioBuffer.byteOffset + audioBuffer.byteLength);

      const processingTimeMs = Date.now() - startTime;

      // Estimate duration (rough estimate based on text length and speech rate)
      const wordsPerMinute = 150 * activeOptions.rate;
      const wordCount = processedText.split(/\s+/).length;
      const estimatedDurationMs = (wordCount / wordsPerMinute) * 60 * 1000;

      const result: SynthesisResult = {
        id: `tts_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        audioData,
        format: activeOptions.outputFormat,
        sampleRate: activeOptions.sampleRate,
        durationMs: estimatedDurationMs,
        text: processedText,
        voiceId: activeOptions.voiceId,
        processingTimeMs,
        fromCache: false,
        timestamp: new Date().toISOString(),
      };

      // Store in cache
      if (this.config.enableCaching) {
        this.addToCache(processedText, activeOptions, result);
      }

      console.log(`[GoogleTTS] Synthesis complete in ${processingTimeMs}ms, ~${Math.round(estimatedDurationMs)}ms audio`);
      return result;
    } catch (error) {
      console.error("[GoogleTTS] Synthesis failed:", error);
      throw error;
    }
  }

  async synthesizeWithTimings(text: string, options?: Partial<TTSSynthesisOptions>): Promise<SynthesisResultWithTimings> {
    // Google TTS REST API doesn't provide word timings directly
    // For full support, would need to use the streaming API or a different service
    const result = await this.synthesize(text, options);

    // Generate estimated word timings
    const words = text.split(/\s+/);
    const avgWordDurationMs = result.durationMs / words.length;
    const wordTimings = words.map((word, index) => ({
      word,
      startTimeMs: index * avgWordDurationMs,
      endTimeMs: (index + 1) * avgWordDurationMs,
    }));

    return {
      ...result,
      wordTimings,
    };
  }

  async speak(text: string, options?: Partial<TTSSynthesisOptions>, callback?: PlaybackCallback): Promise<string> {
    // In Node.js backend, we don't have direct audio playback
    // This would be handled by the client/frontend
    const result = await this.synthesize(text, options);

    // In a real implementation, this would stream to audio output
    // For now, just return the synthesis result ID
    console.log(`[GoogleTTS] speak() called - audio playback should be handled by client`);
    void callback; // Acknowledge unused param

    return result.id;
  }

  async play(synthesisResult: SynthesisResult, callback?: PlaybackCallback): Promise<string> {
    // Backend doesn't handle audio playback
    console.log(`[GoogleTTS] play() called - audio playback should be handled by client`);
    void synthesisResult; // Acknowledge unused param
    void callback; // Acknowledge unused param
    return `playback_${Date.now()}`;
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
    return 0; // Backend doesn't track playback position
  }

  async seek(positionMs: number): Promise<void> {
    // Not implemented in backend
    void positionMs;
  }

  async getAvailableVoices(language?: SupportedLanguage): Promise<VoiceProfile[]> {
    if (language) {
      return AVAILABLE_VOICES.filter((v) => v.language === language);
    }
    return AVAILABLE_VOICES;
  }

  async getCurrentVoice(): Promise<VoiceProfile | null> {
    return AVAILABLE_VOICES.find((v) => v.id === this.currentVoiceId) || null;
  }

  async setVoice(voiceId: string): Promise<void> {
    if (!GOOGLE_VOICE_MAP[voiceId]) {
      throw new Error(`Voice not found: ${voiceId}`);
    }
    this.currentVoiceId = voiceId;
    this.config.defaultVoiceId = voiceId;
    console.log(`[GoogleTTS] Voice set to: ${voiceId}`);
  }

  async isModelReady(): Promise<boolean> {
    return !!this.apiKey;
  }

  async downloadVoice(voiceId: string, onProgress?: (progress: TTSModelDownloadProgress) => void): Promise<void> {
    // Google TTS is cloud-based, no download needed
    console.log(`[GoogleTTS] downloadVoice() - Google TTS is cloud-based, no download needed`);
    void voiceId;
    void onProgress;
  }

  async deleteVoice(voiceId: string): Promise<void> {
    // No local voices to delete
    void voiceId;
  }

  getConfig(): TTSConfig {
    return { ...this.config };
  }

  async updateConfig(config: Partial<TTSConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    if (config.defaultVoiceId) {
      this.currentVoiceId = config.defaultVoiceId;
    }
  }

  async clearCache(): Promise<void> {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    console.log(`[GoogleTTS] Cache cleared`);
  }

  async getCacheStats(): Promise<{ entries: number; sizeBytes: number; hitRate: number }> {
    let sizeBytes = 0;
    for (const entry of this.cache.values()) {
      sizeBytes += entry.result.audioData.byteLength;
    }

    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;

    return {
      entries: this.cache.size,
      sizeBytes,
      hitRate,
    };
  }

  async dispose(): Promise<void> {
    await this.clearCache();
    this.playbackState = "idle";
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private preprocessText(text: string): string {
    // Normalize numbers, abbreviations, etc.
    let processed = text;

    // Expand common educational abbreviations
    const abbreviations: Record<string, string> = {
      "prof.": "professor",
      "profa.": "professora",
      "pág.": "página",
      "págs.": "páginas",
      "ex.": "exemplo",
      "etc.": "et cetera",
      "obs.": "observação",
      "min.": "minutos",
      "h.": "horas",
    };

    for (const [abbr, full] of Object.entries(abbreviations)) {
      processed = processed.replace(new RegExp(abbr.replace(".", "\\."), "gi"), full);
    }

    // Clean up multiple spaces
    processed = processed.replace(/\s+/g, " ").trim();

    return processed;
  }

  private getCacheKey(text: string, options: TTSSynthesisOptions): string {
    return `${text}_${options.voiceId}_${options.rate}_${options.pitch}`;
  }

  private addToCache(text: string, options: TTSSynthesisOptions, result: SynthesisResult): void {
    const cacheKey = this.getCacheKey(text, options);

    // Check if we need to evict entries
    const currentSize = this.getCacheSizeSync();
    if (currentSize + result.audioData.byteLength > this.config.maxCacheSize) {
      this.evictLRU();
    }

    this.cache.set(cacheKey, {
      result,
      accessCount: 1,
      lastAccessed: Date.now(),
    });
  }

  private getCacheSizeSync(): number {
    let size = 0;
    for (const entry of this.cache.values()) {
      size += entry.result.audioData.byteLength;
    }
    return size;
  }

  private evictLRU(): void {
    // Find and remove least recently used entry
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldest = key;
      }
    }

    if (oldest) {
      this.cache.delete(oldest);
      console.log(`[GoogleTTS] Evicted cache entry (LRU)`);
    }
  }

  private getGoogleAudioEncoding(format: TTSSynthesisOptions["outputFormat"]): string {
    switch (format) {
      case "mp3":
        return "MP3";
      case "wav":
        return "LINEAR16";
      case "opus":
        return "OGG_OPUS";
      case "pcm":
      default:
        return "LINEAR16";
    }
  }
}
