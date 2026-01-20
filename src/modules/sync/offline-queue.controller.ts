import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { AppError } from "../../shared/AppError.js";
import supabase from "../../lib/supabaseClient.js";

/**
 * Offline Query structure received from mobile devices
 */
interface OfflineQueryPayload {
  id: string;
  query: string;
  response: string;
  timestamp: number;
  metadata: {
    responseSource: "local" | "cache" | "fallback";
    conversationId?: string;
    deviceId: string;
    appVersion: string;
  };
}

/**
 * Batch sync request
 */
interface SyncQueriesRequest {
  queries: OfflineQueryPayload[];
  consentGiven: boolean;
}

/**
 * Sync Offline Queries Controller
 *
 * Receives offline queries from mobile devices for analytics.
 * ONLY processes data if user has given explicit consent.
 *
 * Privacy considerations:
 * - Consent must be explicitly given
 * - Device IDs are anonymized (hashed)
 * - Queries are stored without PII
 * - Data used only for improving pedagogical retrieval
 */
export const syncOfflineQueriesController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { queries, consentGiven } = req.body as SyncQueriesRequest;

    if (!consentGiven) {
      throw new AppError("User consent is required for analytics sync", 403);
    }

    if (!queries || !Array.isArray(queries) || queries.length === 0) {
      throw new AppError("queries array is required and must not be empty", 400);
    }

    const MAX_BATCH_SIZE = 100;
    if (queries.length > MAX_BATCH_SIZE) {
      throw new AppError(`Batch size exceeds maximum of ${MAX_BATCH_SIZE}`, 400);
    }

    const syncedIds: string[] = [];
    const failedIds: string[] = [];
    const errors: { queryId: string; error: string }[] = [];

    // Process each query
    for (const query of queries) {
      try {
        // Validate required fields
        if (!query.id || !query.query || !query.timestamp || !query.metadata?.deviceId) {
          failedIds.push(query.id || "unknown");
          errors.push({
            queryId: query.id || "unknown",
            error: "Missing required fields",
          });
          continue;
        }

        // Anonymize device ID (simple hash for privacy)
        const anonymizedDeviceId = hashDeviceId(query.metadata.deviceId);

        // Insert into database
        const { error } = await supabase.from("offline_queries").insert({
          id: query.id,
          query: query.query,
          response: query.response || null,
          timestamp: new Date(query.timestamp).toISOString(),
          metadata: {
            responseSource: query.metadata.responseSource,
            conversationId: query.metadata.conversationId,
            appVersion: query.metadata.appVersion,
          },
          device_id: anonymizedDeviceId,
          app_version: query.metadata.appVersion,
          status: "synced",
        });

        if (error) {
          // Check if it's a duplicate (already synced)
          if (error.code === "23505") {
            // Unique violation - already exists
            syncedIds.push(query.id);
          } else {
            failedIds.push(query.id);
            errors.push({
              queryId: query.id,
              error: error.message,
            });
          }
        } else {
          syncedIds.push(query.id);
        }
      } catch (err) {
        failedIds.push(query.id);
        errors.push({
          queryId: query.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        syncedCount: syncedIds.length,
        failedCount: failedIds.length,
        syncedIds,
        failedIds,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Query Statistics Controller
 *
 * Returns aggregated statistics about offline queries.
 * Used for analytics dashboard (CRP view).
 */
export const getQueryStatsController = async (_: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get total count
    const { count: totalCount } = await supabase.from("offline_queries").select("*", { count: "exact", head: true });

    // Get count by response source
    const { data: sourceCounts } = await supabase.from("offline_queries").select("metadata->responseSource").limit(1000);

    // Aggregate response sources
    const sourceBreakdown: Record<string, number> = {};
    if (sourceCounts) {
      for (const row of sourceCounts) {
        const source = (row as { responseSource?: string }).responseSource || "unknown";
        sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
      }
    }

    // Get recent queries count (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentCount } = await supabase
      .from("offline_queries")
      .select("*", { count: "exact", head: true })
      .gte("timestamp", sevenDaysAgo.toISOString());

    res.status(200).json({
      success: true,
      data: {
        totalQueries: totalCount || 0,
        recentQueries: recentCount || 0,
        sourceBreakdown,
        period: {
          start: sevenDaysAgo.toISOString(),
          end: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Salt for device ID hashing (should be set via environment variable)
 * If not set, uses a default value (not recommended for production)
 */
const DEVICE_HASH_SALT = process.env["DEVICE_HASH_SALT"] || "edusync-default-salt";

/**
 * Cryptographic hash function for device ID anonymization
 * Uses SHA-256 with a secret salt to prevent rainbow table attacks
 */
function hashDeviceId(deviceId: string): string {
  const hash = createHash("sha256")
    .update(DEVICE_HASH_SALT + deviceId)
    .digest("hex");
  return `anon_${hash.substring(0, 16)}`; // Return first 16 chars for brevity
}
