/**
 * Text-to-Speech Service Interface
 *
 * Provides speech synthesis capabilities for the voice assistant.
 * Designed for natural, pedagogical voice output.
 *
 * @module ITTSService
 * @description Core interface for text-to-speech in EduSync-AI
 */

import { SupportedLanguage } from "./ISTTService.js";

/**
 * Voice characteristics
 */
export interface VoiceProfile {
  /** Unique voice identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Language of the voice */
  language: SupportedLanguage;
  /** Voice gender */
  gender: "female" | "male" | "neutral";
  /** Voice age category */
  ageCategory: "child" | "young" | "adult" | "senior";
  /** Voice style (calm, energetic, etc.) */
  style: "calm" | "friendly" | "professional" | "energetic";
  /** Whether this is a local (offline) voice */
  isLocal: boolean;
  /** Voice quality rating (1-5) */
  qualityRating: number;
  /** Sample audio URL (if available) */
  sampleUrl?: string;
}

/**
 * Speech synthesis options
 */
export interface TTSSynthesisOptions {
  /** Target voice profile ID */
  voiceId: string;
  /** Speech rate (0.5 = half speed, 1.0 = normal, 2.0 = double) */
  rate: number;
  /** Pitch adjustment (-1.0 to 1.0, 0 = normal) */
  pitch: number;
  /** Volume (0.0 to 1.0) */
  volume: number;
  /** Output audio format */
  outputFormat: "pcm" | "wav" | "mp3" | "opus";
  /** Sample rate for output */
  sampleRate: number;
  /** Enable SSML processing */
  enableSSML: boolean;
}

/**
 * TTS configuration
 */
export interface TTSConfig {
  /** Default voice profile ID */
  defaultVoiceId: string;
  /** Default language */
  language: SupportedLanguage;
  /** Default synthesis options */
  defaultOptions: TTSSynthesisOptions;
  /** Maximum text length (characters) */
  maxTextLength: number;
  /** Enable text preprocessing (normalize numbers, abbreviations) */
  enablePreprocessing: boolean;
  /** Cache synthesized audio */
  enableCaching: boolean;
  /** Maximum cache size (bytes) */
  maxCacheSize: number;
}

/**
 * Synthesized speech result
 */
export interface SynthesisResult {
  /** Unique identifier for this synthesis */
  id: string;
  /** Audio data */
  audioData: ArrayBuffer;
  /** Audio format */
  format: TTSSynthesisOptions["outputFormat"];
  /** Sample rate */
  sampleRate: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Original text */
  text: string;
  /** Voice used */
  voiceId: string;
  /** Processing time (ms) */
  processingTimeMs: number;
  /** Whether result was from cache */
  fromCache: boolean;
  /** Timestamp */
  timestamp: string;
}

/**
 * Word timing for synchronized display
 */
export interface WordTiming {
  /** The word */
  word: string;
  /** Start time in milliseconds */
  startTimeMs: number;
  /** End time in milliseconds */
  endTimeMs: number;
}

/**
 * Extended synthesis result with word timings
 */
export interface SynthesisResultWithTimings extends SynthesisResult {
  /** Word-level timings for synchronized display */
  wordTimings: WordTiming[];
}

/**
 * TTS error types
 */
export type TTSErrorType =
  | "voice_not_found"
  | "model_not_loaded"
  | "model_download_failed"
  | "text_too_long"
  | "synthesis_failed"
  | "invalid_ssml"
  | "playback_failed"
  | "unknown";

/**
 * TTS error
 */
export interface TTSError {
  type: TTSErrorType;
  message: string;
  originalError?: Error;
  timestamp: string;
}

/**
 * Playback state
 */
export type PlaybackState = "idle" | "playing" | "paused" | "stopped";

/**
 * Playback event types
 */
export type PlaybackEventType = "start" | "pause" | "resume" | "stop" | "complete" | "word_boundary" | "error" | "progress";

/**
 * Playback event
 */
export interface PlaybackEvent {
  type: PlaybackEventType;
  /** Current playback position (ms) */
  positionMs?: number;
  /** Total duration (ms) */
  durationMs?: number;
  /** Current word (for word_boundary) */
  currentWord?: string;
  /** Error (for error event) */
  error?: TTSError;
  timestamp: string;
}

/**
 * Playback event callback
 */
export type PlaybackCallback = (event: PlaybackEvent) => void;

/**
 * Model download progress
 */
export interface TTSModelDownloadProgress {
  modelId: string;
  voiceId?: string;
  downloadedBytes: number;
  totalBytes: number;
  percentComplete: number;
  estimatedTimeRemainingMs: number;
}

/**
 * Default TTS synthesis options
 */
export const DEFAULT_TTS_OPTIONS: TTSSynthesisOptions = {
  voiceId: "sunita-pt-br", // Default Sunita voice
  rate: 1.0,
  pitch: 0,
  volume: 1.0,
  outputFormat: "pcm",
  sampleRate: 22050,
  enableSSML: false,
};

/**
 * Default TTS configuration
 */
export const DEFAULT_TTS_CONFIG: TTSConfig = {
  defaultVoiceId: "sunita-pt-br",
  language: "pt-BR",
  defaultOptions: DEFAULT_TTS_OPTIONS,
  maxTextLength: 5000,
  enablePreprocessing: true,
  enableCaching: true,
  maxCacheSize: 50 * 1024 * 1024, // 50MB cache
};

/**
 * Text-to-Speech Service Interface
 *
 * Implementations should support:
 * - Local (offline) synthesis using models like Piper TTS
 * - Natural pedagogical voice (Sunita persona)
 * - Word-level timing for synchronized display
 * - Audio caching for frequently used responses
 */
export interface ITTSService {
  /**
   * Initialize the TTS service
   * @param config - Optional configuration
   * @returns Promise resolving to true if initialization successful
   */
  initialize(config?: Partial<TTSConfig>): Promise<boolean>;

  /**
   * Synthesize text to speech
   * @param text - Text to synthesize
   * @param options - Optional synthesis options
   * @returns Promise resolving to synthesis result
   */
  synthesize(text: string, options?: Partial<TTSSynthesisOptions>): Promise<SynthesisResult>;

  /**
   * Synthesize text with word timings
   * @param text - Text to synthesize
   * @param options - Optional synthesis options
   * @returns Promise resolving to synthesis result with word timings
   */
  synthesizeWithTimings(text: string, options?: Partial<TTSSynthesisOptions>): Promise<SynthesisResultWithTimings>;

  /**
   * Speak text immediately (synthesize + play)
   * @param text - Text to speak
   * @param options - Optional synthesis options
   * @param callback - Playback event callback
   * @returns Playback session ID
   */
  speak(text: string, options?: Partial<TTSSynthesisOptions>, callback?: PlaybackCallback): Promise<string>;

  /**
   * Play synthesized audio
   * @param synthesisResult - Previously synthesized result
   * @param callback - Playback event callback
   * @returns Playback session ID
   */
  play(synthesisResult: SynthesisResult, callback?: PlaybackCallback): Promise<string>;

  /**
   * Pause current playback
   */
  pause(): Promise<void>;

  /**
   * Resume paused playback
   */
  resume(): Promise<void>;

  /**
   * Stop current playback
   */
  stop(): Promise<void>;

  /**
   * Get current playback state
   */
  getPlaybackState(): PlaybackState;

  /**
   * Get current playback position (ms)
   */
  getPlaybackPosition(): number;

  /**
   * Seek to position
   * @param positionMs - Position in milliseconds
   */
  seek(positionMs: number): Promise<void>;

  /**
   * Get available voice profiles
   * @param language - Optional language filter
   */
  getAvailableVoices(language?: SupportedLanguage): Promise<VoiceProfile[]>;

  /**
   * Get current voice profile
   */
  getCurrentVoice(): Promise<VoiceProfile | null>;

  /**
   * Set active voice
   * @param voiceId - Voice profile ID
   */
  setVoice(voiceId: string): Promise<void>;

  /**
   * Check if TTS model is ready
   */
  isModelReady(): Promise<boolean>;

  /**
   * Download TTS model/voice for offline use
   * @param voiceId - Voice identifier
   * @param onProgress - Progress callback
   */
  downloadVoice(voiceId: string, onProgress?: (progress: TTSModelDownloadProgress) => void): Promise<void>;

  /**
   * Delete downloaded voice
   * @param voiceId - Voice identifier
   */
  deleteVoice(voiceId: string): Promise<void>;

  /**
   * Get current configuration
   */
  getConfig(): TTSConfig;

  /**
   * Update configuration
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<TTSConfig>): Promise<void>;

  /**
   * Clear synthesis cache
   */
  clearCache(): Promise<void>;

  /**
   * Get cache statistics
   */
  getCacheStats(): Promise<{ entries: number; sizeBytes: number; hitRate: number }>;

  /**
   * Release all resources
   */
  dispose(): Promise<void>;
}
