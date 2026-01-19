import { Router } from "express";
import { exportEmbeddingsController } from "./export.controller.js";

const router = Router();

/**
 * GET /api/export/embeddings
 *
 * Export embeddings for offline mobile usage
 *
 * Query Parameters:
 * - version (optional): Specific version to download
 * - limit (optional, default 1000): Max embeddings per request
 * - offset (optional, default 0): Pagination offset
 */
router.get("/embeddings", exportEmbeddingsController);

export default router;
