import { Request, Response, NextFunction } from "express";
import { ExportRequest, ExportResponse, EmbeddingBundle, EmbeddingRecord } from "./export.types.js";
import { generateVersion } from "./version.utils.js";
import supabase from "../../lib/supabaseClient.js";
import { AppError } from "../../shared/AppError.js";

/**
 * Export Controller - Handles embeddings export for offline mobile usage
 *
 * Fetches pre-computed embeddings from Supabase vector store and
 * returns them in a structured format for mobile consumption.
 */
export const exportEmbeddingsController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { version, limit = 1000, offset = 0 } = req.query as unknown as ExportRequest;

    // Validate query parameters
    const parsedLimit = Number(limit);
    const parsedOffset = Number(offset);

    if (isNaN(parsedLimit) || parsedLimit <= 0 || parsedLimit > 5000) {
      throw new AppError("Limit must be between 1 and 5000", 400);
    }

    if (isNaN(parsedOffset) || parsedOffset < 0) {
      throw new AppError("Offset must be a non-negative number", 400);
    }

    // Fetch embeddings from Supabase
    const tableName = "pedagogical_knowledge_v384";
    const { data: records, error } = await supabase
      .from(tableName)
      .select("id, content, metadata, embedding")
      .range(parsedOffset, parsedOffset + parsedLimit - 1)
      .order("id", { ascending: true });

    if (error) {
      throw new AppError(`Failed to fetch embeddings: ${error.message}`, 500);
    }

    if (!records || records.length === 0) {
      throw new AppError("No embeddings found in database", 404);
    }

    // Transform database records to export format
    const embeddings: EmbeddingRecord[] = records.map((record) => ({
      id: record.id,
      content: record.content,
      embedding: record.embedding,
      metadata: record.metadata || {},
    }));

    // Get total count for version tracking
    const { count: totalCount, error: countError } = await supabase.from(tableName).select("id", { count: "exact", head: true });

    if (countError) {
      console.warn(`Failed to get total count: ${countError.message}`);
    }

    // Create versioned bundle
    const currentVersion = version || generateVersion();
    const bundle: EmbeddingBundle = {
      version: currentVersion,
      count: embeddings.length,
      model: {
        name: "Xenova/all-MiniLM-L6-v2",
        dimensions: 384,
      },
      embeddings,
      metadata: {
        createdAt: new Date().toISOString(),
        tableName,
        compressionEnabled: true, // gzip - Express compression middleware
      },
    };

    const response: ExportResponse = {
      success: true,
      data: bundle,
    };

    // Add pagination metadata to response headers
    res.setHeader("X-Total-Count", String(totalCount || embeddings.length));
    res.setHeader("X-Offset", String(parsedOffset));
    res.setHeader("X-Limit", String(parsedLimit));

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
