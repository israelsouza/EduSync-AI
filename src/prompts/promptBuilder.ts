/**
 * Prompt Builder - Combines system prompt + RAG context + user query
 */

import { SearchResult } from "../interface/IVectorService.js";
import { SUNITA_SYSTEM_PROMPT, LOW_CONFIDENCE_MESSAGE, PROMPT_LIMITS } from "./systemPrompt.js";
import { PromptContext, FormattedPrompt, PromptBuildResult } from "./types.js";

/**
 * Confidence threshold for determining if retrieval quality is sufficient
 */
const CONFIDENCE_THRESHOLD = 0.5;

/**
 * Format a single search result chunk for context inclusion
 */
function formatChunk(chunk: SearchResult, index: number): string {
  const source = chunk.metadata?.source || "Unknown source";
  const page = chunk.metadata?.loc?.lines?.from ? `(Page ${chunk.metadata.loc.lines.from})` : "";

  return `[Source ${index + 1}] ${source} ${page}
${chunk.content}
`;
}

/**
 * Calculate average similarity score from search results
 */
function calculateAverageScore(chunks: SearchResult[]): number {
  if (chunks.length === 0) return 0;
  const sum = chunks.reduce((acc, chunk) => acc + (chunk.score || 0), 0);
  return sum / chunks.length;
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate context chunks to fit within token limit
 */
function truncateChunks(chunks: SearchResult[], maxTokens: number): SearchResult[] {
  const result: SearchResult[] = [];
  let currentTokens = 0;

  for (const chunk of chunks) {
    const chunkTokens = estimateTokens(chunk.content);
    if (currentTokens + chunkTokens > maxTokens) break;

    result.push(chunk);
    currentTokens += chunkTokens;
  }

  return result;
}

/**
 * Build formatted context from retrieved chunks
 */
function buildContext(chunks: SearchResult[]): string {
  if (chunks.length === 0) {
    return "No relevant information found in available manuals.";
  }

  const availableTokens = PROMPT_LIMITS.CONTEXT_CHUNK_TOKENS * PROMPT_LIMITS.MAX_CHUNKS;
  const truncatedChunks = truncateChunks(chunks, availableTokens);

  return truncatedChunks.map((chunk, idx) => formatChunk(chunk, idx)).join("\n---\n");
}

/**
 * Build complete prompt with system instructions, context, and user query
 */
export function buildPromptWithContext(context: PromptContext): PromptBuildResult {
  const { query, retrievedChunks } = context;

  // Calculate confidence metrics
  const averageScore = calculateAverageScore(retrievedChunks);
  const hasConfidence = averageScore >= CONFIDENCE_THRESHOLD;

  // Build context section
  const formattedContext = buildContext(retrievedChunks);

  // Replace placeholders in system prompt
  const systemPrompt = SUNITA_SYSTEM_PROMPT.replace("{context}", formattedContext).replace("{query}", query);

  // Build full prompt
  const fullPrompt = hasConfidence ? systemPrompt : LOW_CONFIDENCE_MESSAGE;

  const prompt: FormattedPrompt = {
    systemPrompt: SUNITA_SYSTEM_PROMPT,
    context: formattedContext,
    userQuery: query,
    fullPrompt,
    estimatedTokens: estimateTokens(fullPrompt),
  };

  return {
    prompt,
    hasConfidence,
    averageScore,
    chunksUsed: retrievedChunks.length,
  };
}

/**
 * Validate that prompt fits within token limits
 */
export function validatePromptSize(prompt: FormattedPrompt): {
  isValid: boolean;
  exceedsBy?: number;
} {
  const { estimatedTokens } = prompt;
  const maxTokens = PROMPT_LIMITS.MAX_TOTAL_TOKENS;

  if (estimatedTokens <= maxTokens) {
    return { isValid: true };
  }

  return {
    isValid: false,
    exceedsBy: estimatedTokens - maxTokens,
  };
}
