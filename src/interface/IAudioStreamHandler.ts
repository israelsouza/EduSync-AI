/**
 * Audio Stream Handler Interface
 *
 * Manages audio capture, buffering, and streaming for voice input.
 * Designed for mobile devices with limited resources.
 *
 * @module IAudioStreamHandler
 * @description Core interface for handling audio streams in EduSync-AI voice assistant
 */

/**
 * Audio format configuration
 */
export interface AudioFormat {
  /** Sample rate in Hz (e.g., 16000, 44100) */
  sampleRate: number;
  /** Number of audio channels (1 for mono, 2 for stereo) */
  channels: 1 | 2;
  /** Bits per sample (8, 16, 32) */
  bitsPerSample: 8 | 16 | 32;
  /** Audio encoding format */
  encoding: "pcm" | "wav" | "mp3" | "opus" | "flac";
}

/**
 * Audio buffer chunk with metadata
 */
export interface AudioChunk {
  /** Unique identifier for this chunk */
  id: string;
  /** Raw audio data as ArrayBuffer */
  data: ArrayBuffer;
  /** Timestamp when chunk was captured (ISO 8601) */
  timestamp: string;
  /** Duration of this chunk in milliseconds */
  durationMs: number;
  /** Sequence number for ordering */
  sequenceNumber: number;
  /** Whether voice activity was detected in this chunk */
  hasVoiceActivity: boolean;
  /** Average amplitude level (0-1) */
  amplitude: number;
}

/**
 * Audio stream state
 */
export type AudioStreamState = "idle" | "initializing" | "recording" | "paused" | "processing" | "error";

/**
 * Audio stream statistics
 */
export interface AudioStreamStats {
  /** Total duration recorded in milliseconds */
  totalDurationMs: number;
  /** Number of chunks captured */
  chunksCount: number;
  /** Total bytes captured */
  totalBytes: number;
  /** Average amplitude level */
  averageAmplitude: number;
  /** Voice activity percentage (0-100) */
  voiceActivityPercent: number;
  /** Current buffer size in bytes */
  currentBufferSize: number;
  /** Number of dropped chunks (buffer overflow) */
  droppedChunks: number;
}

/**
 * Voice Activity Detection (VAD) configuration
 */
export interface VADConfig {
  /** Enable/disable VAD */
  enabled: boolean;
  /** Minimum amplitude threshold for voice detection (0-1) */
  threshold: number;
  /** Minimum duration of voice to start recording (ms) */
  speechStartMs: number;
  /** Silence duration to end recording (ms) */
  speechEndMs: number;
  /** Pre-speech buffer duration to keep (ms) */
  preSpeechBufferMs: number;
}

/**
 * Audio stream configuration
 */
export interface AudioStreamConfig {
  /** Audio format settings */
  format: AudioFormat;
  /** Buffer size in milliseconds */
  bufferSizeMs: number;
  /** Maximum recording duration (ms), 0 for unlimited */
  maxDurationMs: number;
  /** Voice Activity Detection settings */
  vad: VADConfig;
  /** Whether to auto-stop on silence */
  autoStopOnSilence: boolean;
  /** Maximum buffer memory (bytes) before oldest chunks are dropped */
  maxBufferMemory: number;
}

/**
 * Audio stream error types
 */
export type AudioStreamErrorType =
  | "permission_denied"
  | "device_not_found"
  | "device_busy"
  | "format_not_supported"
  | "buffer_overflow"
  | "initialization_failed"
  | "unknown";

/**
 * Audio stream error
 */
export interface AudioStreamError {
  type: AudioStreamErrorType;
  message: string;
  originalError?: Error;
  timestamp: string;
}

/**
 * Audio stream event types
 */
export type AudioStreamEventType =
  | "chunk_ready"
  | "voice_start"
  | "voice_end"
  | "state_change"
  | "error"
  | "buffer_warning"
  | "max_duration_reached";

/**
 * Audio stream event payload
 */
export interface AudioStreamEvent {
  type: AudioStreamEventType;
  timestamp: string;
  data?: AudioChunk | AudioStreamState | AudioStreamError | { bufferUsagePercent: number };
}

/**
 * Audio stream event callback
 */
export type AudioStreamEventCallback = (event: AudioStreamEvent) => void;

/**
 * Default audio configuration optimized for speech recognition
 */
export const DEFAULT_AUDIO_CONFIG: AudioStreamConfig = {
  format: {
    sampleRate: 16000, // Optimal for most STT models
    channels: 1, // Mono is sufficient for speech
    bitsPerSample: 16,
    encoding: "pcm",
  },
  bufferSizeMs: 100, // 100ms chunks
  maxDurationMs: 60000, // 1 minute max recording
  vad: {
    enabled: true,
    threshold: 0.02, // Low threshold for quiet environments
    speechStartMs: 300, // 300ms of speech to start
    speechEndMs: 1500, // 1.5s silence to end
    preSpeechBufferMs: 500, // Keep 500ms before speech detected
  },
  autoStopOnSilence: true,
  maxBufferMemory: 5 * 1024 * 1024, // 5MB max buffer
};

/**
 * Audio Stream Handler Interface
 *
 * Provides methods for managing audio capture and streaming.
 * Implementations should handle:
 * - Microphone access and permissions
 * - Audio buffering and chunking
 * - Voice Activity Detection (VAD)
 * - Memory management for constrained devices
 */
export interface IAudioStreamHandler {
  /**
   * Initialize the audio stream handler
   * @param config - Optional configuration (uses defaults if not provided)
   * @returns Promise resolving to true if initialization successful
   */
  initialize(config?: Partial<AudioStreamConfig>): Promise<boolean>;

  /**
   * Start recording audio
   * @throws AudioStreamError if recording cannot start
   */
  startRecording(): Promise<void>;

  /**
   * Stop recording audio
   * @returns Promise resolving to all captured audio chunks
   */
  stopRecording(): Promise<AudioChunk[]>;

  /**
   * Pause recording (keeps buffer)
   */
  pauseRecording(): Promise<void>;

  /**
   * Resume recording after pause
   */
  resumeRecording(): Promise<void>;

  /**
   * Get current stream state
   */
  getState(): AudioStreamState;

  /**
   * Get current stream statistics
   */
  getStats(): AudioStreamStats;

  /**
   * Get current configuration
   */
  getConfig(): AudioStreamConfig;

  /**
   * Update configuration (some changes require re-initialization)
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<AudioStreamConfig>): Promise<void>;

  /**
   * Get all buffered audio chunks
   */
  getBufferedChunks(): AudioChunk[];

  /**
   * Get combined audio data from all chunks
   * @returns ArrayBuffer containing all audio data
   */
  getCombinedAudioData(): ArrayBuffer;

  /**
   * Clear the audio buffer
   */
  clearBuffer(): void;

  /**
   * Check if microphone permission is granted
   */
  hasPermission(): Promise<boolean>;

  /**
   * Request microphone permission
   * @returns Promise resolving to true if permission granted
   */
  requestPermission(): Promise<boolean>;

  /**
   * Subscribe to audio stream events
   * @param callback - Event callback function
   * @returns Unsubscribe function
   */
  onEvent(callback: AudioStreamEventCallback): () => void;

  /**
   * Release all resources
   */
  dispose(): Promise<void>;
}
