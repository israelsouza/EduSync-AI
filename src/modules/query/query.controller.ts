import { Request, Response, NextFunction } from "express";
import { AppError } from "../../shared/AppError.js";
import VectorFactory from "../../lib/vectorFactory.js";
import { QueryRequest, QueryResponse } from "./query.types.js";

export const postQuery = async (req: Request<object, object, QueryRequest>, res: Response<QueryResponse>, next: NextFunction) => {
  try {
    const { query, limit = 3 } = req.body;

    // Validate query parameter
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      throw new AppError("Query parameter is required and must be a non-empty string", 400);
    }

    // Validate limit parameter
    if (limit && (typeof limit !== "number" || limit < 1 || limit > 10)) {
      throw new AppError("Limit must be a number between 1 and 10", 400);
    }

    // Execute vector search
    const vectorService = VectorFactory.create();
    const results = await vectorService.search(query.trim(), limit);

    return res.status(200).json({
      query: query.trim(),
      results,
      count: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return next(error);
  }
};
