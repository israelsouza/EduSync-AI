import { Router } from "express";
import { chatController } from "./chat.controller.js";

const router = Router();

/**
 * POST /chat
 *
 * Generate a pedagogical response using RAG pipeline.
 *
 * Request Body:
 * {
 *   "query": "Como ensinar subtração com zero?"
 * }
 *
 * Response:
 * {
 *   "answer": "Sunita's response...",
 *   "sources": [...],
 *   "confidence": 0.85,
 *   "isLowConfidence": false,
 *   "model": { "provider": "google", "model": "gemini-2.5-flash" }
 * }
 */
router.post("/", chatController);

export default router;
