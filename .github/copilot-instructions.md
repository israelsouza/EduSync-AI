# EduSync-AI: Project Context & Guidelines

## Table of Contents (TOC)
- [Project Overview](#project-overview)
- [Complete Roadmap - All Milestones](#complete-roadmap)
  - [Milestone 1: Manual Ingestion](#milestone-1)
  - [Milestone 2: RAG Response Engine](#milestone-2)
  - [Milestone 3: Synchronization & Offline-First](#milestone-3)
  - [Milestone 4: Voice Interface (Mobile STT)](#milestone-4)
  - [Milestone 5: Validation and Pitch](#milestone-5)
- [Key Personas](#key-personas)
- [Problem & Solution](#problem-solution)
- [Technology Stack](#technology-stack)
- [Database Schema Documentation](#database-schema)
- [Future Enhancements](#future-enhancements)
- [How to contribute](./../FUTURE_ENHANCEMENTS.md#how-to-contribute)

<a id="project-overview"></a>
## 🎯 Project Overview

**EduSync-AI** is a solution for the _Innovation for Education Equity Hackathon 2026_ that provides just-in-time coaching for teachers through an offline voice assistant powered by Hybrid RAG (Retrieval-Augmented Generation).

**Challenge Theme:** Just-in-time Coaching for Teachers — Bridging the Gap Between Training and Classroom Implementation

---

<a id="complete-roadmap"></a>
## 📋 Complete Roadmap - All Milestones

<a id="milestone-1"></a>
### ✅ Milestone 1: Manual Ingestion
<a id="milestone-2"></a>
### ✅ Milestone 2: RAG Response Engine

<a id="milestone-3"></a>
### 🔄 Milestone 3: Synchronization & Offline-First

**Current Status: 75% Complete (Phase 1: ✅ Complete | Phase 2: ✅ Complete | Phase 3: ✅ Complete)**

**Goal:** Enable teachers to download embeddings and use the system offline on mobile devices.

**Phase 1: Export API (no dependencies)** ✅
1. [x] [SYNCAI-014] Create embeddings export endpoint - `GET /api/export/embeddings`
2. [x] Implement JSON/Vector Bundle format for mobile consumption
3. [x] Add compression (gzip) for bandwidth optimization
4. [x] Version control for embedding bundles

**Phase 2: Mobile Storage (depends on Phase 1)** ✅
5. [x] [SYNCAI-015] Define local storage schema (WatermelonDB or SQLite)
6. [x] Implement download manager service
7. [x] Create cache invalidation logic
8. [x] Add storage quota management

**Phase 3: Sync Mechanism (depends on Phase 2)** ✅
9. [x] [SYNCAI-016] Implement connectivity detection service
10. [x] Create background sync scheduler
11. [x] Add delta sync (only download changed embeddings)
12. [x] Implement conflict resolution strategy

**Phase 4: Offline RAG (depends on Phase 3)**
13. [ ] Port vector search to run locally on device
14. [ ] Implement local embedding generation (optional)
15. [ ] Add offline queue for queries made without connection

**Phase 5: Schema Documentation (independent)**
16. [x] [SYNCAI-021] Create database/schema.sql with Supabase table definitions
17. [x] Document vector extension configuration (pgvector)
18. [x] Add table indexes and performance optimizations
19. [x] Create schema migration guide for future updates

---

<a id="milestone-4"></a>
### 🎤 Milestone 4: Voice Interface (Mobile STT)

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

<a id="milestone-5"></a>
### ✅ Milestone 5: Validation and Pitch

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
Milestone 1 (Ingestion) ✅
    │
    ▼
Milestone 2 (RAG Response Engine) ◐ ─────────────────┐
    │                                               │
    ├──────────────────────┐                        │
    ▼                      ▼                        ▼
Milestone 3            Milestone 4            Milestone 5
(Offline-First)        (Voice Interface)        (Validation)
    │                      │                        ▲
    │                      │                        │
    └──────────────────────┴────────────────────────┘
```

**Legend:** ✅ Complete | ◐ In Progress | ○ Not Started



---

<a id="key-personas"></a>
## 👥 Key Personas

### Sunita (Primary User)

- Passionate multi-grade teacher in rural schools
- Limited access to continuous professional development
- Teaches mixed-age classes (4th-6th grade) with diverse learning needs
- **Core Need:** Immediate pedagogical strategies in real-time classroom situations

### CRP (Coordinator of Pedagogical Resources)

- Mentor providing professional development support
- Appears rarely with generic advice
- **Benefit:** EduSync-AI reduces the gap between teacher needs and support availability

---

<a id="problem-solution"></a>
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

<a id="user-experience-flow"></a>
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

<a id="technology-stack"></a>
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

---

<a id="database-schema"></a>
## 🗄️ Database Schema Documentation

All database documentation and DDL (Supabase) and local storage (WatermelonDB / SQLite) is consolidated in:

- Backend (Supabase): `database/schema.sql` (file with DDL, functions and migration notes)
- Mobile (WatermelonDB schema): `src/modules/export/mobile-storage.schema.ts`

> Note: keeping documentation centralized in these files avoids divergence between documentation and implementation.

Quick reference:
- `database/schema.sql` → tables: `pedagogical_knowledge_v384`, `offline_queries`, `embedding_versions` + function `match_documents_v384`
- `src/modules/export/mobile-storage.schema.ts` → local tables: `embeddings`, `sync_metadata`, `download_queue`

---

<a id="future-enhancements"></a>
## Future Enhancements

Full list and backlog is tracked in [`FUTURE_ENHANCEMENTS.md`](../FUTURE_ENHANCEMENTS.md).

---

## 🛡️ Ethical AI & Data Privacy

Privacy First: All voice processing is done locally to ensure teacher and student privacy. Data synced to the cloud is anonymized and used only for improving pedagogical retrieval.

<a id="related-links"></a>
## 🔗 Related Links

- **Frontend Repository:** https://github.com/Sofia-gith/Edusync-AI
- **Hackathon:** Innovation for Education Equity Hackathon 2026
- **Challenge Platform:** HackerEarth (Shikshalokam)
