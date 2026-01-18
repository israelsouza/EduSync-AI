import { randomUUID } from "crypto";
import { IContextService, ConversationSession, ConversationMessage } from "../interface/IContextService.js";

/**
 * In-memory Context Service for managing multi-turn dialogues
 *
 * Stores conversation sessions in memory with automatic cleanup.
 * For production with multiple instances, consider Redis or database storage.
 */
export class ContextService implements IContextService {
  private sessions: Map<string, ConversationSession>;
  private readonly maxMessagesPerSession: number;
  private readonly sessionTTL: number; // Time to live in milliseconds
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(maxMessagesPerSession = 10, sessionTTLMinutes = 60) {
    this.sessions = new Map();
    this.maxMessagesPerSession = maxMessagesPerSession;
    this.sessionTTL = sessionTTLMinutes * 60 * 1000;
    this.cleanupInterval = null;

    // Start automatic cleanup every 15 minutes
    this.startCleanupInterval();
  }

  /**
   * Create a new conversation session
   */
  createSession(): string {
    const sessionId = randomUUID();
    const now = new Date();

    this.sessions.set(sessionId, {
      sessionId,
      messages: [],
      createdAt: now,
      lastAccessedAt: now,
    });

    return sessionId;
  }

  /**
   * Add a message to a session
   */
  addMessage(sessionId: string, role: "user" | "assistant", content: string): void {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Add new message
    session.messages.push({
      role,
      content,
      timestamp: new Date(),
    });

    // Trim to max messages (keep most recent)
    if (session.messages.length > this.maxMessagesPerSession) {
      session.messages = session.messages.slice(-this.maxMessagesPerSession);
    }

    // Update last accessed time
    session.lastAccessedAt = new Date();
  }

  /**
   * Get conversation history for a session
   */
  getHistory(sessionId: string): ConversationMessage[] | undefined {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return undefined;
    }

    // Update last accessed time
    session.lastAccessedAt = new Date();

    return [...session.messages]; // Return copy
  }

  /**
   * Get formatted context for LLM prompt
   */
  getFormattedContext(sessionId: string): string {
    const history = this.getHistory(sessionId);

    if (!history || history.length === 0) {
      return "";
    }

    // Format conversation history
    const formatted = history
      .map((msg) => {
        const roleLabel = msg.role === "user" ? "Professor" : "Sunita";
        return `${roleLabel}: ${msg.content}`;
      })
      .join("\n\n");

    return `\n\nPREVIOUS CONVERSATION:\n${formatted}\n\n`;
  }

  /**
   * Check if a session exists
   */
  sessionExists(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const timeSinceLastAccess = now - session.lastAccessedAt.getTime();

      if (timeSinceLastAccess > this.sessionTTL) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.sessions.delete(sessionId);
    }

    if (expiredSessions.length > 0) {
      console.log(`🧹 Cleaned up ${expiredSessions.length} expired conversation session(s)`);
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(): void {
    // Run cleanup every 15 minutes
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredSessions();
      },
      15 * 60 * 1000
    );
  }

  /**
   * Stop automatic cleanup (for testing)
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get session count (for monitoring)
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}
