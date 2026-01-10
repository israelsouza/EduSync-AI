# EduSync-AI: Project Context & Guidelines

## 🎯 Project Overview

**EduSync-AI** is a solution for the _Innovation for Education Equity Hackathon 2026_ that provides just-in-time coaching for teachers through an offline voice assistant powered by Hybrid RAG (Retrieval-Augmented Generation).

**Challenge Theme:** Just-in-time Coaching for Teachers — Bridging the Gap Between Training and Classroom Implementation

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

## 🗂️ Repository Structure

```
EduSync-AI/
├── Backend code (Node.js/TypeScript)
├── API endpoints for RAG & teacher data
├── Integration with Supabase
└── Documentation & issue templates
```

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
