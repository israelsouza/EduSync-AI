import { Request, Response, NextFunction } from "express";
import { SyncRules, DEFAULT_SYNC_RULES } from "../../interface/IConnectivityService.js";
import { DeltaSyncRequest, DeltaSyncResponse, VersionComparison } from "./delta-sync.types.js";
import { compareVersions, generateVersion } from "../export/version.utils.js";
import { AppError } from "../../shared/AppError.js";
import { cacheInvalidationService } from "../../services/CacheInvalidationService.js";

/**
 * Get Sync Rules Controller
 *
 * Returns the current synchronization rules that mobile clients should follow.
 * These rules determine when the device is eligible to sync (WiFi-only, battery, etc.)
 */
export const getSyncRulesController = async (_: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // In a production system, these rules could be:
    // - Stored in database
    // - Configurable per region/user group
    // - Adjusted based on network conditions
    // - Retrieved from environment variables

    const syncRules: SyncRules = {
      ...DEFAULT_SYNC_RULES,
      // Override defaults with environment-specific rules if needed
      wifiOnly:
        process.env["SYNC_WIFI_ONLY"] === "true" ? true : process.env["SYNC_WIFI_ONLY"] === "false" ? false : DEFAULT_SYNC_RULES.wifiOnly,
      minBatteryLevel: Number(process.env["SYNC_MIN_BATTERY"]) || DEFAULT_SYNC_RULES.minBatteryLevel,
    };

    res.status(200).json({
      success: true,
      data: syncRules,
      metadata: {
        version: "1.0",
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Connection Test Controller
 *
 * Simple ping endpoint to test connection quality.
 * Frontend measures latency to determine connection quality.
 */
export const connectionTestController = async (_: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const startTime = Date.now();

    // Return minimal response for speed test
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      serverTime: startTime,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delta Sync Controller
 *
 * Compares client's local version with backend and returns only changed embeddings.
 * This reduces bandwidth usage by avoiding full re-downloads.
 */
export const deltaSyncController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { localVersion } = req.body as DeltaSyncRequest;

    if (!localVersion) {
      throw new AppError("localVersion is required", 400);
    }

    // Get current latest version from backend
    const latestVersion = generateVersion();

    // Compare versions
    const versionDiff = compareVersions(latestVersion, localVersion);
    const isOutdated = versionDiff > 0;

    // For MVP, we don't have a change tracking table yet,
    // so we determine sync strategy based on version difference
    const FULL_SYNC_THRESHOLD = 10; // If >10 versions behind, do full sync
    const requiresFullSync = Math.abs(versionDiff) > FULL_SYNC_THRESHOLD;

    if (requiresFullSync) {
      // Return instruction to do full sync via /api/export/embeddings
      const response: DeltaSyncResponse = {
        success: true,
        latestVersion,
        localVersion,
        isOutdated,
        requiresFullSync: true,
        changes: [],
        totalChanges: 0,
        metadata: {
          changesSince: localVersion,
          generatedAt: new Date().toISOString(),
        },
      };

      res.status(200).json(response);
      return;
    }

    // For incremental sync, in MVP we return a simplified response
    // In production, this would query a 'embedding_changes' table
    // that tracks added/modified/deleted embeddings per version
    const response: DeltaSyncResponse = {
      success: true,
      latestVersion,
      localVersion,
      isOutdated,
      requiresFullSync: false,
      changes: [], // Empty for now - would be populated from change log
      totalChanges: 0,
      metadata: {
        changesSince: localVersion,
        generatedAt: new Date().toISOString(),
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * Version Comparison Controller
 *
 * Helper endpoint to check if local version is outdated without downloading changes.
 */
export const compareVersionsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { localVersion } = req.query;

    if (!localVersion || typeof localVersion !== "string") {
      throw new AppError("localVersion query parameter is required", 400);
    }

    const latestVersion = generateVersion();
    const versionDiff = compareVersions(latestVersion, localVersion);

    const comparison: VersionComparison = {
      isOutdated: versionDiff > 0,
      versionDiff,
      shouldFullSync: Math.abs(versionDiff) > 10,
      estimatedChanges: 0, // Would be calculated from change log in production
    };

    res.status(200).json({
      success: true,
      localVersion,
      latestVersion,
      comparison,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Current Embedding Version Controller
 *
 * Returns the latest embedding version from the database.
 * Mobile clients use this to check if they need to sync.
 */
export const getVersionController = async (_: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const latestVersion = await cacheInvalidationService.getLatestVersion();
    const versionHistory = await cacheInvalidationService.getVersionHistory(5);

    res.status(200).json({
      success: true,
      data: {
        currentVersion: latestVersion,
        timestamp: new Date().toISOString(),
        history: versionHistory,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check Sync Eligibility Request
 */
interface CheckEligibilityRequest {
  localVersion: string;
  connectionType: "wifi" | "cellular" | "ethernet" | "unknown";
  batteryLevel: number;
  isCharging: boolean;
  freeStorageBytes: number;
}

/**
 * Validates CheckEligibilityRequest body at runtime
 */
function validateCheckEligibilityRequest(body: unknown): { valid: true; data: CheckEligibilityRequest } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be an object" };
  }

  const b = body as Record<string, unknown>;

  // Required: localVersion must be string
  if (typeof b["localVersion"] !== "string" || !b["localVersion"]) {
    return { valid: false, error: "localVersion (string) is required" };
  }

  // Validate semantic version format (major.minor.patch or timestamp-based YYYY.MM.DD.HHMMSS)
  const semverPattern = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$|^\d{4}\.\d{2}\.\d{2}\.\d{6}$/;
  if (!semverPattern.test(b["localVersion"])) {
    return { valid: false, error: "localVersion must be a valid semantic version" };
  }

  // Required: connectionType must be valid enum
  const validConnectionTypes = ["wifi", "cellular", "ethernet", "unknown"];
  if (!validConnectionTypes.includes(b["connectionType"] as string)) {
    return { valid: false, error: "connectionType must be one of: wifi, cellular, ethernet, unknown" };
  }

  // Required: batteryLevel must be number between 0 and 100
  if (typeof b["batteryLevel"] !== "number" || b["batteryLevel"] < 0 || b["batteryLevel"] > 100) {
    return { valid: false, error: "batteryLevel must be a number between 0 and 100" };
  }

  // Required: isCharging must be boolean
  if (typeof b["isCharging"] !== "boolean") {
    return { valid: false, error: "isCharging must be a boolean" };
  }

  // Required: freeStorageBytes must be non-negative number
  if (typeof b["freeStorageBytes"] !== "number" || b["freeStorageBytes"] < 0) {
    return { valid: false, error: "freeStorageBytes must be a non-negative number" };
  }

  return { valid: true, data: b as unknown as CheckEligibilityRequest };
}

/**
 * Check Sync Eligibility Controller
 *
 * Validates if the device is eligible to sync based on:
 * - Connection type (WiFi only by default)
 * - Battery level (min 20%)
 * - Available storage
 * - Version status
 */
export const checkEligibilityController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validation = validateCheckEligibilityRequest(req.body);
    if (!validation.valid) {
      res.status(400).json({
        success: false,
        error: {
          code: "INVALID_REQUEST",
          message: validation.error,
        },
      });
      return;
    }

    const { localVersion, connectionType, batteryLevel, isCharging, freeStorageBytes } = validation.data;

    const blockingReasons: string[] = [];
    const syncRules = DEFAULT_SYNC_RULES;

    // Check WiFi requirement
    if (syncRules.wifiOnly && connectionType !== "wifi" && connectionType !== "ethernet") {
      blockingReasons.push("WiFi connection required for sync");
    }

    // Check battery level
    if (!isCharging && batteryLevel < syncRules.minBatteryLevel) {
      blockingReasons.push(`Battery level too low (${batteryLevel}% < ${syncRules.minBatteryLevel}%)`);
    }

    // Check storage (50MB minimum)
    const MIN_STORAGE_BYTES = 50 * 1024 * 1024;
    if (freeStorageBytes < MIN_STORAGE_BYTES) {
      blockingReasons.push(`Insufficient storage (${Math.round(freeStorageBytes / 1024 / 1024)}MB < 50MB required)`);
    }

    // Check version status
    const latestVersion = await cacheInvalidationService.getLatestVersion();
    const isOutdated = localVersion ? compareVersions(latestVersion, localVersion) > 0 : true;
    const versionDiff = localVersion ? compareVersions(latestVersion, localVersion) : 999;
    const requiresFullSync = versionDiff > 10;

    const canSync = blockingReasons.length === 0;

    res.status(200).json({
      success: true,
      data: {
        canSync,
        blockingReasons,
        syncType: canSync ? (requiresFullSync ? "full" : "delta") : "blocked",
        versionStatus: {
          localVersion: localVersion || null,
          latestVersion,
          isOutdated,
          requiresFullSync,
        },
        rules: {
          wifiOnly: syncRules.wifiOnly,
          minBatteryLevel: syncRules.minBatteryLevel,
          minStorageBytes: MIN_STORAGE_BYTES,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
