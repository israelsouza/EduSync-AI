import { Request, Response, NextFunction } from "express";
import { ChatRequest, ChatResponse } from "./chat.types.js";
import { RAGService } from "../../services/RAGService.js";
import { createLLMService } from "../../lib/llmFactory.js";
import VectorFactory from "../../lib/vectorFactory.js";
import { AppError } from "../../shared/AppError.js";

/**
 * Chat Controller - Handles requests to the /chat endpoint
 *
 * Orchestrates the full RAG pipeline:
 * 1. Validate request
 * 2. Initialize RAG service with vector store and LLM
 * 3. Generate response using retrieved context
 * 4. Return formatted response to client
 */
export const chatController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { query } = req.body as ChatRequest;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      throw new AppError("Query is required and must be a non-empty string", 400);
    }

    if (query.length > 500) {
      throw new AppError("Query must not exceed 500 characters", 400);
    }

    // Initialize services
    const vectorService = VectorFactory.create();
    const llmService = createLLMService();
    const ragService = new RAGService(vectorService, llmService);

    const ragResponse = await ragService.generateResponse(query.trim());

    // Helper function to extract only relevant metadata fields
    const simplifyMetadata = (metadata: Record<string, unknown>) => {
      const simplified: Record<string, unknown> = {};

      if (metadata?.["source"]) {
        simplified["source"] = metadata["source"];
      }
      if (metadata?.["page"]) {
        simplified["page"] = metadata["page"];
      }
      if (metadata?.["chapter"]) {
        simplified["chapter"] = metadata["chapter"];
      }

      return simplified;
    };

    const response: ChatResponse = {
      answer: ragResponse.answer,
      // Return empty sources array for low confidence responses (irrelevant sources)
      sources: ragResponse.isLowConfidence
        ? []
        : ragResponse.sources.map((source) => ({
            content: source.content,
            metadata: simplifyMetadata(source.metadata),
            score: source.score ?? undefined,
          })),
      confidence: ragResponse.confidence,
      isLowConfidence: ragResponse.isLowConfidence,
      model: ragResponse.model,
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};
