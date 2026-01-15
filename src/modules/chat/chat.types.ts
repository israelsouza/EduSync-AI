/**
 * Request body for POST /chat endpoint
 */
export interface ChatRequest {
  /** The teacher's question or prompt */
  query: string;
}

/**
 * Response structure for POST /chat endpoint
 */
export interface ChatResponse {
  /** The generated answer from Sunita */
  answer: string;
  /** Source documents used for context */
  sources: {
    content: string;
    metadata: Record<string, unknown>;
    score?: number | undefined;
  }[];
  /** Confidence score (0-1) based on vector similarity */
  confidence: number;
  /** Whether the response is a "I don't know" fallback */
  isLowConfidence: boolean;
  /** Model information */
  model: {
    provider: string;
    model: string;
  };
}

/**
 * Error response structure
 */
export interface ChatErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}
