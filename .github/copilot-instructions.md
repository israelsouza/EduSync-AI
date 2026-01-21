# EduSync-AI: Project Context & Guidelines

## Table of Contents (TOC)
- [Project Overview](#project-overview)
- [Complete Roadmap - All Milestones](#complete-roadmap)
  - [Milestone 1: Manual Ingestion](#milestone-1)
  - [Milestone 2: RAG Response Engine](#milestone-2)
  - [Milestone 3: Synchronization & Offline-First](#milestone-3)
  - [Milestone 4: Voice Interface (Mobile STT)](#milestone-4)
  - [Milestone 5: Validation and Pitch](#milestone-5)
- [Frontend Implementation Guide](#frontend-implementation)
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

<a id="frontend-implementation"></a>
## 📱 Frontend Implementation Guide (React Native)

This section documents all services and components that need to be implemented in the [EduSync-AI Frontend](https://github.com/Sofia-gith/Edusync-AI) repository to complete the offline-first functionality.

### Backend API Endpoints Available

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/export/embeddings` | GET | Download embeddings bundle (supports pagination, gzip) |
| `/api/sync/version` | GET | Get current embedding version |
| `/api/sync/check-eligibility` | POST | Validate if client should sync |
| `/api/sync/queries` | POST | Sync offline queries (analytics) |
| `/api/sync/queries/stats` | GET | Get query statistics |

---

### 📋 Required Frontend Services

#### 1. Download Manager Service
**Interface:** `IDownloadManager` | **Priority:** High | **Complexity:** Medium

Manages background download of embeddings from backend to mobile device.

**Implementation Requirements:**
```
📁 src/services/DownloadManager.ts
├── startDownload(version?: string): Promise<void>
├── pauseDownload(): Promise<void>
├── resumeDownload(): Promise<void>
├── cancelDownload(): Promise<void>
├── getProgress(): DownloadProgress | null
├── onProgress(callback): () => void
├── isDownloading(): boolean
├── getPendingTasks(): Promise<DownloadTask[]>
└── retryFailed(): Promise<void>
```

**Key Features:**
- [ ] Batch download with configurable size (default: 500 embeddings)
- [ ] Resume interrupted downloads
- [ ] Progress tracking with speed/ETA estimation
- [ ] Retry logic with exponential backoff (max 3 retries)
- [ ] Background download support (React Native Background Fetch)

**Dependencies:** Connectivity Service, Storage Quota Manager

---

#### 2. Connectivity Service
**Interface:** `IConnectivityService` | **Priority:** High | **Complexity:** Low

Detects network connectivity changes and determines sync eligibility.

**Implementation Requirements:**
```
📁 src/services/ConnectivityService.ts
├── getStatus(): Promise<ConnectivityStatus>
├── checkSyncEligibility(rules): Promise<SyncEligibility>
├── onConnectivityChange(callback): () => void
├── estimateDownloadTime(bytes): Promise<number>
└── testConnectionQuality(apiBaseUrl): Promise<ConnectionQuality>
```

**Key Features:**
- [ ] Use `@react-native-community/netinfo` for connectivity detection
- [ ] Battery level check via `react-native-device-info`
- [ ] WiFi vs Cellular distinction
- [ ] Connection quality estimation (ping-based)
- [ ] Sync rules validation (WiFi only, min battery, etc.)

**React Native Libraries:**
- `@react-native-community/netinfo`
- `react-native-device-info`

---

#### 3. Storage Quota Manager
**Interface:** `IStorageQuotaManager` | **Priority:** High | **Complexity:** Medium

Manages local storage quotas and implements cleanup strategies.

**Implementation Requirements:**
```
📁 src/services/StorageQuotaManager.ts
├── getUsage(): Promise<StorageUsage>
├── isQuotaExceeded(): Promise<boolean>
├── hasSufficientStorage(requiredBytes): Promise<boolean>
├── monitorUsage(): Promise<void>
├── cleanup(strategy): Promise<CleanupResult>
├── setQuotaLimit(bytes): Promise<void>
└── getQuotaLimit(): Promise<number>
```

**Key Features:**
- [ ] Default quota: 100MB (configurable)
- [ ] Cleanup strategies: LRU, oldest_first, low_usage
- [ ] Automatic cleanup when quota exceeded
- [ ] Storage usage monitoring
- [ ] Warning thresholds (80%, 90%, 100%)

**Storage Estimation:**
- 384-dim embedding ≈ 1.5KB per document
- 10,000 documents ≈ 15MB
- Recommended: 50,000 documents max (75MB)

---

#### 4. Local Vector Search Service
**Interface:** `ILocalVectorSearch` | **Priority:** Critical | **Complexity:** High

Performs vector similarity search on device using local embeddings.

**Implementation Requirements:**
```
📁 src/services/LocalVectorSearch.ts
├── search(queryEmbedding, options): Promise<LocalSearchResult[]>
├── preloadEmbeddings(): Promise<void>
├── getEmbeddingCount(): Promise<number>
└── validateDimensions(embedding): boolean
```

**Key Features:**
- [ ] Cosine similarity calculation (provided in interface)
- [ ] Top-K results with min score threshold
- [ ] Optional embedding preload for faster search
- [ ] Source/chapter filtering
- [ ] Expected dimensions: 384 (all-MiniLM-L6-v2)

**Algorithm (Cosine Similarity):**
```typescript
similarity = dotProduct(A, B) / (magnitude(A) * magnitude(B))
```

**Performance Target:** <100ms for 10,000 embeddings on mid-range device

---

#### 5. Local Embedding Service (Optional)
**Interface:** `ILocalEmbeddingService` | **Priority:** Low | **Complexity:** High

Generates embeddings locally for user queries (fully offline RAG).

**Implementation Requirements:**
```
📁 src/services/LocalEmbeddingService.ts
├── generateEmbedding(text): Promise<EmbeddingGenerationResult>
├── isModelReady(): Promise<boolean>
├── downloadModel(onProgress): Promise<void>
├── getModelInfo(): Promise<ModelInfo>
└── deleteModel(): Promise<void>
```

**Recommended Model:** `Xenova/all-MiniLM-L6-v2` (quantized, ~23MB)

**Trade-offs:**
- ✅ Complete offline operation
- ✅ Privacy (queries never leave device)
- ❌ Requires ~23-118MB model download
- ❌ Slower on low-end devices (~50-100ms per query)
- ❌ Battery drain

**Recommendation:** Implement as optional feature, default to pre-computed query cache

---

#### 6. Offline Query Queue Service
**Interface:** `IOfflineQueryQueue` | **Priority:** Medium | **Complexity:** Medium

Manages queries made while offline, syncing to backend when connected.

**Implementation Requirements:**
```
📁 src/services/OfflineQueryQueue.ts
├── addQuery(query, response, metadata): Promise<string>
├── getQueue(): Promise<QueuedQuery[]>
├── syncPendingQueries(): Promise<QuerySyncResult>
├── clearSynced(): Promise<number>
├── getStats(): Promise<QueueStats>
├── retryFailed(): Promise<QuerySyncResult>
└── setUserConsent(consent): Promise<void>
```

**Key Features:**
- [ ] Requires explicit user consent for analytics sync
- [ ] Device ID anonymization (SHA-256 hashing)
- [ ] Priority queue (high/normal/low)
- [ ] Max 3 retry attempts per query
- [ ] Batch sync (50 queries per request)

**Privacy Requirements:**
- User must opt-in to query analytics
- Device ID is hashed before sync
- No PII in query metadata

---

#### 7. Cache Invalidation Service (Frontend)
**Interface:** `ICacheInvalidationService` | **Priority:** High | **Complexity:** Low

Manages local cache validation using backend version API.

**Implementation Requirements:**
```
📁 src/services/CacheInvalidationService.ts
├── checkCacheStatus(): Promise<CacheStatus>
├── getLatestVersion(): Promise<string>
├── isOutdated(): Promise<boolean>
├── invalidateCache(): Promise<void>
├── updateLocalVersion(version): Promise<void>
└── isCacheExpired(maxAgeHours?): Promise<boolean>
```

**Key Features:**
- [ ] Call `GET /api/sync/version` to get latest version
- [ ] Call `POST /api/sync/check-eligibility` for full validation
- [ ] Store local version in AsyncStorage/MMKV
- [ ] Default cache expiration: 30 days
- [ ] Force full sync if version difference > 2 major versions

---

### 📦 Local Database Schema

Implement using **WatermelonDB** (recommended) or **SQLite**.

**Tables Required:**

| Table | Description | Schema Reference |
|-------|-------------|------------------|
| `embeddings` | Vector embeddings for offline search | `LocalEmbeddingSchema` |
| `sync_metadata` | Sync state and version tracking | `SyncMetadataSchema` |
| `download_queue` | Background download tasks | `DownloadQueueSchema` |
| `offline_queries` | Queries made offline | `QueuedQuery` |

**Schema File:** `src/modules/export/mobile-storage.schema.ts`

---

### 🔄 Sync Flow Diagram

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   App Start │────▶│ Check Cache  │────▶│ Cache Valid?│
└─────────────┘     └──────────────┘     └─────────────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │ YES                       │                     NO    │
                    ▼                           ▼                           ▼
            ┌──────────────┐           ┌──────────────┐           ┌──────────────┐
            │ Use Local DB │           │ Check Eligib │           │ Full Download│
            └──────────────┘           └──────────────┘           └──────────────┘
                                              │
                              ┌───────────────┼───────────────┐
                              │ Eligible      │          Not  │
                              ▼               ▼               ▼
                      ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                      │ Delta Sync   │  │ Wait for     │  │ Use Stale    │
                      │ (changed)    │  │ WiFi/Battery │  │ Cache        │
                      └──────────────┘  └──────────────┘  └──────────────┘
```

---

### 📊 Implementation Priority Matrix

| Service | Priority | Effort | Dependencies |
|---------|----------|--------|--------------|
| Connectivity Service | 🔴 High | Low | None |
| Storage Quota Manager | 🔴 High | Medium | None |
| Download Manager | 🔴 High | Medium | Connectivity, Storage |
| Cache Invalidation | 🔴 High | Low | None |
| Local Vector Search | 🔴 Critical | High | Storage |
| Offline Query Queue | 🟡 Medium | Medium | Connectivity |
| Local Embedding (Opt) | 🟢 Low | High | Vector Search |

**Recommended Implementation Order:**
1. Connectivity Service (foundation)
2. Cache Invalidation Service (version checking)
3. Storage Quota Manager (storage safety)
4. Download Manager (get embeddings)
5. Local Vector Search (offline RAG)
6. Offline Query Queue (analytics)
7. Local Embedding Service (optional enhancement)

---

<a id="complete-roadmap"></a>
## 📋 Complete Roadmap - All Milestones

<a id="milestone-1"></a>
### ✅ Milestone 1: Manual Ingestion
<a id="milestone-2"></a>
### ✅ Milestone 2: RAG Response Engine

<a id="milestone-3"></a>
### 🔄 Milestone 3: Synchronization & Offline-First

**Current Status: Backend 100% Complete | Frontend 0% Complete**

**Goal:** Enable teachers to download embeddings and use the system offline on mobile devices.

**Phase 1: Export API (Backend)** ✅
**Phase 2: Mobile Storage (Backend Interfaces)** ✅
**Phase 3: Sync Mechanism (Backend)** ✅
**Phase 4: Offline Analytics (Backend)** ✅

**Phase 5: Frontend Implementation** ⏳
16. [ ] Implement ConnectivityService (React Native)
17. [ ] Implement StorageQuotaManager (React Native)
18. [ ] Implement DownloadManager (React Native)
19. [ ] Implement LocalVectorSearch (React Native)
20. [ ] Implement OfflineQueryQueue (React Native)
21. [ ] Implement CacheInvalidationService (React Native)
22. [ ] (Optional) Implement LocalEmbeddingService (React Native)

**Phase 6: Schema Documentation (independent)** ✅

---

<a id="milestone-4"></a>
### 🎤 Milestone 4: Voice Interface (Mobile STT)

**Current Status: Backend ~80% Complete | Mobile 0% Complete**

**Goal:** Enable teachers to interact with Sunita using voice input and receive audio responses.

**Backend Implementation Status:**

| Component | Status | File |
|-----------|--------|------|
| IAudioStreamHandler (interface) | ✅ | `src/interface/IAudioStreamHandler.ts` |
| ISTTService (interface) | ✅ | `src/interface/ISTTService.ts` |
| ITTSService (interface) | ✅ | `src/interface/ITTSService.ts` |
| IVoicePipeline (interface) | ✅ | `src/interface/IVoicePipeline.ts` |
| GoogleSTTService | ✅ | `src/services/GoogleSTTService.ts` |
| GoogleTTSService | ✅ | `src/services/GoogleTTSService.ts` |
| sttFactory | ✅ | `src/lib/sttFactory.ts` |
| ttsFactory | ✅ | `src/lib/ttsFactory.ts` |
| voice.controller | ✅ | `src/modules/voice/voice.controller.ts` |
| voice.route | ✅ | `src/modules/voice/voice.route.ts` |
| voice.types | ✅ | `src/modules/voice/voice.types.ts` |
| TTS Integration (voice.controller) | ✅ | Text and Audio endpoints with TTS |
| WhisperSTTService (local/offline) | ✅ | `src/services/WhisperSTTService.ts` |
| PiperTTSService (local/offline) | ✅ | `src/services/PiperTTSService.ts` |
| VoicePipelineService | ✅ | `src/services/VoicePipelineService.ts` |
| AudioStreamHandler | ❌ | Pending |

**Recent Progress (Jan 21, 2026):**
- ✅ Implemented VoicePipelineService with complete voice orchestration
- ✅ Session and turn management with state machine
- ✅ Event system for real-time UI updates
- ✅ Statistics tracking (avg times, error rates)
- ✅ Interruption handling and error recovery
- ✅ Fixed all lint errors (turnId optional, transcription structure, non-null assertions)
- ✅ Integrated STT→RAG→TTS pipeline
- ✅ Conversation context building from previous turns

**Previous Progress (Jan 20, 2026):**
- ✅ Implemented GoogleTTSService with voice caching and preprocessing
- ✅ Created ttsFactory for TTS service instantiation
- ✅ Added TTS_PROVIDER configuration to env.ts
- ✅ Integrated TTS into voice.controller endpoints (/text and /audio)
- ✅ Fixed Gemini model version (using gemini-2.5-flash for STT)
- ✅ Tested TTS synthesis with Portuguese voice (sunita-pt-br)
- ✅ Implemented WhisperSTTService for offline STT (whisper.cpp binding)
- ✅ Updated sttFactory to support "whisper" provider
- ✅ Created models/whisper directory for model storage
- ✅ Added model download functionality with progress tracking

**Phase 1: Audio Capture (no dependencies)** - 0/4 complete
1. [ ] [SYNCAI-017] Create audio stream handler service
2. [ ] Implement microphone permission management
3. [ ] Add audio buffer management
4. [ ] Create voice activity detection (VAD)

**Phase 2: Speech-to-Text (depends on Phase 1)** - 3/5 complete
5. [x] Create STT pipeline interface - `src/interface/ISTTService.ts` ✅
6. [x] Implement GoogleSTTService (cloud-based) ✅
7. [x] Integrate local STT model (Whisper.cpp) for offline - `src/services/WhisperSTTService.ts` ✅
8. [ ] Implement streaming transcription
9. [ ] Add language detection (Portuguese/Spanish/English)

**Phase 3: Text-to-Speech (depends on Milestone 2)** - 3/5 complete
10. [x] Create TTS service interface - `src/interface/ITTSService.ts` ✅
11. [x] Implement GoogleTTSService (cloud-based) ✅
12. [ ] Integrate local TTS model (Piper) for offline
13. [x] Implement audio output management - ✅ Via controller endpoints
14. [x] Add voice customization (speed, pitch) - ✅ Available in GoogleTTSService

**Phase 4: Voice Pipeline Integration (depends on Phase 2, 3)** - 1/5 complete
15. [x] Integrate TTS with voice.controller ✅
16. [ ] Create end-to-end VoicePipelineService
17. [ ] Implement interruption handling
18. [ ] Add audio feedback (processing sounds)
19. [ ] Optimize latency for real-time interaction

🎯 Próximos Passos Recomendados (Ordem de Prioridade):

**✅ Sprint 1 Completo: TTS Cloud Service**
- ✅ GoogleTTSService implementado e funcional
- ✅ Integração com voice.controller em /text e /audio
- ✅ Cache de síntese para melhorar performance
- ✅ Suporte a múltiplas vozes (PT-BR, ES, EN)

**✅ Sprint 2 Completo: Modelo Local STT**
- ✅ WhisperSTTService implementado com @fugood/whisper.node
- ✅ Suporte a português brasileiro (e outros idiomas)
- ✅ Download automático de modelos com progresso
- ✅ sttFactory atualizado para suportar provider "whisper"
- ✅ Diretório models/whisper configurado

**✅ Sprint 3 Completo: Modelo Local TTS (Piper)**
- ✅ PiperTTSService implementado usando `tts-pipelines` + `onnxruntime-node`
- ✅ ttsFactory atualizado para suportar provider "piper"
- ✅ Suporte a vozes em PT-BR, ES, EN (offline)
- ✅ Cache de áudio com estratégia LRU
- ✅ Pré-processamento de texto para termos educacionais
- ✅ Configuração: `TTS_PROVIDER=piper` no .env

**✅ Sprint 4 Completo: Voice Pipeline Service**
- ✅ VoicePipelineService implementado com orquestração completa
- ✅ Gerenciamento de sessões e turns com IDs únicos
- ✅ Máquina de estados (idle→listening→processing→speaking→interrupted→error)
- ✅ Sistema de eventos para updates em tempo real (VoicePipelineEvent)
- ✅ Orquestração STT→RAG→TTS completa
- ✅ Tracking de estatísticas (tempos médios, taxas de erro, interrupções)
- ✅ Suporte a interrupção durante playback de TTS
- ✅ Construção de contexto conversacional das turns anteriores
- ✅ Tratamento de erros com recuperação automática
- ✅ Todos os erros de lint corrigidos (sem any, sem non-null assertions)

**Sprint 5: Audio Capture (Mobile)** - PRÓXIMO
- Implementar `AudioStreamHandler.ts`
- Adicionar VAD (Voice Activity Detection)
- Testar captura em React Native
- Otimizar latência

**Dependências npm instaladas:**
```json
{
  "@fugood/whisper.node": "^1.0.13",       // STT local (Node.js)
  "tts-pipelines": "^0.2.8",               // TTS local (Node.js) - Piper via ONNX
  "onnxruntime-node": "latest",            // ONNX Runtime para Node.js
  "ffmpeg-static": "^5.3.0",               // Conversão de áudio
  "node-wav": "^0.0.2"                     // Manipulação WAV
}
```

**Configuração atual (.env):**
```bash
# Voice Services
STT_PROVIDER=google        # google | whisper
TTS_PROVIDER=google        # google | piper
GOOGLE_MODEL=gemini-2.5-flash  # Modelo para STT multimodal
```

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
