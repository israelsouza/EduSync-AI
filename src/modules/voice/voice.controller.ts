/**
 * Voice Controller
 *
 * Handles HTTP endpoints for voice interaction with Sunita assistant.
 * Provides session management, audio processing, and real-time interaction.
 *
 * @module voice.controller
 */

import { Request, Response, NextFunction } from "express";
import { AppError } from "../../shared/AppError.js";
import {
  StartSessionRequest,
  StartSessionResponse,
  EndSessionResponse,
  TextInputRequest,
  VoiceInteractionResponse,
  AudioInputRequest,
  PipelineStatusResponse,
  AvailableModelsResponse,
  VoiceConfigResponse,
  VoiceStatsResponse,
  VOICE_ERROR_CODES,
} from "./voice.types.js";
import { DEFAULT_STT_CONFIG, SupportedLanguage } from "../../interface/ISTTService.js";
import { DEFAULT_TTS_CONFIG } from "../../interface/ITTSService.js";
import { DEFAULT_VOICE_PIPELINE_CONFIG, VoiceSession, VoiceTurn } from "../../interface/IVoicePipeline.js";
import VectorFactory from "../../lib/vectorFactory.js";
import { createLLMService } from "../../lib/llmFactory.js";
import { RAGService } from "../../services/RAGService.js";
import { SearchResult } from "../../interface/IVectorService.js";
import { createSTTService } from "../../lib/sttFactory.js";
import { createTTSService } from "../../lib/ttsFactory.js";
import { ITTSService } from "../../interface/ITTSService.js";

// ============================================================================
// In-Memory Session Store (Replace with Redis/Database in production)
// ============================================================================

interface SessionStore {
  sessions: Map<string, VoiceSession>;
  stats: {
    totalSessions: number;
    totalTurns: number;
    totalTranscriptionTimeMs: number;
    totalRagTimeMs: number;
    totalTtsTimeMs: number;
    totalTurnTimeMs: number;
    interruptionCount: number;
    errorCount: number;
  };
}

const sessionStore: SessionStore = {
  sessions: new Map(),
  stats: {
    totalSessions: 0,
    totalTurns: 0,
    totalTranscriptionTimeMs: 0,
    totalRagTimeMs: 0,
    totalTtsTimeMs: 0,
    totalTurnTimeMs: 0,
    interruptionCount: 0,
    errorCount: 0,
  },
};

// Session cleanup interval (5 minutes)
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of sessionStore.sessions) {
    const lastTurn = session.turns[session.turns.length - 1];
    const lastActivity = lastTurn ? new Date(lastTurn.timestamps.responseComplete).getTime() : new Date(session.startedAt).getTime();

    if (now - lastActivity > SESSION_TIMEOUT_MS) {
      session.endedAt = new Date().toISOString();
      sessionStore.sessions.delete(sessionId);
    }
  }
}, 60000); // Check every minute

// RAG service singleton (lazy)
let ragServiceInstance: RAGService | null = null;
async function getRagService(): Promise<RAGService> {
  if (!ragServiceInstance) {
    const vectorService = VectorFactory.create();
    const llmService = createLLMService();
    ragServiceInstance = new RAGService(vectorService, llmService);
  }
  return ragServiceInstance;
}

// TTS service singleton (lazy)
let ttsServiceInstance: ITTSService | null = null;
async function getTTSService(): Promise<ITTSService> {
  if (!ttsServiceInstance) {
    ttsServiceInstance = createTTSService();
    await ttsServiceInstance.initialize();
  }
  return ttsServiceInstance;
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateSessionId(): string {
  return `voice_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateTurnId(): string {
  return `turn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getSession(sessionId: string): VoiceSession {
  const session = sessionStore.sessions.get(sessionId);
  if (!session) {
    throw new AppError(`Session not found or expired (${VOICE_ERROR_CODES.SESSION_NOT_FOUND})`, 404);
  }
  if (session.endedAt) {
    throw new AppError(`Session has ended (${VOICE_ERROR_CODES.SESSION_EXPIRED})`, 400);
  }
  return session;
}

// ============================================================================
// Controllers
// ============================================================================

/**
 * Start a new voice session
 * POST /api/voice/sessions
 */
export const startSessionController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { language = "pt-BR", deviceInfo, isOffline = false } = req.body as StartSessionRequest;

    // Validate language
    const validLanguages: SupportedLanguage[] = ["pt-BR", "es-ES", "es-MX", "es-419", "en-US", "auto"];
    if (!validLanguages.includes(language)) {
      throw new AppError(`Invalid language: ${language} (${VOICE_ERROR_CODES.STT_LANGUAGE_NOT_SUPPORTED})`, 400);
    }

    const sessionId = generateSessionId();
    const now = new Date().toISOString();

    const session: VoiceSession = {
      id: sessionId,
      startedAt: now,
      endedAt: null,
      language,
      turns: [],
      metadata: {
        ...(deviceInfo && { deviceInfo }),
        isOffline,
        modelsUsed: {
          stt: "whisper-small-pt", // Placeholder - would come from actual service
          tts: "piper-sunita-pt-br",
          llm: "gemini-2.5-flash",
        },
      },
    };

    sessionStore.sessions.set(sessionId, session);
    sessionStore.stats.totalSessions++;

    const response: StartSessionResponse = {
      success: true,
      data: {
        sessionId,
        language,
        isReady: true,
        componentStatus: {
          audio: { ready: true, hasPermission: true },
          stt: { ready: true, modelLoaded: true },
          tts: { ready: true, voiceLoaded: true },
          rag: { ready: true },
        },
      },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * End a voice session
 * POST /api/voice/sessions/:sessionId/end
 */
export const endSessionController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params["sessionId"];
    if (!sessionId || Array.isArray(sessionId)) {
      throw new AppError(`Session ID is required (${VOICE_ERROR_CODES.INVALID_REQUEST})`, 400);
    }

    const session = getSession(sessionId);
    session.endedAt = new Date().toISOString();

    // Calculate session summary
    const totalDurationMs = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
    const totalTurns = session.turns.length;
    const interruptionCount = session.turns.filter((t) => t.wasInterrupted).length;
    const averageTurnTimeMs = totalTurns > 0 ? session.turns.reduce((sum, t) => sum + t.totalProcessingTimeMs, 0) / totalTurns : 0;

    const response: EndSessionResponse = {
      success: true,
      data: {
        session,
        summary: {
          totalTurns,
          totalDurationMs,
          averageTurnTimeMs: Math.round(averageTurnTimeMs),
          interruptionCount,
        },
      },
    };

    // Keep session for history but mark as ended
    // In production, persist to database and remove from memory

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Process text input (bypass audio/STT)
 * POST /api/voice/sessions/:sessionId/text
 */
export const textInputController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params["sessionId"];
    if (!sessionId || Array.isArray(sessionId)) {
      throw new AppError(`Session ID is required (${VOICE_ERROR_CODES.INVALID_REQUEST})`, 400);
    }

    const { text, speakResponse = false } = req.body as TextInputRequest;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      throw new AppError(`Text input is required (${VOICE_ERROR_CODES.INVALID_REQUEST})`, 400);
    }

    const session = getSession(sessionId);
    const turnNumber = session.turns.length + 1;
    const turnId = generateTurnId();

    const timestamps = {
      started: new Date().toISOString(),
      transcriptionComplete: new Date().toISOString(), // Immediate for text input
      responseGenerated: "",
      responseComplete: "",
    };

    // Get RAG response
    const ragStartTime = Date.now();

    // Build conversation context (last 3 turns) as plain text
    const conversationHistory = session.turns
      .slice(-3)
      .map((t) => t.transcription.alternatives[0]?.transcript || "")
      .filter((p) => p.length > 0)
      .join("\n");

    // Use RAGService to generate response
    const rag = await getRagService();
    const ragResponse = await rag.generateResponse(text, conversationHistory);

    const ragEndTime = Date.now();
    timestamps.responseGenerated = new Date().toISOString();

    // TTS synthesis (using real TTS service)
    let audioBase64: string | undefined;
    let audioDurationMs: number | undefined;
    let ttsTimeMs = 0;

    if (speakResponse) {
      try {
        const ttsStartTime = Date.now();
        const tts = await getTTSService();
        const synthesisResult = await tts.synthesize(ragResponse.answer, {
          voiceId: session.language === "pt-BR" ? "sunita-pt-br" : session.language === "es-419" ? "sunita-es-419" : "sunita-en-us",
          outputFormat: "mp3",
          rate: 1.0,
        });
        ttsTimeMs = Date.now() - ttsStartTime;

        // Convert ArrayBuffer to Base64
        audioBase64 = Buffer.from(synthesisResult.audioData).toString("base64");
        audioDurationMs = synthesisResult.durationMs;

        sessionStore.stats.totalTtsTimeMs += ttsTimeMs;
        console.log(`[Voice] TTS synthesis completed in ${ttsTimeMs}ms`);
      } catch (ttsError) {
        console.error("[Voice] TTS synthesis failed:", ttsError);
        // Continue without audio - graceful degradation
      }
    }

    timestamps.responseComplete = new Date().toISOString();

    const totalProcessingTimeMs = Date.now() - new Date(timestamps.started).getTime();

    // Create turn record
    const turn: VoiceTurn = {
      id: turnId,
      turnNumber,
      userAudio: {
        chunks: [],
        durationMs: 0,
      },
      transcription: {
        id: `transcription_${turnId}`,
        isFinal: true,
        alternatives: [
          {
            transcript: text,
            confidence: 1.0,
          },
        ],
        audioDurationMs: 0,
        processingTimeMs: 0,
        timestamp: timestamps.transcriptionComplete,
        modelId: "text-input",
      },
      assistantResponse: ragResponse.answer,
      wasInterrupted: false,
      ragContextIds: ragResponse.sources
        ?.map((s: SearchResult) => s.metadata?.id || "unknown")
        .filter((id): id is string => id !== undefined),
      timestamps,
      totalProcessingTimeMs,
    };

    session.turns.push(turn);

    // Update stats
    sessionStore.stats.totalTurns++;
    sessionStore.stats.totalRagTimeMs += ragEndTime - ragStartTime;
    sessionStore.stats.totalTurnTimeMs += totalProcessingTimeMs;

    const response: VoiceInteractionResponse = {
      success: true,
      data: {
        turn,
        response: ragResponse.answer,
        ...(audioBase64 && { audioBase64 }),
        ...(audioDurationMs && { audioDurationMs }),
        ragSources: ragResponse.sources?.map((s: SearchResult) => {
          const meta = s.metadata as Record<string, unknown> | undefined;
          return {
            id: meta?.["id"] ? String(meta["id"]) : "unknown",
            title: meta?.["source"] ? String(meta["source"]) : "Unknown",
            similarity: s.score ?? 0,
          };
        }),
      },
    };

    res.status(200).json(response);
  } catch (error) {
    sessionStore.stats.errorCount++;
    next(error);
  }
};

/**
 * Process audio input
 * POST /api/voice/sessions/:sessionId/audio
 */
export const audioInputController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params["sessionId"];
    if (!sessionId || Array.isArray(sessionId)) {
      throw new AppError(`Session ID is required (${VOICE_ERROR_CODES.INVALID_REQUEST})`, 400);
    }

    const { audioBase64, format, sampleRate = 16000, speakResponse = false } = req.body as AudioInputRequest;

    if (!audioBase64 || typeof audioBase64 !== "string") {
      throw new AppError(`Audio data is required (${VOICE_ERROR_CODES.AUDIO_FORMAT_INVALID})`, 400);
    }

    const validFormats = ["pcm", "wav", "mp3", "opus"];
    if (!validFormats.includes(format)) {
      throw new AppError(`Invalid audio format: ${format} (${VOICE_ERROR_CODES.AUDIO_FORMAT_INVALID})`, 400);
    }

    const session = getSession(sessionId);
    const turnNumber = session.turns.length + 1;
    const turnId = generateTurnId();

    const timestamps = {
      started: new Date().toISOString(),
      transcriptionComplete: "",
      responseGenerated: "",
      responseComplete: "",
    };

    // 1. Transcribe audio
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const stt = createSTTService();
    const transcription = await stt.transcribe(audioBuffer.buffer, {
      encoding: format,
      sampleRateHertz: sampleRate,
      language: session.language,
    });

    timestamps.transcriptionComplete = new Date().toISOString();
    const transcribedText = transcription.alternatives[0]?.transcript || "";

    if (!transcribedText) {
      throw new AppError("Speech not recognized", 400);
    }

    // 2. Get RAG response (same logic as text input)
    const ragStartTime = Date.now();
    const conversationHistory = session.turns
      .slice(-3)
      .map((t) => t.transcription.alternatives[0]?.transcript || "")
      .filter((p) => p.length > 0)
      .join("\n");

    const rag = await getRagService();
    const ragResponse = await rag.generateResponse(transcribedText, conversationHistory);

    const ragEndTime = Date.now();
    timestamps.responseGenerated = new Date().toISOString();

    // 3. TTS synthesis (using real TTS service)
    let audioResponseBase64: string | undefined;
    let audioDurationMs: number | undefined;
    let ttsTimeMs = 0;

    if (speakResponse) {
      try {
        const ttsStartTime = Date.now();
        const tts = await getTTSService();
        const synthesisResult = await tts.synthesize(ragResponse.answer, {
          voiceId: session.language === "pt-BR" ? "sunita-pt-br" : session.language === "es-419" ? "sunita-es-419" : "sunita-en-us",
          outputFormat: "mp3",
          rate: 1.0,
        });
        ttsTimeMs = Date.now() - ttsStartTime;

        audioResponseBase64 = Buffer.from(synthesisResult.audioData).toString("base64");
        audioDurationMs = synthesisResult.durationMs;

        sessionStore.stats.totalTtsTimeMs += ttsTimeMs;
        console.log(`[Voice] TTS synthesis completed in ${ttsTimeMs}ms`);
      } catch (ttsError) {
        console.error("[Voice] TTS synthesis failed:", ttsError);
        // Continue without audio - graceful degradation
      }
    }

    timestamps.responseComplete = new Date().toISOString();
    const totalProcessingTimeMs = Date.now() - new Date(timestamps.started).getTime();

    // 4. Create turn record
    const turn: VoiceTurn = {
      id: turnId,
      turnNumber,
      userAudio: {
        chunks: [],
        durationMs: transcription.audioDurationMs,
      },
      transcription: {
        ...transcription,
        id: transcription.id || `transcription_${turnId}`,
      },
      assistantResponse: ragResponse.answer,
      wasInterrupted: false,
      ragContextIds: ragResponse.sources
        ?.map((s: SearchResult) => s.metadata?.id || "unknown")
        .filter((id): id is string => id !== undefined),
      timestamps,
      totalProcessingTimeMs,
    };

    session.turns.push(turn);

    // Update stats
    sessionStore.stats.totalTurns++;
    sessionStore.stats.totalTranscriptionTimeMs += Date.now() - new Date(timestamps.started).getTime();
    sessionStore.stats.totalRagTimeMs += ragEndTime - ragStartTime;
    sessionStore.stats.totalTurnTimeMs += totalProcessingTimeMs;

    const response: VoiceInteractionResponse = {
      success: true,
      data: {
        turn,
        response: ragResponse.answer,
        ...(audioResponseBase64 && { audioBase64: audioResponseBase64 }),
        ...(audioDurationMs && { audioDurationMs }),
        ragSources: ragResponse.sources?.map((s: SearchResult) => {
          const meta = s.metadata as Record<string, unknown> | undefined;
          return {
            id: meta?.["id"] ? String(meta["id"]) : "unknown",
            title: meta?.["source"] ? String(meta["source"]) : "Unknown",
            similarity: s.score ?? 0,
          };
        }),
      },
    };

    res.status(200).json(response);
  } catch (error) {
    sessionStore.stats.errorCount++;
    next(error);
  }
};

/**
 * Get pipeline status
 * GET /api/voice/status
 */
export const getPipelineStatusController = async (_: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Find active session (most recent non-ended session)
    let currentSession: PipelineStatusResponse["data"]["currentSession"] = null;
    for (const [, session] of sessionStore.sessions) {
      if (!session.endedAt) {
        currentSession = {
          id: session.id,
          turnsCount: session.turns.length,
          startedAt: session.startedAt,
        };
        break;
      }
    }

    const response: PipelineStatusResponse = {
      success: true,
      data: {
        state: currentSession ? "idle" : "idle",
        currentSession,
        currentTurn: null,
        components: {
          audio: {
            ready: true,
            hasPermission: true,
            state: "idle",
          },
          stt: {
            ready: true,
            modelId: "whisper-small-pt",
            modelLoaded: true,
          },
          tts: {
            ready: true,
            voiceId: "piper-sunita-pt-br",
            voiceLoaded: true,
          },
          rag: {
            ready: true,
            embeddingsCount: 0, // Would query from vector service
          },
        },
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get available models
 * GET /api/voice/models
 */
export const getAvailableModelsController = async (_: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Placeholder model list - in production, query actual available models
    const response: AvailableModelsResponse = {
      success: true,
      data: {
        stt: [
          {
            id: "whisper-tiny-pt",
            name: "Whisper Tiny (Portuguese)",
            languages: ["pt-BR"],
            sizeBytes: 75 * 1024 * 1024, // 75MB
            isDownloaded: false,
          },
          {
            id: "whisper-small-pt",
            name: "Whisper Small (Portuguese)",
            languages: ["pt-BR", "es-ES", "es-MX", "es-419"],
            sizeBytes: 244 * 1024 * 1024, // 244MB
            isDownloaded: true,
          },
          {
            id: "whisper-small-multilingual",
            name: "Whisper Small (Multilingual)",
            languages: ["pt-BR", "es-ES", "es-MX", "es-419", "en-US"],
            sizeBytes: 244 * 1024 * 1024,
            isDownloaded: false,
          },
        ],
        tts: [
          {
            id: "piper-sunita-pt-br",
            name: "Sunita (Portuguese BR)",
            language: "pt-BR",
            gender: "female",
            sizeBytes: 45 * 1024 * 1024, // 45MB
            isDownloaded: true,
          },
          {
            id: "piper-sunita-es",
            name: "Sunita (Spanish)",
            language: "es-419",
            gender: "female",
            sizeBytes: 45 * 1024 * 1024,
            isDownloaded: false,
          },
          {
            id: "piper-sunita-en",
            name: "Sunita (English)",
            language: "en-US",
            gender: "female",
            sizeBytes: 45 * 1024 * 1024,
            isDownloaded: false,
          },
        ],
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get voice configuration
 * GET /api/voice/config
 */
export const getVoiceConfigController = async (_: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const response: VoiceConfigResponse = {
      success: true,
      data: {
        audio: {
          sampleRate: 16000,
          channels: 1,
          vadEnabled: true,
          vadThreshold: 0.02,
          maxRecordingMs: 60000,
        },
        stt: {
          language: DEFAULT_STT_CONFIG.language,
          enablePunctuation: DEFAULT_STT_CONFIG.enablePunctuation,
          maxAlternatives: DEFAULT_STT_CONFIG.maxAlternatives,
          modelId: "whisper-small-pt",
        },
        tts: {
          voiceId: DEFAULT_TTS_CONFIG.defaultVoiceId,
          rate: 1.0,
          pitch: 0,
          volume: 1.0,
        },
        pipeline: {
          enableInterruption: DEFAULT_VOICE_PIPELINE_CONFIG.enableInterruption,
          enableAudioFeedback: DEFAULT_VOICE_PIPELINE_CONFIG.enableAudioFeedback,
          maxTurnsPerSession: DEFAULT_VOICE_PIPELINE_CONFIG.maxTurnsPerSession,
          sessionTimeoutMs: DEFAULT_VOICE_PIPELINE_CONFIG.sessionTimeoutMs,
          enableConversationContext: DEFAULT_VOICE_PIPELINE_CONFIG.enableConversationContext,
          maxContextTurns: DEFAULT_VOICE_PIPELINE_CONFIG.maxContextTurns,
        },
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Update voice configuration
 * PATCH /api/voice/config
 */
export const updateVoiceConfigController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate and apply configuration
    // In production, this would update the actual service configurations

    // For now, just echo back the merged configuration
    await getVoiceConfigController(req, res, next);
  } catch (error) {
    next(error);
  }
};

/**
 * Get voice statistics
 * GET /api/voice/stats
 */
export const getVoiceStatsController = async (_: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = sessionStore.stats;

    const avgTranscriptionTimeMs = stats.totalTurns > 0 ? Math.round(stats.totalTranscriptionTimeMs / stats.totalTurns) : 0;
    const avgRagTimeMs = stats.totalTurns > 0 ? Math.round(stats.totalRagTimeMs / stats.totalTurns) : 0;
    const avgTtsTimeMs = stats.totalTurns > 0 ? Math.round(stats.totalTtsTimeMs / stats.totalTurns) : 0;
    const avgTotalTurnTimeMs = stats.totalTurns > 0 ? Math.round(stats.totalTurnTimeMs / stats.totalTurns) : 0;

    const response: VoiceStatsResponse = {
      success: true,
      data: {
        totalSessions: stats.totalSessions,
        totalTurns: stats.totalTurns,
        averages: {
          transcriptionTimeMs: avgTranscriptionTimeMs,
          ragResponseTimeMs: avgRagTimeMs,
          ttsSynthesisTimeMs: avgTtsTimeMs,
          totalTurnTimeMs: avgTotalTurnTimeMs,
        },
        rates: {
          interruptionRate: stats.totalTurns > 0 ? stats.interruptionCount / stats.totalTurns : 0,
          errorRate: stats.totalTurns > 0 ? stats.errorCount / stats.totalTurns : 0,
          offlineUsageRate: 0, // Would calculate from session metadata
        },
        topQueries: [], // Would aggregate from session data
        languageDistribution: [
          { language: "pt-BR", percentage: 0.8 },
          { language: "es-419", percentage: 0.15 },
          { language: "en-US", percentage: 0.05 },
        ],
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Get session history
 * GET /api/voice/sessions
 */
export const getSessionHistoryController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(Number(req.query["limit"]) || 10, 100);

    const sessions = Array.from(sessionStore.sessions.values())
      .filter((s) => s.endedAt !== null)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);

    res.status(200).json({
      success: true,
      data: {
        sessions,
        total: sessions.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get specific session details
 * GET /api/voice/sessions/:sessionId
 */
export const getSessionController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params["sessionId"];
    if (!sessionId || Array.isArray(sessionId)) {
      throw new AppError(`Session ID is required (${VOICE_ERROR_CODES.INVALID_REQUEST})`, 400);
    }

    const session = sessionStore.sessions.get(sessionId);
    if (!session) {
      throw new AppError(`Session not found (${VOICE_ERROR_CODES.SESSION_NOT_FOUND})`, 404);
    }

    res.status(200).json({
      success: true,
      data: { session },
    });
  } catch (error) {
    next(error);
  }
};
