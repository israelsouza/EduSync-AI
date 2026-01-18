import { IVectorService, SearchResult } from "../interface/IVectorService.js";
import { ILLMService } from "../interface/ILLMService.js";
import { SUNITA_SYSTEM_PROMPT, LOW_CONFIDENCE_MESSAGE, PROMPT_LIMITS } from "../prompts/systemPrompt.js";

/**
 * RAG Response structure returned to the client
 */
export interface RAGResponse {
  /** The generated answer from the LLM */
  answer: string;
  /** Source documents used for context */
  sources: SearchResult[];
  /** Average confidence score based on vector similarity */
  confidence: number;
  /** Whether the response is based on retrieved context or a fallback */
  isLowConfidence: boolean;
  /** Model information */
  model: { provider: string; model: string };
}

/**
 * RAG Service Configuration
 */
export interface RAGConfig {
  /** Minimum confidence threshold (0-1). Below this, return "I don't know" */
  confidenceThreshold: number;
  /** Number of chunks to retrieve from vector search */
  topK: number;
}

const DEFAULT_CONFIG: RAGConfig = {
  confidenceThreshold: 0.5,
  topK: PROMPT_LIMITS.MAX_CHUNKS,
};

/**
 * RAG Service - Orchestrates the Retrieval-Augmented Generation pipeline
 *
 * Flow:
 * 1. Receive teacher's question
 * 2. Search for relevant context in vector store
 * 3. Format context for LLM consumption
 * 4. Generate response using LLM with context
 * 5. Return response with sources and confidence
 */
export class RAGService {
  private readonly config: RAGConfig;

  constructor(
    private readonly vectorService: IVectorService,
    private readonly llmService: ILLMService,
    config: Partial<RAGConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate a response using the full RAG pipeline
   *
   * @param query - The teacher's question
   * @param conversationContext - Optional conversation history (not used for vector search, only for LLM prompt)
   * @returns RAG response with answer, sources, and confidence
   */
  async generateResponse(query: string, conversationContext?: string): Promise<RAGResponse> {
    try {
      // Step 1: Retrieve relevant chunks from vector store
      const relevantChunks = await this.vectorService.search(query, this.config.topK);

      // Step 2: Calculate confidence based on similarity scores
      const confidence = this.calculateConfidence(relevantChunks);
      const isLowConfidence = confidence < this.config.confidenceThreshold;

      // Step 3: Handle low confidence case (Task 9)
      if (isLowConfidence || relevantChunks.length === 0) {
        return {
          answer: LOW_CONFIDENCE_MESSAGE,
          sources: relevantChunks,
          confidence,
          isLowConfidence: true,
          model: this.llmService.getModelInfo(),
        };
      }

      // Step 4: Format context for LLM (Task 8)
      const formattedContext = this.formatContext(relevantChunks);

      // Step 5: Build the complete prompt
      const fullPrompt = this.buildPrompt(formattedContext, query, conversationContext);

      // Step 6: Generate response using LLM
      const answer = await this.llmService.generateResponse(fullPrompt);

      return {
        answer,
        sources: relevantChunks,
        confidence,
        isLowConfidence: false,
        model: this.llmService.getModelInfo(),
      };
    } catch (error) {
      throw new Error(`RAGService generateResponse error: ${(error as Error).message}`, { cause: error });
    }
  }

  /**
   * Format retrieved chunks into structured context for LLM
   *
   * Transforms raw search results into a readable format that helps
   * the LLM understand and cite sources properly.
   */
  private formatContext(chunks: SearchResult[]): string {
    if (chunks.length === 0) {
      return "No relevant context found in the pedagogical manuals.";
    }

    const formattedChunks = chunks.map((chunk, index) => {
      const sourceInfo = this.formatSourceInfo(chunk.metadata);
      const similarityPercent = chunk.score ? Math.round(chunk.score * 100) : "N/A";

      return `[Source ${index + 1}] ${sourceInfo}
Relevance: ${similarityPercent}%
---
${chunk.content.trim()}`;
    });

    return formattedChunks.join("\n\n");
  }

  /**
   * Format metadata into readable source information
   */
  private formatSourceInfo(metadata: Record<string, unknown>): string {
    const parts: string[] = [];

    if (metadata?.["source"]) {
      parts.push(String(metadata["source"]));
    }
    if (metadata?.["page"]) {
      parts.push(`Page ${metadata["page"]}`);
    }
    if (metadata?.["chapter"]) {
      parts.push(`Chapter: ${metadata["chapter"]}`);
    }

    return parts.length > 0 ? parts.join(" | ") : "Official Pedagogical Manual";
  }

  /**
   * Build the complete prompt by replacing placeholders in system prompt
   * @param context - Retrieved context from vector search
   * @param query - The user's query
   * @param conversationContext - Optional conversation history to append
   */
  private buildPrompt(context: string, query: string, conversationContext?: string): string {
    const basePrompt = SUNITA_SYSTEM_PROMPT.replace("{context}", context).replace("{query}", query);
    
    // Append conversation context if provided (used for multi-turn dialogues)
    if (conversationContext && conversationContext.trim().length > 0) {
      return basePrompt + conversationContext;
    }
    
    return basePrompt;
  }

  /**
   * Calculate average confidence from search results
   *
   * Uses the similarity scores from vector search to determine
   * how confident we are in the retrieved context.
   */
  private calculateConfidence(chunks: SearchResult[]): number {
    if (chunks.length === 0) {
      return 0;
    }

    const scores = chunks.map((chunk) => chunk.score).filter((score): score is number => score !== undefined);

    if (scores.length === 0) {
      return 0;
    }

    const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

    return Math.round(averageScore * 100) / 100;
  }

  /**
   * Get current configuration
   */
  getConfig(): RAGConfig {
    return { ...this.config };
  }
}
