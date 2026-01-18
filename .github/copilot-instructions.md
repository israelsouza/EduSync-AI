# EduSync-AI: Project Context & Guidelines

## 🎯 Project Overview

**EduSync-AI** is a solution for the _Innovation for Education Equity Hackathon 2026_ that provides just-in-time coaching for teachers through an offline voice assistant powered by Hybrid RAG (Retrieval-Augmented Generation).

**Challenge Theme:** Just-in-time Coaching for Teachers — Bridging the Gap Between Training and Classroom Implementation

---

## 📋 Complete Roadmap - All Milestones

### 🎯 Milestone 2: Motor de Resposta (RAG Pipeline)

**Current Status: ~25% Complete**

**✅ Completed:**
- Vector search endpoint (`POST /query`)
- LocalVectorService with 384-dim embeddings
- Supabase pgvector integration
- System prompt templates (Sunita persona)
- ILLMService interface + LLM Factory

**Phase 1: LLM Foundation (no dependencies)**
1. ✅ Create System Prompt - `src/prompts/systemPrompt.ts`
2. ✅ Create LLM Interface - `src/interface/ILLMService.ts`
3. ✅ Create LLM Factory - `src/lib/llmFactory.ts`

**Phase 2: LLM Services (depends on Phase 1)**
4. ✅ Implement OpenAILLMService - `src/services/OpenAILLMService.ts` (no more because no free tier)
5. ✅ Implement GoogleLLMService - `src/services/GoogleLLMService.ts`
6. ✅ Add unit tests for prompt builder and LLM services

**Phase 3: RAG Integration (depends on Phase 2)**
7. [ ] Create RAG Service - `src/services/RAGService.ts`
8. [ ] Implement context formatting for LLM input
9. [ ] Add confidence threshold for "I don't know" responses

**Phase 4: Chat Endpoint (depends on Phase 3)**
10. [ ] Create Chat Module - `src/modules/chat/`
11. [ ] Register route in `app.ts` - `POST /chat`
12. [ ] Integration tests for full RAG pipeline

**Phase 5: Context Management (optional)**
13. [ ] Create Context Service for multi-turn dialogues
14. [ ] Add session tracking to chat controller

---

### 🔄 Milestone 3: Sincronização e Offline-First

**Current Status: 0% Complete**

**Goal:** Enable teachers to download embeddings and use the system offline on mobile devices.

**Phase 1: Export API (no dependencies)**
1. [ ] [SYNCAI-014] Create embeddings export endpoint - `GET /api/export/embeddings`
2. [ ] Implement JSON/Vector Bundle format for mobile consumption
3. [ ] Add compression (gzip) for bandwidth optimization
4. [ ] Version control for embedding bundles

**Phase 2: Mobile Storage (depends on Phase 1)**
5. [ ] [SYNCAI-015] Define local storage schema (WatermelonDB or SQLite)
6. [ ] Implement download manager service
7. [ ] Create cache invalidation logic
8. [ ] Add storage quota management

**Phase 3: Sync Mechanism (depends on Phase 2)**
9. [ ] [SYNCAI-016] Implement connectivity detection service
10. [ ] Create background sync scheduler
11. [ ] Add delta sync (only download changed embeddings)
12. [ ] Implement conflict resolution strategy

**Phase 4: Offline RAG (depends on Phase 3)**
13. [ ] Port vector search to run locally on device
14. [ ] Implement local embedding generation (optional)
15. [ ] Add offline queue for queries made without connection

---

### 🎤 Milestone 4: Interface de Voz (Mobile STT)

**Current Status: 0% Complete**

**Goal:** Enable teachers to interact with Sunita using voice input and receive audio responses.

**Phase 1: Audio Capture (no dependencies)**
1. [ ] [SYNCAI-017] Create audio stream handler service
2. [ ] Implement microphone permission management
3. [ ] Add audio buffer management
4. [ ] Create voice activity detection (VAD)

**Phase 2: Speech-to-Text (depends on Phase 1)**
5. [ ] [SYNCAI-018] Integrate local STT model (Whisper.cpp or similar)
6. [ ] Create STT pipeline interface - `src/interface/ISTTService.ts`
7. [ ] Implement streaming transcription
8. [ ] Add language detection (Portuguese/Spanish/English)

**Phase 3: Text-to-Speech (depends on Milestone 2)**
9. [ ] Create TTS service interface - `src/interface/ITTSService.ts`
10. [ ] Integrate local TTS model (Piper or similar)
11. [ ] Implement audio output management
12. [ ] Add voice customization (speed, pitch)

**Phase 4: Voice Pipeline Integration (depends on Phase 2, 3)**
13. [ ] Create end-to-end voice pipeline
14. [ ] Implement interruption handling
15. [ ] Add audio feedback (processing sounds)
16. [ ] Optimize latency for real-time interaction

---

### ✅ Milestone 5: Validação e Pitch

**Current Status: 0% Complete**

**Goal:** Validate system performance and prepare for hackathon presentation.

**Phase 1: Testing Infrastructure (depends on Milestone 2, 3, 4)**
1. [ ] [SYNCAI-019] Create offline stress test suite
2. [ ] Implement performance benchmarks
3. [ ] Add memory usage monitoring
4. [ ] Create battery consumption tests

**Phase 2: Audio Quality (depends on Milestone 4)**
5. [ ] [SYNCAI-020] Refine TTS output quality
6. [ ] Optimize STT accuracy for rural accents
7. [ ] Add noise cancellation testing
8. [ ] Create audio quality metrics

**Phase 3: User Testing (depends on Phase 1, 2)**
9. [ ] Create demo scenarios for Sunita persona
10. [ ] Prepare test scripts for evaluators
11. [ ] Document edge cases and limitations
12. [ ] Create feedback collection mechanism

**Phase 4: Pitch Preparation (depends on Phase 3)**
13. [ ] Create demo video script
14. [ ] Prepare technical architecture slides
15. [ ] Document impact metrics and projections
16. [ ] Create live demo environment

---

### 📊 Milestone Dependencies Graph

```
Milestone 1 (Ingestão) ✅
    │
    ▼
Milestone 2 (Motor de Resposta) ◐ ─────────────────┐
    │                                               │
    ├──────────────────────┐                        │
    ▼                      ▼                        ▼
Milestone 3            Milestone 4            Milestone 5
(Offline-First)        (Interface Voz)        (Validação)
    │                      │                        ▲
    │                      │                        │
    └──────────────────────┴────────────────────────┘
```

**Legend:** ✅ Complete | ◐ In Progress | ○ Not Started



---

## 👥 Key Personas

### Sunita (Primary User)

- Passionate multi-grade teacher in rural schools
- Limited access to continuous professional development
- Teaches mixed-age classes (4th-6th grade) with diverse learning needs
- **Core Need:** Immediate pedagogical strategies in real-time classroom situations

### CRP (Coordinador de Recursos Pedagógicos)

- Mentor providing professional development support
- Appears rarely with generic advice
- **Benefit:** EduSync-AI reduces the gap between teacher needs and support availability

---

## 🔴 The Problem

| Issue                               | Impact                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| **Pedagogical Isolation**           | Teachers have no one to exchange ideas with during classroom challenges                  |
| **Asynchronous & Generic Feedback** | Mentors give advice that doesn't fit multi-grade classroom reality                       |
| **Implementation Anxiety**          | Fear of mistakes causes teachers to abandon innovation and return to mechanical teaching |

---

## 💡 The Solution

**EduSync-AI: The Pocket Mentor**

- Offline voice assistant
- Uses Hybrid RAG for context-aware responses
- Based on official state manuals + local AI adaptation
- Immediate management and pedagogical strategies

---

## 🔄 User Experience Flow

1. **Voice Input:** Teacher presses button/voice command describing classroom problem
   - Example: _"4th grade class, advanced students agitated, others stuck on subtraction with zero"_

2. **Local Processing (Edge):** App converts voice to text (local STT) and feeds the SLM

3. **Contextual Retrieval (Local RAG):** Searches vector indices (pre-downloaded on phone) for relevant manual excerpts

4. **Adaptive Response:** Audio response with personalized strategies
   - Example: _"Use 'Student Monitor' strategy for advanced ones. Explain zero as an 'empty chair' needing help from tens place"_

---

## 📊 Success Metrics

| Metric                                  | Definition                                                           |
| --------------------------------------- | -------------------------------------------------------------------- |
| **Query-to-Resolution Time**            | Time between teacher's need and receiving actionable guidance        |
| **Frequency of On-Demand Interactions** | Number of teachers using system for real-time support per week/month |
| **Strategy Implementation Rate**        | % of teachers successfully implementing personalized strategies      |
| **Implementation Anxiety Reduction**    | Self-reported confidence in trying innovative methods                |

---

## 🛠️ Technology Stack

### Frontend

- **Framework:** React Native
- **Repository:** [EduSync-AI-Frontend](https://github.com/Sofia-gith/Edusync-AI)
- **Deployment:** Mobile apps (iOS/Android)

### Backend & Cloud

- **Language:** Node.js (TypeScript)
- **Database:** Supabase (PostgreSQL + pgvector)
- **RAG Pipeline:** LangChain.js
- **Storage:** Manuals + Teacher usage logs
- **Sync:** Embeddings sent to phones during internet availability

---

## 🗂️ Source Code Structure (src/)

```
src/
├── app.ts # Express app setup, middleware registration, route mounting
├── server.ts # HTTP server entry point
├── config/
│ └── env.ts # Environment variables with type-safe access
├── interface/
│ └── IVectorService.ts # Contract for vector search (search method)
├── lib/
│ ├── embeddingProviderFactory.ts # Creates embedding providers (local/OpenAI/Google)
│ ├── supabaseClient.ts # Supabase client singleton
│ └── vectorFactory.ts # Creates IVectorService implementations
├── modules/
│ └── health/
│ ├── health.controller.ts # Handler for /health endpoint
│ └── health.route.ts # Route registration
├── scripts/
│ └── ingest.ts # CLI script for PDF ingestion to vector store
├── services/
│ └── LocalVectorService.ts # 384-dim vector search with HuggingFace embeddings
└── shared/
├── AppError.ts # Custom error class with HTTP status codes
└── error.middleware.ts # Global error handling middleware
```

### Layer Responsibilities

| Layer | Folder | Responsibility |
|-------|--------|----------------|
| **Entry Points** | `app.ts`, `server.ts` | Server initialization and configuration |
| **Configuration** | `config/` | Type-safe environment variable access |
| **Contracts** | `interface/` | TypeScript interfaces for dependency inversion |
| **Factories** | `lib/` | Instance creation based on configuration |
| **HTTP Layer** | `modules/` | Controllers and routes organized by domain |
| **Business Logic** | `services/` | Business contract implementations |
| **Cross-cutting** | `shared/` | Errors, middlewares, and shared utilities |
| **Tooling** | `scripts/` | CLI scripts for manual operations |


---

## 🚀 Development Guidelines

### Issue Naming Convention

- Format: `[SYNCAI-###] <Issue Title>`
- Labels: `enhancement`, `feature`, `backend`, `devops`, `documentation`
- Example: `[SYNCAI-001] Implement voice input processing`

### Key Focus Areas

1. **Local Processing:** Prioritize edge computation for privacy & speed
2. **Context Awareness:** RAG system must adapt to local pedagogical context
3. **Teacher-Centric:** Always design with Sunita's multi-grade classroom in mind

### Important Constraints

- Teachers have limited device resources (older phones, poor internet)
- Pre-downloaded vector indices must be optimized for storage
- Voice processing must handle local languages/accents
- Responses must be actionable within classroom time constraints

### Coding Standards & Style

- **TypeScript Access**: Always use bracket notation for environment variables (e.g., process.env['PORT']) to avoid index signature errors.
- **Exports**: Use export default for main application components and router files.
- **Functions**: Prefer arrow functions for Express route handlers and middleware.
- **Async Logic**: Always use async/await with try/catch blocks for API calls and database interactions.

## 📌 Current Focus

This repository handles the backend and infrastructure. The frontend (React Native) is maintained separately in the [EduSync-AI](https://github.com/Sofia-gith/Edusync-AI) repository.

## 🛡️ Ethical AI & Data Privacy

Privacy First: All voice processing is done locally to ensure teacher and student privacy. Data synced to the cloud is anonymized and used only for improving pedagogical retrieval.

## 🔗 Related Links

- **Frontend Repository:** https://github.com/Sofia-gith/Edusync-AI
- **Hackathon:** Innovation for Education Equity Hackathon 2026
- **Challenge Platform:** HackerEarth (Shikshalokam)
