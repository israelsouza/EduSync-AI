import { Request, Response, NextFunction } from "express";
import { ChatRequest, ChatResponse } from "./chat.types.js";
import { RAGService } from "../../services/RAGService.js";
import { createLLMService } from "../../lib/llmFactory.js";
import VectorFactory from "../../lib/vectorFactory.js";
import { AppError } from "../../shared/AppError.js";
import { ContextService } from "../../services/ContextService.js";

// Singleton instance for in-memory context management
export const contextService = new ContextService();

/**
 * Chat Controller - Handles requests to the /chat endpoint
 *
 * Orchestrates the full RAG pipeline with multi-turn dialogue support:
 * 1. Validate request
 * 2. Manage conversation session
 * 3. Initialize RAG service with vector store and LLM
 * 4. Generate response using retrieved context + conversation history
 * 5. Return formatted response to client
 */
export const chatController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { query, sessionId } = req.body as ChatRequest;

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      throw new AppError("Query is required and must be a non-empty string", 400);
    }

    if (query.length > 500) {
      throw new AppError("Query must not exceed 500 characters", 400);
    }

    // Handle session management
    let currentSessionId = sessionId;

    if (!currentSessionId || !contextService.sessionExists(currentSessionId)) {
      // Create new session if not provided or invalid
      currentSessionId = contextService.createSession();
    }

    // Add user message to session
    contextService.addMessage(currentSessionId, "user", query.trim());

    // Get conversation history for context
    const conversationContext = contextService.getFormattedContext(currentSessionId);

    // Initialize services
    const vectorService = VectorFactory.create();
    const llmService = createLLMService();
    const ragService = new RAGService(vectorService, llmService);

    // Generate response (vector search uses only query, conversation context added to LLM prompt)
    const ragResponse = await ragService.generateResponse(query.trim(), conversationContext);

    // Add assistant response to session
    contextService.addMessage(currentSessionId, "assistant", ragResponse.answer);

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
      sessionId: currentSessionId,
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
