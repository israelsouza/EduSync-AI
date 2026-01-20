/**
 * Speech-to-Text Service Interface
 *
 * Provides speech recognition capabilities for the voice assistant.
 * Supports both streaming and batch transcription modes.
 *
 * @module ISTTService
 * @description Core interface for speech-to-text in EduSync-AI
 */

import { AudioChunk, AudioFormat } from "./IAudioStreamHandler.js";

/**
 * Supported languages for speech recognition
 * Focus on languages relevant to rural education in Latin America
 */
export type SupportedLanguage =
  | "pt-BR" // Brazilian Portuguese (primary)
  | "es-ES" // Spanish (Spain)
  | "es-MX" // Spanish (Mexico)
  | "es-419" // Spanish (Latin America)
  | "en-US" // English (US)
  | "auto"; // Auto-detect

/**
 * STT model information
 */
export interface STTModelInfo {
  /** Model identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Model version */
  version: string;
  /** Supported languages */
  languages: SupportedLanguage[];
  /** Model size in bytes */
  sizeBytes: number;
  /** Whether model is downloaded locally */
  isLocal: boolean;
  /** Whether model supports streaming */
  supportsStreaming: boolean;
  /** Estimated accuracy (0-1) */
  estimatedAccuracy: number;
}

/**
 * STT configuration options
 */
export interface STTConfig {
  /** Target language for recognition */
  language: SupportedLanguage;
  /** Enable automatic punctuation */
  enablePunctuation: boolean;
  /** Enable profanity filter */
  profanityFilter: boolean;
  /** Maximum alternatives to return */
  maxAlternatives: number;
  /** Enable word-level timestamps */
  enableWordTimestamps: boolean;
  /** Boost specific words/phrases (pedagogical terms) */
  speechContexts?: string[];
  /** Sample rate of input audio */
  sampleRateHertz: number;
  /** Audio encoding format */
  encoding: AudioFormat["encoding"];
  /** Enable interim/partial results for streaming */
  enableInterimResults: boolean;
}

/**
 * Word-level transcription result
 */
export interface TranscribedWord {
  /** The transcribed word */
  word: string;
  /** Start time in milliseconds */
  startTimeMs: number;
  /** End time in milliseconds */
  endTimeMs: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Speaker tag (for multi-speaker scenarios) */
  speakerTag?: number;
}

/**
 * Transcription alternative
 */
export interface TranscriptionAlternative {
  /** Full transcribed text */
  transcript: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Word-level details (if enabled) */
  words?: TranscribedWord[];
}

/**
 * Complete transcription result
 */
export interface TranscriptionResult {
  /** Unique identifier for this transcription */
  id: string;
  /** Whether this is a final (vs interim) result */
  isFinal: boolean;
  /** Transcription alternatives, ordered by confidence */
  alternatives: TranscriptionAlternative[];
  /** Detected language (if auto-detect was used) */
  detectedLanguage?: SupportedLanguage;
  /** Language detection confidence */
  languageConfidence?: number;
  /** Total audio duration processed (ms) */
  audioDurationMs: number;
  /** Processing time (ms) */
  processingTimeMs: number;
  /** Timestamp of transcription */
  timestamp: string;
  /** Model used for transcription */
  modelId: string;
}

/**
 * STT error types
 */
export type STTErrorType =
  | "model_not_loaded"
  | "model_download_failed"
  | "invalid_audio_format"
  | "audio_too_short"
  | "audio_too_long"
  | "language_not_supported"
  | "transcription_failed"
  | "timeout"
  | "unknown";

/**
 * STT error
 */
export interface STTError {
  type: STTErrorType;
  message: string;
  originalError?: Error;
  timestamp: string;
}

/**
 * Streaming transcription event types
 */
export type STTStreamEventType = "interim_result" | "final_result" | "error" | "end";

/**
 * Streaming transcription event
 */
export interface STTStreamEvent {
  type: STTStreamEventType;
  data: TranscriptionResult | STTError | null;
  timestamp: string;
}

/**
 * STT stream event callback
 */
export type STTStreamCallback = (event: STTStreamEvent) => void;

/**
 * Model download progress
 */
export interface ModelDownloadProgress {
  modelId: string;
  downloadedBytes: number;
  totalBytes: number;
  percentComplete: number;
  estimatedTimeRemainingMs: number;
}

/**
 * Default STT configuration
 */
export const DEFAULT_STT_CONFIG: STTConfig = {
  language: "pt-BR",
  enablePunctuation: true,
  profanityFilter: false,
  maxAlternatives: 1,
  enableWordTimestamps: false,
  sampleRateHertz: 16000,
  encoding: "pcm",
  enableInterimResults: true,
  speechContexts: [
    // Pedagogical terms to boost recognition
    "didática",
    "pedagogia",
    "avaliação",
    "aluno",
    "turma",
    "multisérie",
    "planejamento",
    "BNCC",
    "competência",
    "habilidade",
    "sequência didática",
  ],
};

/**
 * Speech-to-Text Service Interface
 *
 * Implementations should support:
 * - Local (offline) transcription using models like Whisper.cpp
 * - Streaming transcription for real-time feedback
 * - Language detection and multi-language support
 * - Pedagogical vocabulary optimization
 */
export interface ISTTService {
  /**
   * Initialize the STT service
   * @param config - Optional configuration
   * @returns Promise resolving to true if initialization successful
   */
  initialize(config?: Partial<STTConfig>): Promise<boolean>;

  /**
   * Transcribe audio data (batch mode)
   * @param audioData - Audio data as ArrayBuffer
   * @param config - Optional config overrides
   * @returns Promise resolving to transcription result
   */
  transcribe(audioData: ArrayBuffer, config?: Partial<STTConfig>): Promise<TranscriptionResult>;

  /**
   * Transcribe audio chunks (batch mode)
   * @param chunks - Array of audio chunks
   * @param config - Optional config overrides
   * @returns Promise resolving to transcription result
   */
  transcribeChunks(chunks: AudioChunk[], config?: Partial<STTConfig>): Promise<TranscriptionResult>;

  /**
   * Start streaming transcription
   * @param callback - Callback for streaming events
   * @param config - Optional config overrides
   * @returns Stream session ID
   */
  startStreaming(callback: STTStreamCallback, config?: Partial<STTConfig>): Promise<string>;

  /**
   * Feed audio data to streaming session
   * @param sessionId - Streaming session ID
   * @param chunk - Audio chunk to process
   */
  feedAudioChunk(sessionId: string, chunk: AudioChunk): Promise<void>;

  /**
   * End streaming session and get final result
   * @param sessionId - Streaming session ID
   * @returns Final transcription result
   */
  endStreaming(sessionId: string): Promise<TranscriptionResult>;

  /**
   * Cancel streaming session
   * @param sessionId - Streaming session ID
   */
  cancelStreaming(sessionId: string): Promise<void>;

  /**
   * Detect language from audio sample
   * @param audioData - Audio data sample
   * @returns Detected language and confidence
   */
  detectLanguage(audioData: ArrayBuffer): Promise<{ language: SupportedLanguage; confidence: number }>;

  /**
   * Check if STT model is ready
   */
  isModelReady(): Promise<boolean>;

  /**
   * Download STT model for offline use
   * @param modelId - Model identifier (default: recommended model)
   * @param onProgress - Progress callback
   */
  downloadModel(modelId?: string, onProgress?: (progress: ModelDownloadProgress) => void): Promise<void>;

  /**
   * Delete downloaded model
   * @param modelId - Model identifier
   */
  deleteModel(modelId: string): Promise<void>;

  /**
   * Get available models
   */
  getAvailableModels(): Promise<STTModelInfo[]>;

  /**
   * Get current model info
   */
  getCurrentModelInfo(): Promise<STTModelInfo | null>;

  /**
   * Get current configuration
   */
  getConfig(): STTConfig;

  /**
   * Update configuration
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<STTConfig>): Promise<void>;

  /**
   * Release all resources
   */
  dispose(): Promise<void>;
}
