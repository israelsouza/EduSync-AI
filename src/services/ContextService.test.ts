/* eslint-disable @typescript-eslint/no-explicit-any */
import { ContextService } from "./ContextService";

describe("ContextService", () => {
  let contextService: ContextService;

  beforeEach(() => {
    // Create service with short TTL for testing (1 minute)
    contextService = new ContextService(5, 1);
    contextService.stopCleanupInterval(); // Stop auto cleanup during tests
  });

  afterEach(() => {
    contextService.stopCleanupInterval();
  });

  describe("Session Management", () => {
    test("should create a new session with UUID", () => {
      const sessionId = contextService.createSession();

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe("string");
      expect(sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    test("should check if session exists", () => {
      const sessionId = contextService.createSession();

      expect(contextService.sessionExists(sessionId)).toBe(true);
      expect(contextService.sessionExists("non-existent")).toBe(false);
    });

    test("should delete a session", () => {
      const sessionId = contextService.createSession();

      expect(contextService.sessionExists(sessionId)).toBe(true);

      contextService.deleteSession(sessionId);

      expect(contextService.sessionExists(sessionId)).toBe(false);
    });

    test("should track session count", () => {
      expect(contextService.getSessionCount()).toBe(0);

      const session1 = contextService.createSession();
      expect(contextService.getSessionCount()).toBe(1);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const session2 = contextService.createSession();
      expect(contextService.getSessionCount()).toBe(2);

      contextService.deleteSession(session1);
      expect(contextService.getSessionCount()).toBe(1);
    });
  });

  describe("Message Management", () => {
    test("should add user message to session", () => {
      const sessionId = contextService.createSession();

      contextService.addMessage(sessionId, "user", "Como ensinar subtração?");

      const history = contextService.getHistory(sessionId);

      expect(history).toHaveLength(1);
      expect(history?.[0]).toMatchObject({
        role: "user",
        content: "Como ensinar subtração?",
      });
      expect(history?.[0]?.timestamp).toBeInstanceOf(Date);
    });

    test("should add assistant message to session", () => {
      const sessionId = contextService.createSession();

      contextService.addMessage(sessionId, "assistant", "Use materiais visuais...");

      const history = contextService.getHistory(sessionId);

      expect(history).toHaveLength(1);
      expect(history?.[0]).toMatchObject({
        role: "assistant",
        content: "Use materiais visuais...",
      });
    });

    test("should maintain conversation order", () => {
      const sessionId = contextService.createSession();

      contextService.addMessage(sessionId, "user", "Pergunta 1");
      contextService.addMessage(sessionId, "assistant", "Resposta 1");
      contextService.addMessage(sessionId, "user", "Pergunta 2");
      contextService.addMessage(sessionId, "assistant", "Resposta 2");

      const history = contextService.getHistory(sessionId);

      expect(history).toHaveLength(4);
      expect(history?.[0]?.content).toBe("Pergunta 1");
      expect(history?.[1]?.content).toBe("Resposta 1");
      expect(history?.[2]?.content).toBe("Pergunta 2");
      expect(history?.[3]?.content).toBe("Resposta 2");
    });

    test("should throw error when adding message to non-existent session", () => {
      expect(() => {
        contextService.addMessage("non-existent", "user", "test");
      }).toThrow("Session non-existent not found");
    });

    test("should limit messages to maxMessagesPerSession", () => {
      const sessionId = contextService.createSession();

      // Add 10 messages (limit is 5)
      for (let i = 1; i <= 10; i++) {
        contextService.addMessage(sessionId, "user", `Message ${i}`);
      }

      const history = contextService.getHistory(sessionId);

      expect(history).toHaveLength(5);
      expect(history?.[0]?.content).toBe("Message 6"); // Oldest kept
      expect(history?.[4]?.content).toBe("Message 10"); // Most recent
    });
  });

  describe("Conversation History", () => {
    test("should return undefined for non-existent session", () => {
      const history = contextService.getHistory("non-existent");

      expect(history).toBeUndefined();
    });

    test("should return copy of messages (not reference)", () => {
      const sessionId = contextService.createSession();
      contextService.addMessage(sessionId, "user", "Original message");

      const history1 = contextService.getHistory(sessionId);
      const history2 = contextService.getHistory(sessionId);

      expect(history1).not.toBe(history2); // Different array references
      expect(history1).toEqual(history2); // Same content
    });

    test("should format empty context", () => {
      const sessionId = contextService.createSession();

      const formatted = contextService.getFormattedContext(sessionId);

      expect(formatted).toBe("");
    });

    test("should format conversation context for LLM", () => {
      const sessionId = contextService.createSession();

      contextService.addMessage(sessionId, "user", "Como ensinar subtração?");
      contextService.addMessage(sessionId, "assistant", "Use materiais visuais.");
      contextService.addMessage(sessionId, "user", "E se não tiver materiais?");

      const formatted = contextService.getFormattedContext(sessionId);

      expect(formatted).toContain("PREVIOUS CONVERSATION:");
      expect(formatted).toContain("Professor: Como ensinar subtração?");
      expect(formatted).toContain("Sunita: Use materiais visuais.");
      expect(formatted).toContain("Professor: E se não tiver materiais?");
    });
  });

  describe("Session Cleanup", () => {
    test("should cleanup expired sessions", () => {
      // Create sessions with past timestamps
      const oldSessionId = contextService.createSession();
      const recentSessionId = contextService.createSession();

      // Manually set old timestamp (61 minutes ago - beyond 60min TTL)
      const history = contextService.getHistory(oldSessionId);
      if (history) {
        // Accessing private sessions map for testing
        const sessions = (contextService as any).sessions;
        const oldSession = sessions.get(oldSessionId);
        if (oldSession) {
          oldSession.lastAccessedAt = new Date(Date.now() - 61 * 60 * 1000);
        }
      }

      expect(contextService.getSessionCount()).toBe(2);

      contextService.cleanupExpiredSessions();

      expect(contextService.sessionExists(oldSessionId)).toBe(false);
      expect(contextService.sessionExists(recentSessionId)).toBe(true);
      expect(contextService.getSessionCount()).toBe(1);
    });

    test("should not cleanup active sessions", () => {
      const sessionId1 = contextService.createSession();
      const sessionId2 = contextService.createSession();

      contextService.addMessage(sessionId1, "user", "test");
      contextService.addMessage(sessionId2, "user", "test");

      contextService.cleanupExpiredSessions();

      expect(contextService.getSessionCount()).toBe(2);
    });

    test("should update lastAccessedAt when accessing history", () => {
      const sessionId = contextService.createSession();

      // Get session's last accessed time
      const sessions = (contextService as any).sessions;
      const session = sessions.get(sessionId);
      const initialTime = session.lastAccessedAt.getTime();

      // Wait a bit and access history
      setTimeout(() => {
        contextService.getHistory(sessionId);

        const updatedSession = sessions.get(sessionId);
        expect(updatedSession.lastAccessedAt.getTime()).toBeGreaterThan(initialTime);
      }, 10);
    });
  });

  describe("Edge Cases", () => {
    test("should handle multiple sessions independently", () => {
      const session1 = contextService.createSession();
      const session2 = contextService.createSession();

      contextService.addMessage(session1, "user", "Message from session 1");
      contextService.addMessage(session2, "user", "Message from session 2");

      const history1 = contextService.getHistory(session1);
      const history2 = contextService.getHistory(session2);

      expect(history1).toHaveLength(1);
      expect(history2).toHaveLength(1);
      expect(history1?.[0]?.content).toBe("Message from session 1");
      expect(history2?.[0]?.content).toBe("Message from session 2");
    });

    test("should handle rapid message additions", () => {
      const sessionId = contextService.createSession();

      for (let i = 0; i < 100; i++) {
        contextService.addMessage(sessionId, "user", `Rapid message ${i}`);
      }

      const history = contextService.getHistory(sessionId);

      expect(history).toHaveLength(5); // Limited by maxMessagesPerSession
      expect(history?.[4]?.content).toBe("Rapid message 99");
    });

    test("should handle empty message content", () => {
      const sessionId = contextService.createSession();

      contextService.addMessage(sessionId, "user", "");

      const history = contextService.getHistory(sessionId);

      expect(history).toHaveLength(1);
      expect(history?.[0]?.content).toBe("");
    });
  });
});
