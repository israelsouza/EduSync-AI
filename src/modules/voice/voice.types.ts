/**
 * Voice Module Types
 *
 * Request/Response types for voice API endpoints.
 *
 * @module voice.types
 */

import { VoicePipelineState, VoiceTurn, VoiceSession } from "../../interface/IVoicePipeline.js";
import { SupportedLanguage } from "../../interface/ISTTService.js";

// ============================================================================
// Session Management
// ============================================================================

/**
 * Request to start a new voice session
 */
export interface StartSessionRequest {
  /** Preferred language */
  language?: SupportedLanguage;
  /** Device information for analytics */
  deviceInfo?: string;
  /** Whether device is offline */
  isOffline?: boolean;
}

/**
 * Response for session start
 */
export interface StartSessionResponse {
  success: boolean;
  data: {
    sessionId: string;
    language: SupportedLanguage;
    isReady: boolean;
    componentStatus: {
      audio: { ready: boolean; hasPermission: boolean };
      stt: { ready: boolean; modelLoaded: boolean };
      tts: { ready: boolean; voiceLoaded: boolean };
      rag: { ready: boolean };
    };
  };
}

/**
 * Response for session end
 */
export interface EndSessionResponse {
  success: boolean;
  data: {
    session: VoiceSession;
    summary: {
      totalTurns: number;
      totalDurationMs: number;
      averageTurnTimeMs: number;
      interruptionCount: number;
    };
  };
}

// ============================================================================
// Voice Interaction
// ============================================================================

/**
 * Request for text-based voice interaction (bypass audio)
 */
export interface TextInputRequest {
  /** Session ID */
  sessionId: string;
  /** Text input (simulating transcribed speech) */
  text: string;
  /** Whether to generate TTS audio for response */
  speakResponse?: boolean;
  /** Language override */
  language?: SupportedLanguage;
}

/**
 * Response for voice interaction
 */
export interface VoiceInteractionResponse {
  success: boolean;
  data: {
    turn: VoiceTurn;
    response: string;
    audioBase64?: string; // Base64 encoded audio if speakResponse=true
    audioDurationMs?: number;
    ragSources?: {
      id: string;
      title: string;
      similarity: number;
    }[];
  };
}

/**
 * Request to process audio input
 */
export interface AudioInputRequest {
  /** Session ID */
  sessionId: string;
  /** Base64 encoded audio data */
  audioBase64: string;
  /** Audio format */
  format: "pcm" | "wav" | "mp3" | "opus";
  /** Sample rate */
  sampleRate: number;
  /** Whether to generate TTS audio for response */
  speakResponse?: boolean;
}

// ============================================================================
// Pipeline Status
// ============================================================================

/**
 * Pipeline status response
 */
export interface PipelineStatusResponse {
  success: boolean;
  data: {
    state: VoicePipelineState;
    currentSession: {
      id: string;
      turnsCount: number;
      startedAt: string;
    } | null;
    currentTurn: {
      id: string;
      turnNumber: number;
      state: "listening" | "processing" | "speaking";
    } | null;
    components: {
      audio: { ready: boolean; hasPermission: boolean; state: string };
      stt: { ready: boolean; modelId: string; modelLoaded: boolean };
      tts: { ready: boolean; voiceId: string; voiceLoaded: boolean };
      rag: { ready: boolean; embeddingsCount: number };
    };
  };
}

// ============================================================================
// Model Management
// ============================================================================

/**
 * Available models response
 */
export interface AvailableModelsResponse {
  success: boolean;
  data: {
    stt: {
      id: string;
      name: string;
      languages: SupportedLanguage[];
      sizeBytes: number;
      isDownloaded: boolean;
    }[];
    tts: {
      id: string;
      name: string;
      language: SupportedLanguage;
      gender: string;
      sizeBytes: number;
      isDownloaded: boolean;
    }[];
  };
}

/**
 * Model download request
 */
export interface ModelDownloadRequest {
  /** Model type */
  type: "stt" | "tts";
  /** Model ID */
  modelId: string;
}

/**
 * Model download progress response (for SSE/WebSocket)
 */
export interface ModelDownloadProgress {
  type: "stt" | "tts";
  modelId: string;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  status: "downloading" | "completed" | "failed";
  error?: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Voice pipeline configuration request
 */
export interface VoiceConfigRequest {
  /** Audio settings */
  audio?: {
    sampleRate?: number;
    vadEnabled?: boolean;
    vadThreshold?: number;
    maxRecordingMs?: number;
  };
  /** STT settings */
  stt?: {
    language?: SupportedLanguage;
    enablePunctuation?: boolean;
    maxAlternatives?: number;
  };
  /** TTS settings */
  tts?: {
    voiceId?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
  };
  /** Pipeline settings */
  pipeline?: {
    enableInterruption?: boolean;
    enableAudioFeedback?: boolean;
    maxTurnsPerSession?: number;
    sessionTimeoutMs?: number;
  };
}

/**
 * Voice pipeline configuration response
 */
export interface VoiceConfigResponse {
  success: boolean;
  data: {
    audio: {
      sampleRate: number;
      channels: number;
      vadEnabled: boolean;
      vadThreshold: number;
      maxRecordingMs: number;
    };
    stt: {
      language: SupportedLanguage;
      enablePunctuation: boolean;
      maxAlternatives: number;
      modelId: string;
    };
    tts: {
      voiceId: string;
      rate: number;
      pitch: number;
      volume: number;
    };
    pipeline: {
      enableInterruption: boolean;
      enableAudioFeedback: boolean;
      maxTurnsPerSession: number;
      sessionTimeoutMs: number;
      enableConversationContext: boolean;
      maxContextTurns: number;
    };
  };
}

// ============================================================================
// Statistics & Analytics
// ============================================================================

/**
 * Voice pipeline statistics response
 */
export interface VoiceStatsResponse {
  success: boolean;
  data: {
    totalSessions: number;
    totalTurns: number;
    averages: {
      transcriptionTimeMs: number;
      ragResponseTimeMs: number;
      ttsSynthesisTimeMs: number;
      totalTurnTimeMs: number;
    };
    rates: {
      interruptionRate: number;
      errorRate: number;
      offlineUsageRate: number;
    };
    topQueries: {
      query: string;
      count: number;
    }[];
    languageDistribution: {
      language: SupportedLanguage;
      percentage: number;
    }[];
  };
}

// ============================================================================
// WebSocket/SSE Events
// ============================================================================

/**
 * Real-time voice event (for WebSocket/SSE)
 */
export interface VoiceRealtimeEvent {
  type:
    | "session_start"
    | "session_end"
    | "state_change"
    | "listening_start"
    | "listening_end"
    | "transcription_interim"
    | "transcription_final"
    | "response_chunk"
    | "response_complete"
    | "speaking_start"
    | "speaking_end"
    | "interruption"
    | "error";
  timestamp: string;
  sessionId: string;
  turnId?: string;
  data?: unknown;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Voice API error response
 */
export interface VoiceErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    stage?: "audio" | "stt" | "rag" | "tts" | "pipeline";
    recoverable?: boolean;
    suggestions?: string[];
  };
}

/**
 * Voice error codes
 */
export const VOICE_ERROR_CODES = {
  // Session errors
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  SESSION_LIMIT_REACHED: "SESSION_LIMIT_REACHED",

  // Audio errors
  AUDIO_PERMISSION_DENIED: "AUDIO_PERMISSION_DENIED",
  AUDIO_DEVICE_ERROR: "AUDIO_DEVICE_ERROR",
  AUDIO_FORMAT_INVALID: "AUDIO_FORMAT_INVALID",

  // STT errors
  STT_MODEL_NOT_READY: "STT_MODEL_NOT_READY",
  STT_TRANSCRIPTION_FAILED: "STT_TRANSCRIPTION_FAILED",
  STT_LANGUAGE_NOT_SUPPORTED: "STT_LANGUAGE_NOT_SUPPORTED",

  // TTS errors
  TTS_VOICE_NOT_FOUND: "TTS_VOICE_NOT_FOUND",
  TTS_SYNTHESIS_FAILED: "TTS_SYNTHESIS_FAILED",

  // RAG errors
  RAG_SERVICE_UNAVAILABLE: "RAG_SERVICE_UNAVAILABLE",
  RAG_NO_RESULTS: "RAG_NO_RESULTS",

  // Pipeline errors
  PIPELINE_NOT_INITIALIZED: "PIPELINE_NOT_INITIALIZED",
  PIPELINE_BUSY: "PIPELINE_BUSY",
  PIPELINE_TIMEOUT: "PIPELINE_TIMEOUT",

  // General errors
  INVALID_REQUEST: "INVALID_REQUEST",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type VoiceErrorCode = (typeof VOICE_ERROR_CODES)[keyof typeof VOICE_ERROR_CODES];
