import { Router } from "express";
import {
  getSyncRulesController,
  connectionTestController,
  deltaSyncController,
  compareVersionsController,
  getVersionController,
  checkEligibilityController,
} from "./sync.controller.js";
import { syncOfflineQueriesController, getQueryStatsController } from "./offline-queue.controller.js";

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
 * GET /api/sync/version
 *
 * Get current embedding version and history
 */
router.get("/version", getVersionController);

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

/**
 * POST /api/sync/check-eligibility
 *
 * Validate if device is eligible to sync based on rules
 * Body: { localVersion, connectionType, batteryLevel, isCharging, freeStorageBytes }
 */
router.post("/check-eligibility", checkEligibilityController);

/**
 * POST /api/sync/queries
 *
 * Sync offline queries for analytics (requires consent)
 * Body: { queries: OfflineQueryPayload[], consentGiven: boolean }
 */
router.post("/queries", syncOfflineQueriesController);

/**
 * GET /api/sync/queries/stats
 *
 * Get aggregated query statistics for analytics dashboard
 */
router.get("/queries/stats", getQueryStatsController);

export default router;
