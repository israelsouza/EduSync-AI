/**
 * Voice Pipeline Routes
 *
 * Defines HTTP endpoints for VoicePipelineService-based interactions.
 * These routes provide a higher-level API with state management and events.
 *
 * @module pipeline.route
 */

import express from "express";
import {
  startPipelineSessionController,
  pipelineTextInputController,
  pipelineAudioInputController,
  pipelineInterruptController,
  pipelineCancelController,
  getPipelineStatusController,
  endPipelineSessionController,
  pipelineEventsController,
  getPipelineConfigController,
  pipelineHealthController,
} from "./pipeline.controller.js";

const router = express.Router();

// ============================================================================
// Pipeline Health
// ============================================================================

/**
 * @route   GET /api/voice/pipeline/health
 * @desc    Check pipeline service health
 * @access  Public
 */
router.get("/health", pipelineHealthController);

// ============================================================================
// Session Management
// ============================================================================

/**
 * @route   POST /api/voice/pipeline/sessions
 * @desc    Start a new voice pipeline session
 * @access  Public
 * @body    { language?: string, deviceInfo?: object, isOffline?: boolean, config?: object }
 */
router.post("/sessions", startPipelineSessionController);

/**
 * @route   DELETE /api/voice/pipeline/sessions/:sessionId
 * @desc    End a voice pipeline session
 * @access  Public
 */
router.delete("/sessions/:sessionId", endPipelineSessionController);

/**
 * @route   GET /api/voice/pipeline/sessions/:sessionId/status
 * @desc    Get pipeline status and statistics
 * @access  Public
 */
router.get("/sessions/:sessionId/status", getPipelineStatusController);

/**
 * @route   GET /api/voice/pipeline/sessions/:sessionId/config
 * @desc    Get pipeline configuration
 * @access  Public
 */
router.get("/sessions/:sessionId/config", getPipelineConfigController);

// ============================================================================
// Input Processing
// ============================================================================

/**
 * @route   POST /api/voice/pipeline/sessions/:sessionId/text
 * @desc    Process text input through pipeline (bypass STT)
 * @access  Public
 * @body    { text: string, includeAudio?: boolean }
 */
router.post("/sessions/:sessionId/text", pipelineTextInputController);

/**
 * @route   POST /api/voice/pipeline/sessions/:sessionId/audio
 * @desc    Process audio input through pipeline (STT → RAG → TTS)
 * @access  Public
 * @body    { audioData: string (base64), format?: string, includeAudio?: boolean }
 */
router.post("/sessions/:sessionId/audio", pipelineAudioInputController);

// ============================================================================
// Pipeline Control
// ============================================================================

/**
 * @route   POST /api/voice/pipeline/sessions/:sessionId/interrupt
 * @desc    Interrupt current pipeline operation
 * @access  Public
 */
router.post("/sessions/:sessionId/interrupt", pipelineInterruptController);

/**
 * @route   POST /api/voice/pipeline/sessions/:sessionId/cancel
 * @desc    Cancel current pipeline operation
 * @access  Public
 */
router.post("/sessions/:sessionId/cancel", pipelineCancelController);

// ============================================================================
// Real-Time Events (SSE)
// ============================================================================

/**
 * @route   GET /api/voice/pipeline/sessions/:sessionId/events
 * @desc    Subscribe to pipeline events via Server-Sent Events (SSE)
 * @access  Public
 */
router.get("/sessions/:sessionId/events", pipelineEventsController);

export default router;
