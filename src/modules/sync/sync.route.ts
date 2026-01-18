import { Router } from "express";
import { getSyncRulesController, connectionTestController, deltaSyncController, compareVersionsController } from "./sync.controller.js";

const router = Router();

/**
 * GET /api/sync/rules
 *
 * Get current synchronization rules
 */
router.get("/rules", getSyncRulesController);

/**
 * GET /api/sync/ping
 *
 * Connection quality test endpoint
 */
router.get("/ping", connectionTestController);

/**
 * POST /api/sync/delta
 *
 * Get delta changes since local version
 * Body: { localVersion: string, deviceId?: string, limit?: number, offset?: number }
 */
router.post("/delta", deltaSyncController);

/**
 * GET /api/sync/compare
 *
 * Compare local version with latest without fetching data
 * Query: ?localVersion=2026.01.18.100000
 */
router.get("/compare", compareVersionsController);

export default router;
