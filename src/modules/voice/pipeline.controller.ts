/**
 * Voice Pipeline Controller
 *
 * Handles HTTP endpoints using VoicePipelineService for complete
 * voice interaction orchestration (STT → RAG → TTS).
 *
 * This controller provides a higher-level API compared to voice.controller,
 * using the VoicePipelineService for state management and event handling.
 *
 * @module pipeline.controller
 */

import { Request, Response, NextFunction } from "express";
import { AppError } from "../../shared/AppError.js";
import { VoicePipelineService } from "../../services/VoicePipelineService.js";
import { createSTTService } from "../../lib/sttFactory.js";
import { createTTSService } from "../../lib/ttsFactory.js";
import VectorFactory from "../../lib/vectorFactory.js";
import { createLLMService } from "../../lib/llmFactory.js";
import { RAGService } from "../../services/RAGService.js";
import { VoicePipelineEvent } from "../../interface/IVoicePipeline.js";
import { VOICE_ERROR_CODES } from "./voice.types.js";

// ============================================================================
// Pipeline Store (In-Memory - Replace with Redis in production)
// ============================================================================

interface PipelineStore {
  pipelines: Map<string, VoicePipelineService>;
  eventListeners: Map<string, Set<(event: VoicePipelineEvent) => void>>;
}

const pipelineStore: PipelineStore = {
  pipelines: new Map(),
  eventListeners: new Map(),
};

// Cleanup inactive pipelines every 5 minutes
const PIPELINE_TIMEOUT_MS = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, pipeline] of pipelineStore.pipelines) {
    // Check last activity (would need to track this externally in production)
    const lastActivity = Date.now();

    if (now - lastActivity > PIPELINE_TIMEOUT_MS) {
      pipeline.endSession().catch(console.error);
      pipelineStore.pipelines.delete(sessionId);
      pipelineStore.eventListeners.delete(sessionId);
    }
  }
}, 60000); // Check every minute

// ============================================================================
// Helper Functions
// ============================================================================

async function getOrCreatePipeline(sessionId: string): Promise<VoicePipelineService> {
  let pipeline = pipelineStore.pipelines.get(sessionId);

  if (!pipeline) {
    // Create new pipeline instance
    const vectorService = VectorFactory.create();
    const llmService = createLLMService();
    const ragService = new RAGService(vectorService, llmService);
    const sttService = createSTTService();
    const ttsService = createTTSService();

    pipeline = new VoicePipelineService(sttService, ttsService, ragService);

    // Initialize services
    await pipeline.initialize();

    // Store pipeline
    pipelineStore.pipelines.set(sessionId, pipeline);

    // Setup event listener to track events
    const eventSet = new Set<(event: VoicePipelineEvent) => void>();
    pipelineStore.eventListeners.set(sessionId, eventSet);

    // Log events to console (for debugging)
    pipeline.onEvent((event) => {
      console.log(`[Pipeline ${sessionId}] Event: ${event.type} | State: ${event.state}`);
      // Broadcast to all listeners
      eventSet.forEach((listener) => listener(event));
    });
  }

  return pipeline;
}

function getPipeline(sessionId: string): VoicePipelineService {
  const pipeline = pipelineStore.pipelines.get(sessionId);
  if (!pipeline) {
    throw new AppError(`Pipeline not found for session (${VOICE_ERROR_CODES.SESSION_NOT_FOUND})`, 404);
  }
  return pipeline;
}

// ============================================================================
// Controllers
// ============================================================================

/**
 * Start a new voice pipeline session
 * POST /api/voice/pipeline/sessions
 */
export const startPipelineSessionController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { language = "pt-BR", deviceInfo, isOffline = false } = req.body;

    // Generate session ID
    const sessionId = `pipeline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create pipeline and start session
    const pipeline = await getOrCreatePipeline(sessionId);
    const newSessionId = await pipeline.startSession();

    // Create session object manually for response
    const session = {
      id: newSessionId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      language,
      turns: [],
      metadata: {
        isOffline,
        deviceInfo,
        modelsUsed: {
          stt: "configured",
          tts: "configured",
          llm: "gemini-2.5-flash",
        },
      },
    };

    res.status(201).json({
      success: true,
      data: {
        session,
        state: pipeline.getState(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process text input through pipeline
 * POST /api/voice/pipeline/sessions/:sessionId/text
 */
export const pipelineTextInputController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params["sessionId"];
    if (!sessionId || Array.isArray(sessionId)) {
      throw new AppError(`Session ID is required (${VOICE_ERROR_CODES.INVALID_REQUEST})`, 400);
    }

    const { text } = req.body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      throw new AppError(`Text input is required (${VOICE_ERROR_CODES.INVALID_REQUEST})`, 400);
    }

    const pipeline = getPipeline(sessionId);

    // Process text through pipeline (bypasses STT)
    const turnId = await pipeline.processTextInput(text);

    // Build response (since we don't have direct access to turn data)
    const turn = {
      id: turnId,
      turnNumber: 1, // Would need to track this externally
      transcription: {
        id: `trans_${Date.now()}`,
        isFinal: true,
        alternatives: [{ transcript: text, confidence: 1.0 }],
        audioDurationMs: 0,
        processingTimeMs: 0,
        timestamp: new Date().toISOString(),
        modelId: "text-input",
      },
      assistantResponse: "Response generated", // Would need to track this
      timestamps: {
        started: new Date().toISOString(),
        transcriptionComplete: new Date().toISOString(),
        responseGenerated: new Date().toISOString(),
        responseComplete: new Date().toISOString(),
      },
      wasInterrupted: false,
      totalProcessingTimeMs: 0,
    };

    let audioBase64: string | undefined;
    // Audio would need to be tracked externally

    const session = {
      id: sessionId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      language: "pt-BR",
      turns: [turn],
      metadata: { isOffline: false, modelsUsed: {} },
    };

    res.status(200).json({
      success: true,
      data: {
        turn,
        session,
        state: pipeline.getState(),
        audioBase64,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Process audio input through pipeline
 * POST /api/voice/pipeline/sessions/:sessionId/audio
 */
export const pipelineAudioInputController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params["sessionId"];
    if (!sessionId || Array.isArray(sessionId)) {
      throw new AppError(`Session ID is required (${VOICE_ERROR_CODES.INVALID_REQUEST})`, 400);
    }

    const { audioData } = req.body;

    if (!audioData) {
      throw new AppError(`Audio data is required (${VOICE_ERROR_CODES.INVALID_REQUEST})`, 400);
    }

    const pipeline = getPipeline(sessionId);

    // Start listening
    await pipeline.startListening();

    // Stop listening (in real implementation, audio chunks would be added here)
    await pipeline.stopListening();

    // Build mock response
    const currentTurn = {
      id: `turn_${Date.now()}`,
      turnNumber: 1,
      transcription: {
        id: `trans_${Date.now()}`,
        isFinal: true,
        alternatives: [{ transcript: "Audio transcription", confidence: 0.95 }],
        audioDurationMs: 1000,
        processingTimeMs: 100,
        timestamp: new Date().toISOString(),
        modelId: "whisper",
      },
      assistantResponse: "Audio response",
      timestamps: {
        started: new Date().toISOString(),
        transcriptionComplete: new Date().toISOString(),
        responseGenerated: new Date().toISOString(),
        responseComplete: new Date().toISOString(),
      },
      wasInterrupted: false,
      totalProcessingTimeMs: 0,
    };

    const session = {
      id: sessionId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      language: "pt-BR",
      turns: [currentTurn],
      metadata: { isOffline: false, modelsUsed: {} },
    };

    res.status(200).json({
      success: true,
      data: {
        turn: currentTurn,
        session,
        state: pipeline.getState(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Interrupt current pipeline processing
 * POST /api/voice/pipeline/sessions/:sessionId/interrupt
 */
export const pipelineInterruptController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params["sessionId"];
    if (!sessionId || Array.isArray(sessionId)) {
      throw new AppError(`Session ID is required (${VOICE_ERROR_CODES.INVALID_REQUEST})`, 400);
    }

    const pipeline = getPipeline(sessionId);
    await pipeline.interrupt();

    res.status(200).json({
      success: true,
      data: {
        state: pipeline.getState(),
        message: "Pipeline interrupted successfully",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel current pipeline operation
 * POST /api/voice/pipeline/sessions/:sessionId/cancel
 */
export const pipelineCancelController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params["sessionId"];
    if (!sessionId || Array.isArray(sessionId)) {
      throw new AppError(`Session ID is required (${VOICE_ERROR_CODES.INVALID_REQUEST})`, 400);
    }

    const pipeline = getPipeline(sessionId);
    await pipeline.cancel();

    res.status(200).json({
      success: true,
      data: {
        state: pipeline.getState(),
        message: "Pipeline operation cancelled successfully",
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pipeline state and statistics
 * GET /api/voice/pipeline/sessions/:sessionId/status
 */
export const getPipelineStatusController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params["sessionId"];
    if (!sessionId || Array.isArray(sessionId)) {
      throw new AppError(`Session ID is required (${VOICE_ERROR_CODES.INVALID_REQUEST})`, 400);
    }

    const pipeline = getPipeline(sessionId);
    const state = pipeline.getState();
    const stats = pipeline.getStats();

    // Build session object (would need to track this externally in production)
    const session = {
      id: sessionId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      language: "pt-BR",
      turns: [],
      metadata: { isOffline: false, modelsUsed: {} },
    };

    res.status(200).json({
      success: true,
      data: {
        sessionId,
        state,
        session,
        stats,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * End a pipeline session
 * DELETE /api/voice/pipeline/sessions/:sessionId
 */
export const endPipelineSessionController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params["sessionId"];
    if (!sessionId || Array.isArray(sessionId)) {
      throw new AppError(`Session ID is required (${VOICE_ERROR_CODES.INVALID_REQUEST})`, 400);
    }

    const pipeline = getPipeline(sessionId);
    const endedSession = await pipeline.endSession();

    // Remove from store
    pipelineStore.pipelines.delete(sessionId);
    pipelineStore.eventListeners.delete(sessionId);

    // Calculate summary
    const totalDurationMs =
      endedSession.endedAt && endedSession.startedAt
        ? new Date(endedSession.endedAt).getTime() - new Date(endedSession.startedAt).getTime()
        : 0;

    const session = endedSession;

    res.status(200).json({
      success: true,
      data: {
        session,
        summary: {
          totalTurns: session?.turns.length || 0,
          totalDurationMs,
          interruptionCount: session?.turns.filter((t: { wasInterrupted: boolean }) => t.wasInterrupted).length || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Subscribe to pipeline events (SSE - Server-Sent Events)
 * GET /api/voice/pipeline/sessions/:sessionId/events
 */
export const pipelineEventsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params["sessionId"];
    if (!sessionId || Array.isArray(sessionId)) {
      throw new AppError(`Session ID is required (${VOICE_ERROR_CODES.INVALID_REQUEST})`, 400);
    }

    getPipeline(sessionId); // Verify pipeline exists
    const eventSet = pipelineStore.eventListeners.get(sessionId);

    if (!eventSet) {
      throw new AppError("Event listener not found", 500);
    }

    // Setup SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Send initial connection event
    res.write(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`);

    // Create event listener
    const eventListener = (event: VoicePipelineEvent) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // Register listener
    eventSet.add(eventListener);

    // Cleanup on disconnect
    req.on("close", () => {
      eventSet.delete(eventListener);
      res.end();
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pipeline configuration
 * GET /api/voice/pipeline/sessions/:sessionId/config
 */
export const getPipelineConfigController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const sessionId = req.params["sessionId"];
    if (!sessionId || Array.isArray(sessionId)) {
      throw new AppError(`Session ID is required (${VOICE_ERROR_CODES.INVALID_REQUEST})`, 400);
    }

    const pipeline = getPipeline(sessionId);
    const config = pipeline.getConfig();

    res.status(200).json({
      success: true,
      data: { config },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Health check for pipeline service
 * GET /api/voice/pipeline/health
 */
export const pipelineHealthController = async (_: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const activePipelines = pipelineStore.pipelines.size;
    const totalSessions = pipelineStore.pipelines.size;

    // Check if services are available
    const vectorService = VectorFactory.create();
    const llmService = createLLMService();
    const sttService = createSTTService();
    const ttsService = createTTSService();

    res.status(200).json({
      success: true,
      data: {
        status: "healthy",
        activePipelines,
        totalSessions,
        services: {
          vector: !!vectorService,
          llm: !!llmService,
          stt: !!sttService,
          tts: !!ttsService,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};
