/**
 * Voice Routes
 *
 * API routes for voice interaction with Sunita assistant.
 *
 * @module voice.route
 */

import { Router } from "express";
import {
  startSessionController,
  endSessionController,
  textInputController,
  audioInputController,
  getPipelineStatusController,
  getAvailableModelsController,
  getVoiceConfigController,
  updateVoiceConfigController,
  getVoiceStatsController,
  getSessionHistoryController,
  getSessionController,
} from "./voice.controller.js";

const router = Router();

// ============================================================================
// Session Management Routes
// ============================================================================

/**
 * @route   POST /api/voice/sessions
 * @desc    Start a new voice session
 * @access  Public
 * @body    { language?: string, deviceInfo?: string, isOffline?: boolean }
 */
router.post("/sessions", startSessionController);

/**
 * @route   GET /api/voice/sessions
 * @desc    Get session history
 * @access  Public
 * @query   limit?: number (default: 10, max: 100)
 */
router.get("/sessions", getSessionHistoryController);

/**
 * @route   GET /api/voice/sessions/:sessionId
 * @desc    Get specific session details
 * @access  Public
 */
router.get("/sessions/:sessionId", getSessionController);

/**
 * @route   POST /api/voice/sessions/:sessionId/end
 * @desc    End a voice session
 * @access  Public
 */
router.post("/sessions/:sessionId/end", endSessionController);

// ============================================================================
// Voice Interaction Routes
// ============================================================================

/**
 * @route   POST /api/voice/sessions/:sessionId/text
 * @desc    Process text input (bypass audio/STT)
 * @access  Public
 * @body    { text: string, speakResponse?: boolean, language?: string }
 */
router.post("/sessions/:sessionId/text", textInputController);

/**
 * @route   POST /api/voice/sessions/:sessionId/audio
 * @desc    Process audio input
 * @access  Public
 * @body    { audioBase64: string, format: string, sampleRate: number, speakResponse?: boolean }
 */
router.post("/sessions/:sessionId/audio", audioInputController);

// ============================================================================
// Pipeline Status Routes
// ============================================================================

/**
 * @route   GET /api/voice/status
 * @desc    Get voice pipeline status
 * @access  Public
 */
router.get("/status", getPipelineStatusController);

/**
 * @route   GET /api/voice/stats
 * @desc    Get voice usage statistics
 * @access  Public
 */
router.get("/stats", getVoiceStatsController);

// ============================================================================
// Model Management Routes
// ============================================================================

/**
 * @route   GET /api/voice/models
 * @desc    Get available STT and TTS models
 * @access  Public
 */
router.get("/models", getAvailableModelsController);

// ============================================================================
// Configuration Routes
// ============================================================================

/**
 * @route   GET /api/voice/config
 * @desc    Get voice pipeline configuration
 * @access  Public
 */
router.get("/config", getVoiceConfigController);

/**
 * @route   PATCH /api/voice/config
 * @desc    Update voice pipeline configuration
 * @access  Public
 * @body    VoiceConfigRequest
 */
router.patch("/config", updateVoiceConfigController);

export default router;
