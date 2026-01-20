/**
 * Voice Pipeline Interface
 *
 * Orchestrates the complete voice interaction flow:
 * Audio Input → STT → RAG Processing → TTS → Audio Output
 *
 * This is the "heart" of the Sunita voice assistant, enabling
 * teachers to interact naturally using voice.
 *
 * @module IVoicePipeline
 * @description End-to-end voice interaction pipeline for EduSync-AI
 */

import { AudioChunk, AudioStreamConfig } from "./IAudioStreamHandler.js";
import { TranscriptionResult, STTConfig, SupportedLanguage } from "./ISTTService.js";
import { SynthesisResult, TTSConfig } from "./ITTSService.js";

/**
 * Voice pipeline states
 */
export type VoicePipelineState =
  | "idle" // Ready to start
  | "listening" // Recording user's voice
  | "processing" // Transcribing and getting RAG response
  | "speaking" // Playing TTS response
  | "interrupted" // User interrupted during response
  | "error"; // Error occurred

/**
 * Voice interaction turn (one question/answer cycle)
 */
export interface VoiceTurn {
  /** Unique turn identifier */
  id: string;
  /** Turn sequence number in session */
  turnNumber: number;
  /** User's audio input */
  userAudio: {
    chunks: AudioChunk[];
    durationMs: number;
  };
  /** Transcription of user's speech */
  transcription: TranscriptionResult;
  /** Assistant's text response */
  assistantResponse: string;
  /** Synthesized audio response */
  assistantAudio?: SynthesisResult;
  /** Whether user interrupted the response */
  wasInterrupted: boolean;
  /** RAG context used (document IDs) */
  ragContextIds?: string[];
  /** Timestamps */
  timestamps: {
    started: string;
    transcriptionComplete: string;
    responseGenerated: string;
    responseComplete: string;
  };
  /** Total processing time (ms) */
  totalProcessingTimeMs: number;
}

/**
 * Voice session containing multiple turns
 */
export interface VoiceSession {
  /** Unique session identifier */
  id: string;
  /** Session start timestamp */
  startedAt: string;
  /** Session end timestamp (null if active) */
  endedAt: string | null;
  /** Language used in session */
  language: SupportedLanguage;
  /** All conversation turns */
  turns: VoiceTurn[];
  /** Session metadata */
  metadata: {
    deviceInfo?: string;
    isOffline: boolean;
    modelsUsed: {
      stt: string;
      tts: string;
      llm: string;
    };
  };
}

/**
 * Voice pipeline configuration
 */
export interface VoicePipelineConfig {
  /** Audio stream configuration */
  audio: Partial<AudioStreamConfig>;
  /** STT configuration */
  stt: Partial<STTConfig>;
  /** TTS configuration */
  tts: Partial<TTSConfig>;
  /** Enable interruption handling (stop response when user speaks) */
  enableInterruption: boolean;
  /** Delay before processing after speech ends (ms) */
  processingDelayMs: number;
  /** Enable audio feedback sounds (beeps, processing sounds) */
  enableAudioFeedback: boolean;
  /** Feedback sounds configuration */
  feedbackSounds: {
    listeningStart: boolean;
    listeningEnd: boolean;
    processingStart: boolean;
    responseStart: boolean;
    error: boolean;
  };
  /** Maximum turns per session (0 = unlimited) */
  maxTurnsPerSession: number;
  /** Session timeout (ms of inactivity) */
  sessionTimeoutMs: number;
  /** Enable conversation context (RAG uses previous turns) */
  enableConversationContext: boolean;
  /** Maximum previous turns to include in context */
  maxContextTurns: number;
}

/**
 * Pipeline event types
 */
export type VoicePipelineEventType =
  | "session_start"
  | "session_end"
  | "state_change"
  | "listening_start"
  | "listening_end"
  | "transcription_ready"
  | "response_generating"
  | "response_ready"
  | "speaking_start"
  | "speaking_end"
  | "interruption"
  | "turn_complete"
  | "error"
  | "feedback_sound";

/**
 * Pipeline event
 */
export interface VoicePipelineEvent {
  type: VoicePipelineEventType;
  timestamp: string;
  sessionId: string;
  turnId?: string;
  state: VoicePipelineState;
  data?: {
    previousState?: VoicePipelineState;
    transcription?: TranscriptionResult;
    response?: string;
    turn?: VoiceTurn;
    error?: VoicePipelineError;
    feedbackType?: string;
  };
}

/**
 * Pipeline event callback
 */
export type VoicePipelineCallback = (event: VoicePipelineEvent) => void;

/**
 * Pipeline error types
 */
export type VoicePipelineErrorType =
  | "audio_error"
  | "stt_error"
  | "rag_error"
  | "tts_error"
  | "session_timeout"
  | "max_turns_reached"
  | "initialization_failed"
  | "unknown";

/**
 * Pipeline error
 */
export interface VoicePipelineError {
  type: VoicePipelineErrorType;
  message: string;
  stage: "audio" | "stt" | "rag" | "tts" | "general";
  recoverable: boolean;
  originalError?: Error;
  timestamp: string;
}

/**
 * Pipeline statistics
 */
export interface VoicePipelineStats {
  /** Total sessions */
  totalSessions: number;
  /** Total turns across all sessions */
  totalTurns: number;
  /** Average transcription time (ms) */
  avgTranscriptionTimeMs: number;
  /** Average RAG response time (ms) */
  avgRagResponseTimeMs: number;
  /** Average TTS synthesis time (ms) */
  avgTtsSynthesisTimeMs: number;
  /** Average total turn time (ms) */
  avgTotalTurnTimeMs: number;
  /** Interruption rate (0-1) */
  interruptionRate: number;
  /** Error rate (0-1) */
  errorRate: number;
  /** Most common error types */
  commonErrors: { type: VoicePipelineErrorType; count: number }[];
}

/**
 * Default voice pipeline configuration
 */
export const DEFAULT_VOICE_PIPELINE_CONFIG: VoicePipelineConfig = {
  audio: {},
  stt: {},
  tts: {},
  enableInterruption: true,
  processingDelayMs: 300,
  enableAudioFeedback: true,
  feedbackSounds: {
    listeningStart: true,
    listeningEnd: true,
    processingStart: true,
    responseStart: false,
    error: true,
  },
  maxTurnsPerSession: 20,
  sessionTimeoutMs: 5 * 60 * 1000, // 5 minutes
  enableConversationContext: true,
  maxContextTurns: 3,
};

/**
 * Voice Pipeline Interface
 *
 * The main orchestrator for voice interactions.
 * Manages the complete flow from audio capture to speech output.
 *
 * Implementations should handle:
 * - Seamless state transitions
 * - User interruptions during responses
 * - Error recovery and fallbacks
 * - Offline operation
 */
export interface IVoicePipeline {
  /**
   * Initialize the voice pipeline
   * @param config - Optional configuration
   * @returns Promise resolving to true if all components initialized
   */
  initialize(config?: Partial<VoicePipelineConfig>): Promise<boolean>;

  /**
   * Start a new voice session
   * @returns Session ID
   */
  startSession(): Promise<string>;

  /**
   * End current voice session
   * @returns Final session data
   */
  endSession(): Promise<VoiceSession>;

  /**
   * Start listening for user input
   * Begins audio capture and VAD
   */
  startListening(): Promise<void>;

  /**
   * Stop listening and process input
   * Triggers STT → RAG → TTS flow
   */
  stopListening(): Promise<void>;

  /**
   * Interrupt current response
   * Stops TTS playback and prepares for new input
   */
  interrupt(): Promise<void>;

  /**
   * Cancel current operation
   * Stops any ongoing processing
   */
  cancel(): Promise<void>;

  /**
   * Get current pipeline state
   */
  getState(): VoicePipelineState;

  /**
   * Get current session
   */
  getCurrentSession(): VoiceSession | null;

  /**
   * Get current turn (if any)
   */
  getCurrentTurn(): VoiceTurn | null;

  /**
   * Check if pipeline is ready
   * All components (audio, STT, TTS) must be initialized
   */
  isReady(): Promise<boolean>;

  /**
   * Check individual component status
   */
  getComponentStatus(): Promise<{
    audio: { ready: boolean; hasPermission: boolean };
    stt: { ready: boolean; modelLoaded: boolean };
    tts: { ready: boolean; voiceLoaded: boolean };
    rag: { ready: boolean };
  }>;

  /**
   * Subscribe to pipeline events
   * @param callback - Event callback
   * @returns Unsubscribe function
   */
  onEvent(callback: VoicePipelineCallback): () => void;

  /**
   * Get pipeline configuration
   */
  getConfig(): VoicePipelineConfig;

  /**
   * Update pipeline configuration
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<VoicePipelineConfig>): Promise<void>;

  /**
   * Get pipeline statistics
   */
  getStats(): VoicePipelineStats;

  /**
   * Reset statistics
   */
  resetStats(): void;

  /**
   * Process text input directly (bypass audio/STT)
   * Useful for testing or text-based fallback
   * @param text - Text input to process
   * @param speakResponse - Whether to speak the response
   * @returns Assistant response
   */
  processTextInput(text: string, speakResponse?: boolean): Promise<string>;

  /**
   * Get session history
   * @param limit - Maximum sessions to return
   */
  getSessionHistory(limit?: number): Promise<VoiceSession[]>;

  /**
   * Release all resources
   */
  dispose(): Promise<void>;
}
