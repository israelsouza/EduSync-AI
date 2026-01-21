/**
 * Voice Pipeline Service Implementation
 *
 * Orchestrates the complete voice interaction flow:
 * Audio Input → STT → RAG Processing → TTS → Audio Output
 *
 * This service manages multi-turn conversations, interruptions,
 * and provides a seamless voice interface for the Sunita assistant.
 *
 * @module VoicePipelineService
 */

import {
  IVoicePipeline,
  VoicePipelineState,
  VoiceSession,
  VoiceTurn,
  VoicePipelineConfig,
  VoicePipelineEvent,
  VoicePipelineCallback,
  VoicePipelineError,
  VoicePipelineErrorType,
  VoicePipelineStats,
  DEFAULT_VOICE_PIPELINE_CONFIG,
} from "../interface/IVoicePipeline.js";
import { ISTTService } from "../interface/ISTTService.js";
import { ITTSService } from "../interface/ITTSService.js";
import { AudioChunk } from "../interface/IAudioStreamHandler.js";
import { RAGService } from "./RAGService.js";

/**
 * Voice Pipeline Service
 *
 * Manages the complete voice interaction lifecycle from listening
 * to responding, including interruptions and error recovery.
 */
export class VoicePipelineService implements IVoicePipeline {
  private config: VoicePipelineConfig;
  private state: VoicePipelineState = "idle";
  private currentSession: VoiceSession | null = null;
  private currentTurn: Partial<VoiceTurn> | null = null;
  private audioChunks: AudioChunk[] = [];
  private eventCallbacks: VoicePipelineCallback[] = [];
  private sessionHistory: VoiceSession[] = [];
  private isInitialized = false;

  // Statistics tracking
  private stats = {
    totalSessions: 0,
    totalTurns: 0,
    totalErrors: 0,
    totalInterruptions: 0,
    transcriptionTimes: [] as number[],
    ragTimes: [] as number[],
    ttsTimes: [] as number[],
    totalTurnTimes: [] as number[],
    errorCounts: new Map<string, number>(),
  };

  constructor(
    private readonly sttService: ISTTService,
    private readonly ttsService: ITTSService,
    private readonly ragService: RAGService
  ) {
    this.config = { ...DEFAULT_VOICE_PIPELINE_CONFIG };
  }

  /**
   * Initialize the voice pipeline and all its components
   */
  async initialize(config?: Partial<VoicePipelineConfig>): Promise<boolean> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    try {
      // Initialize STT service
      const sttReady = await this.sttService.initialize(this.config.stt);
      if (!sttReady) {
        console.error("[VoicePipeline] STT initialization failed");
        return false;
      }

      // Initialize TTS service
      const ttsReady = await this.ttsService.initialize(this.config.tts);
      if (!ttsReady) {
        console.error("[VoicePipeline] TTS initialization failed");
        return false;
      }

      this.isInitialized = true;
      console.log("[VoicePipeline] Initialized successfully");
      return true;
    } catch (error) {
      console.error("[VoicePipeline] Initialization error:", error);
      this.handleError("initialization_failed", error as Error, "general");
      return false;
    }
  }

  /**
   * Start a new voice session
   */
  async startSession(): Promise<string> {
    if (!this.isInitialized) {
      throw new Error("Pipeline not initialized. Call initialize() first.");
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.currentSession = {
      id: sessionId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      language: this.config.stt.language || "pt-BR",
      turns: [],
      metadata: {
        isOffline: false, // TODO: Detect actual offline status
        modelsUsed: {
          stt: await this.getSttModelName(),
          tts: await this.getTtsModelName(),
          llm: "gemini-2.5-flash", // TODO: Get from RAG/LLM service
        },
      },
    };

    this.stats.totalSessions++;
    this.emitEvent({
      type: "session_start",
      timestamp: new Date().toISOString(),
      sessionId,
      state: "idle",
    });

    console.log(`[VoicePipeline] Session started: ${sessionId}`);
    return sessionId;
  }

  /**
   * End current voice session
   */
  async endSession(): Promise<VoiceSession> {
    if (!this.currentSession) {
      throw new Error("No active session to end");
    }

    this.currentSession.endedAt = new Date().toISOString();
    const session = { ...this.currentSession };

    // Add to history
    this.sessionHistory.push(session);
    if (this.sessionHistory.length > 50) {
      this.sessionHistory.shift(); // Keep last 50 sessions
    }

    this.emitEvent({
      type: "session_end",
      timestamp: new Date().toISOString(),
      sessionId: session.id,
      state: this.state,
    });

    // Reset session
    this.currentSession = null;
    this.currentTurn = null;
    this.state = "idle";

    console.log(`[VoicePipeline] Session ended: ${session.id}`);
    return session;
  }

  /**
   * Start listening for user input
   */
  async startListening(): Promise<void> {
    if (!this.currentSession) {
      throw new Error("No active session. Call startSession() first.");
    }

    if (this.state !== "idle") {
      console.warn(`[VoicePipeline] Cannot start listening in state: ${this.state}`);
      return;
    }

    this.changeState("listening");
    this.audioChunks = [];

    // Start new turn
    const turnId = `turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.currentTurn = {
      id: turnId,
      turnNumber: this.currentSession.turns.length + 1,
      timestamps: {
        started: new Date().toISOString(),
        transcriptionComplete: "",
        responseGenerated: "",
        responseComplete: "",
      },
      wasInterrupted: false,
    };

    this.emitEvent({
      type: "listening_start",
      timestamp: new Date().toISOString(),
      sessionId: this.currentSession.id,
      turnId,
      state: "listening",
    });

    console.log(`[VoicePipeline] Started listening for turn ${this.currentTurn.turnNumber}`);
  }

  /**
   * Stop listening and process the input
   */
  async stopListening(): Promise<void> {
    if (this.state !== "listening") {
      console.warn(`[VoicePipeline] Cannot stop listening in state: ${this.state}`);
      return;
    }

    if (!this.currentTurn || !this.currentSession) {
      throw new Error("No active turn or session");
    }

    this.emitEvent({
      type: "listening_end",
      timestamp: new Date().toISOString(),
      sessionId: this.currentSession.id,
      turnId: this.currentTurn.id || "",
      state: "listening",
    });

    // Process the complete audio
    await this.processAudioInput();
  }

  /**
   * Interrupt current response
   */
  async interrupt(): Promise<void> {
    if (this.state !== "speaking") {
      return;
    }

    // Stop TTS playback
    await this.ttsService.stop();

    if (this.currentTurn) {
      this.currentTurn.wasInterrupted = true;
      this.stats.totalInterruptions++;
    }

    this.changeState("interrupted");

    this.emitEvent({
      type: "interruption",
      timestamp: new Date().toISOString(),
      sessionId: this.currentSession?.id || "",
      turnId: this.currentTurn?.id || "",
      state: "interrupted",
    });

    console.log("[VoicePipeline] Response interrupted");

    // Return to idle state after interruption
    this.changeState("idle");
  }

  /**
   * Cancel current operation
   */
  async cancel(): Promise<void> {
    if (this.state === "listening") {
      this.audioChunks = [];
    } else if (this.state === "speaking") {
      await this.ttsService.stop();
    }

    this.currentTurn = null;
    this.changeState("idle");
    console.log("[VoicePipeline] Operation cancelled");
  }

  /**
   * Get current pipeline state
   */
  getState(): VoicePipelineState {
    return this.state;
  }

  /**
   * Get current session
   */
  getCurrentSession(): VoiceSession | null {
    return this.currentSession ? { ...this.currentSession } : null;
  }

  /**
   * Get current turn
   */
  getCurrentTurn(): VoiceTurn | null {
    return this.currentTurn as VoiceTurn | null;
  }

  /**
   * Check if pipeline is ready
   */
  async isReady(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    const status = await this.getComponentStatus();
    return status.stt.ready && status.tts.ready && status.rag.ready;
  }

  /**
   * Get component status
   */
  async getComponentStatus(): Promise<{
    audio: { ready: boolean; hasPermission: boolean };
    stt: { ready: boolean; modelLoaded: boolean };
    tts: { ready: boolean; voiceLoaded: boolean };
    rag: { ready: boolean };
  }> {
    const sttReady = await this.sttService.isModelReady();
    const ttsReady = await this.ttsService.isModelReady();

    return {
      audio: { ready: true, hasPermission: true }, // Simplified for server-side
      stt: { ready: sttReady, modelLoaded: sttReady },
      tts: { ready: ttsReady, voiceLoaded: ttsReady },
      rag: { ready: true }, // RAG service doesn't have async initialization
    };
  }

  /**
   * Subscribe to pipeline events
   */
  onEvent(callback: VoicePipelineCallback): () => void {
    this.eventCallbacks.push(callback);
    return () => {
      const index = this.eventCallbacks.indexOf(callback);
      if (index > -1) {
        this.eventCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get pipeline configuration
   */
  getConfig(): VoicePipelineConfig {
    return { ...this.config };
  }

  /**
   * Update pipeline configuration
   */
  async updateConfig(config: Partial<VoicePipelineConfig>): Promise<void> {
    this.config = { ...this.config, ...config };

    // Update component configs if needed
    if (config.stt) {
      await this.sttService.updateConfig(config.stt);
    }
    if (config.tts) {
      await this.ttsService.updateConfig(config.tts);
    }

    console.log("[VoicePipeline] Configuration updated");
  }

  /**
   * Get pipeline statistics
   */
  getStats(): VoicePipelineStats {
    const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    return {
      totalSessions: this.stats.totalSessions,
      totalTurns: this.stats.totalTurns,
      avgTranscriptionTimeMs: Math.round(avg(this.stats.transcriptionTimes)),
      avgRagResponseTimeMs: Math.round(avg(this.stats.ragTimes)),
      avgTtsSynthesisTimeMs: Math.round(avg(this.stats.ttsTimes)),
      avgTotalTurnTimeMs: Math.round(avg(this.stats.totalTurnTimes)),
      interruptionRate: this.stats.totalTurns > 0 ? this.stats.totalInterruptions / this.stats.totalTurns : 0,
      errorRate: this.stats.totalTurns > 0 ? this.stats.totalErrors / this.stats.totalTurns : 0,
      commonErrors: Array.from(this.stats.errorCounts.entries())
        .map(([type, count]) => ({ type: type as VoicePipelineErrorType, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalSessions: 0,
      totalTurns: 0,
      totalErrors: 0,
      totalInterruptions: 0,
      transcriptionTimes: [],
      ragTimes: [],
      ttsTimes: [],
      totalTurnTimes: [],
      errorCounts: new Map(),
    };
    console.log("[VoicePipeline] Statistics reset");
  }

  /**
   * Process text input directly (bypass audio/STT)
   */
  async processTextInput(text: string, speakResponse = false): Promise<string> {
    if (!this.currentSession) {
      throw new Error("No active session. Call startSession() first.");
    }

    if (!this.currentTurn) {
      // Start a new turn for text input
      const turnId = `turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.currentTurn = {
        id: turnId,
        turnNumber: this.currentSession.turns.length + 1,
        timestamps: {
          started: new Date().toISOString(),
          transcriptionComplete: new Date().toISOString(), // Immediate for text
          responseGenerated: "",
          responseComplete: "",
        },
        wasInterrupted: false,
        transcription: {
          id: `transcription_${Date.now()}`,
          isFinal: true,
          alternatives: [{ transcript: text, confidence: 1.0 }],
          audioDurationMs: 0,
          processingTimeMs: 0,
          timestamp: new Date().toISOString(),
          modelId: "text-input",
        },
      };
    }

    this.changeState("processing");

    try {
      // Generate RAG response
      const ragStartTime = Date.now();
      const conversationContext = this.config.enableConversationContext ? this.buildConversationContext() : undefined;

      if (!this.currentTurn) {
        throw new Error("Current turn was unexpectedly null");
      }

      this.emitEvent({
        type: "response_generating",
        timestamp: new Date().toISOString(),
        sessionId: this.currentSession.id,
        turnId: this.currentTurn.id || "",
        state: "processing",
      });

      const ragResponse = await this.ragService.generateResponse(text, conversationContext);
      const ragTime = Date.now() - ragStartTime;
      this.stats.ragTimes.push(ragTime);

      if (this.currentTurn) {
        this.currentTurn.assistantResponse = ragResponse.answer;
        this.currentTurn.ragContextIds = ragResponse.sources.map((s) => s.content.substring(0, 50));
        if (this.currentTurn.timestamps) {
          this.currentTurn.timestamps.responseGenerated = new Date().toISOString();
        }
      }

      if (this.currentTurn) {
        this.emitEvent({
          type: "response_ready",
          timestamp: new Date().toISOString(),
          sessionId: this.currentSession.id,
          turnId: this.currentTurn.id || "",
          state: "processing",
          data: { response: ragResponse.answer },
        });
      }

      // Synthesize audio if requested
      if (speakResponse) {
        await this.synthesizeAndSpeak(ragResponse.answer);
      } else {
        // Complete turn without audio
        this.completeTurn();
      }

      return ragResponse.answer;
    } catch (error) {
      this.handleError("rag_error", error as Error, "rag");
      throw error;
    }
  }

  /**
   * Get session history
   */
  async getSessionHistory(limit = 10): Promise<VoiceSession[]> {
    return this.sessionHistory.slice(-limit);
  }

  /**
   * Release all resources
   */
  async dispose(): Promise<void> {
    if (this.currentSession) {
      await this.endSession();
    }

    await this.sttService.dispose();
    await this.ttsService.dispose();

    this.eventCallbacks = [];
    this.sessionHistory = [];
    this.isInitialized = false;

    console.log("[VoicePipeline] Disposed");
  }

  // ==================== Private Helper Methods ====================

  /**
   * Process audio input through the pipeline
   */
  private async processAudioInput(): Promise<void> {
    if (!this.currentTurn || !this.currentSession) {
      return;
    }

    this.changeState("processing");

    try {
      // Step 1: Transcribe audio (STT)
      const sttStartTime = Date.now();
      this.emitEvent({
        type: "transcription_ready",
        timestamp: new Date().toISOString(),
        sessionId: this.currentSession.id,
        turnId: this.currentTurn.id || "",
        state: "processing",
      });

      // Convert audio chunks to buffer (simplified - in real implementation would use actual audio data)
      const audioBuffer = await this.mergeAudioChunks(this.audioChunks);

      const transcription = await this.sttService.transcribe(audioBuffer);
      const sttTime = Date.now() - sttStartTime;
      this.stats.transcriptionTimes.push(sttTime);

      this.currentTurn.transcription = transcription;
      if (this.currentTurn?.timestamps) {
        this.currentTurn.timestamps.transcriptionComplete = new Date().toISOString();
      }

      if (this.currentTurn) {
        this.emitEvent({
          type: "response_generating",
          timestamp: new Date().toISOString(),
          sessionId: this.currentSession.id,
          turnId: this.currentTurn.id || "",
          state: "processing",
          data: { transcription },
        });
      }

      // Step 2: Generate response using RAG
      const ragStartTime = Date.now();
      const conversationContext = this.config.enableConversationContext ? this.buildConversationContext() : undefined;

      this.emitEvent({
        type: "response_generating",
        timestamp: new Date().toISOString(),
        sessionId: this.currentSession.id,
        turnId: this.currentTurn.id || "",
        state: "processing",
      });

      const ragResponse = await this.ragService.generateResponse(transcription.alternatives[0]?.transcript || "", conversationContext);
      const ragTime = Date.now() - ragStartTime;
      this.stats.ragTimes.push(ragTime);

      this.currentTurn.assistantResponse = ragResponse.answer;
      this.currentTurn.ragContextIds = ragResponse.sources.map((s) => s.content.substring(0, 50));
      if (this.currentTurn.timestamps) {
        this.currentTurn.timestamps.responseGenerated = new Date().toISOString();
      }

      this.emitEvent({
        type: "response_ready",
        timestamp: new Date().toISOString(),
        sessionId: this.currentSession.id,
        turnId: this.currentTurn.id || "",
        state: "processing",
        data: { response: ragResponse.answer },
      });

      // Step 3: Synthesize and speak response (TTS)
      await this.synthesizeAndSpeak(ragResponse.answer);
    } catch (error) {
      this.handleError("unknown", error as Error, "general");
    }
  }

  /**
   * Synthesize text and play audio
   */
  private async synthesizeAndSpeak(text: string): Promise<void> {
    if (!this.currentTurn || !this.currentSession) {
      return;
    }

    this.changeState("speaking");

    try {
      const ttsStartTime = Date.now();

      if (this.currentTurn) {
        this.emitEvent({
          type: "speaking_start",
          timestamp: new Date().toISOString(),
          sessionId: this.currentSession.id,
          turnId: this.currentTurn.id || "",
          state: "speaking",
        });
      }

      const synthesis = await this.ttsService.synthesize(text);
      const ttsTime = Date.now() - ttsStartTime;
      this.stats.ttsTimes.push(ttsTime);

      this.currentTurn.assistantAudio = synthesis;

      // Simulate playing audio (in real implementation would stream to audio output)
      // For server-side, we just complete immediately

      this.emitEvent({
        type: "speaking_end",
        timestamp: new Date().toISOString(),
        sessionId: this.currentSession.id,
        turnId: this.currentTurn.id || "",
        state: "speaking",
      });

      this.completeTurn();
    } catch (error) {
      this.handleError("tts_error", error as Error, "tts");
    }
  }

  /**
   * Complete the current turn
   */
  private completeTurn(): void {
    if (!this.currentTurn || !this.currentSession) {
      return;
    }

    // Finalize turn
    if (this.currentTurn?.timestamps) {
      this.currentTurn.timestamps.responseComplete = new Date().toISOString();

      const startTime = new Date(this.currentTurn.timestamps.started).getTime();
      const endTime = new Date(this.currentTurn.timestamps.responseComplete).getTime();
      this.currentTurn.totalProcessingTimeMs = endTime - startTime;

      this.stats.totalTurnTimes.push(this.currentTurn.totalProcessingTimeMs);
      this.stats.totalTurns++;

      // Add to session
      this.currentSession.turns.push(this.currentTurn as VoiceTurn);

      this.emitEvent({
        type: "turn_complete",
        timestamp: new Date().toISOString(),
        sessionId: this.currentSession.id,
        turnId: this.currentTurn.id || "",
        state: "idle",
        data: { turn: this.currentTurn as VoiceTurn },
      });

      console.log(`[VoicePipeline] Turn ${this.currentTurn.turnNumber} completed in ${this.currentTurn.totalProcessingTimeMs}ms`);

      // Reset for next turn
      this.currentTurn = null;
      this.changeState("idle");
    }
  }

  /**
   * Build conversation context from previous turns
   */
  private buildConversationContext(): string {
    if (!this.currentSession || this.currentSession.turns.length === 0) {
      return "";
    }

    const recentTurns = this.currentSession.turns.slice(-this.config.maxContextTurns);

    const context = recentTurns
      .map(
        (turn) => `
Teacher: ${turn.transcription.alternatives[0]?.transcript || ""}
Sunita: ${turn.assistantResponse}`
      )
      .join("\n\n");

    return `\n\nPrevious conversation:\n${context}\n\nCurrent question:`;
  }

  /**
   * Merge audio chunks into a single buffer
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async mergeAudioChunks(_chunks: AudioChunk[]): Promise<ArrayBuffer> {
    // Simplified implementation - in real scenario would merge actual audio data
    // For now, return empty buffer (will be handled by mock/actual STT service)
    return new ArrayBuffer(0);
  }

  /**
   * Change pipeline state and emit event
   */
  private changeState(newState: VoicePipelineState): void {
    const previousState = this.state;
    this.state = newState;

    if (previousState !== newState) {
      this.emitEvent({
        type: "state_change",
        timestamp: new Date().toISOString(),
        sessionId: this.currentSession?.id || "",
        turnId: this.currentTurn?.id || "",
        state: newState,
        data: { previousState },
      });
    }
  }

  /**
   * Emit an event to all subscribers
   */
  private emitEvent(event: VoicePipelineEvent): void {
    this.eventCallbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error("[VoicePipeline] Error in event callback:", error);
      }
    });
  }

  /**
   * Handle pipeline error
   */
  private handleError(type: VoicePipelineErrorType, error: Error, stage: "audio" | "stt" | "rag" | "tts" | "general"): void {
    this.stats.totalErrors++;
    const count = this.stats.errorCounts.get(type) || 0;
    this.stats.errorCounts.set(type, count + 1);

    const pipelineError: VoicePipelineError = {
      type,
      message: error.message,
      stage,
      recoverable: stage !== "general",
      originalError: error,
      timestamp: new Date().toISOString(),
    };

    this.changeState("error");

    this.emitEvent({
      type: "error",
      timestamp: new Date().toISOString(),
      sessionId: this.currentSession?.id || "",
      turnId: this.currentTurn?.id || "",
      state: "error",
      data: { error: pipelineError },
    });

    console.error(`[VoicePipeline] Error in ${stage}:`, error);

    // Try to recover
    this.currentTurn = null;
    this.changeState("idle");
  }

  /**
   * Get STT model name
   */
  private async getSttModelName(): Promise<string> {
    // Simplified - in real implementation would query the service
    return "google-stt"; // or "whisper" depending on provider
  }

  /**
   * Get TTS model name
   */
  private async getTtsModelName(): Promise<string> {
    // Simplified - in real implementation would query the service
    const currentVoice = await this.ttsService.getCurrentVoice();
    return currentVoice?.id || "default";
  }
}
