/**
 * Types for structured prompt building
 */

import { SearchResult } from "../interface/IVectorService.js";

/**
 * Context information for building prompts
 */
export interface PromptContext {
  /** Teacher's original question */
  query: string;

  /** Retrieved chunks from vector search */
  retrievedChunks: SearchResult[];

  /** Optional metadata for context enrichment */
  metadata?: {
    /** Teacher's grade level focus */
    gradeLevel?: string;

    /** Subject area (math, reading, etc.) */
    subject?: string;

    /** Session ID for multi-turn conversations */
    sessionId?: string;
  };
}

/**
 * Formatted prompt ready for LLM input
 */
export interface FormattedPrompt {
  /** System prompt with instructions */
  systemPrompt: string;

  /** Formatted context from RAG retrieval */
  context: string;

  /** User's query */
  userQuery: string;

  /** Complete prompt (all sections combined) */
  fullPrompt: string;

  /** Estimated token count */
  estimatedTokens: number;
}

/**
 * Result of prompt building operation
 */
export interface PromptBuildResult {
  /** Successfully formatted prompt */
  prompt: FormattedPrompt;

  /** Whether confidence threshold was met */
  hasConfidence: boolean;

  /** Average similarity score of retrieved chunks */
  averageScore: number;

  /** Number of chunks included in context */
  chunksUsed: number;
}
