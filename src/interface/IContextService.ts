/**
 * Message in a conversation session
 */
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

/**
 * Conversation session data
 */
export interface ConversationSession {
  sessionId: string;
  messages: ConversationMessage[];
  createdAt: Date;
  lastAccessedAt: Date;
}

/**
 * Context Service Interface
 *
 * Manages multi-turn dialogue sessions for contextual conversations.
 */
export interface IContextService {
  /**
   * Create a new conversation session
   * @returns New session ID
   */
  createSession(): string;

  /**
   * Add a message to a session
   * @param sessionId - The session ID
   * @param role - Message role (user or assistant)
   * @param content - Message content
   */
  addMessage(sessionId: string, role: "user" | "assistant", content: string): void;

  /**
   * Get conversation history for a session
   * @param sessionId - The session ID
   * @returns Array of messages or undefined if session doesn't exist
   */
  getHistory(sessionId: string): ConversationMessage[] | undefined;

  /**
   * Get formatted context for LLM prompt
   * @param sessionId - The session ID
   * @returns Formatted conversation history or empty string
   */
  getFormattedContext(sessionId: string): string;

  /**
   * Check if a session exists
   * @param sessionId - The session ID
   */
  sessionExists(sessionId: string): boolean;

  /**
   * Delete a session
   * @param sessionId - The session ID
   */
  deleteSession(sessionId: string): void;

  /**
   * Clean up expired sessions (older than TTL)
   */
  cleanupExpiredSessions(): void;
}
