# EduSync-AI

A solution for the challenge of `Innovation for Education Equity Hackathon 2026`

> **Challenge Theme:** [Just-in-time Coaching for Teachers — Bridging the Gap Between Training and Classroom Implementation](https://www.hackerearth.com/challenges/hackathon/shikshalokam-2/custom-tab/theme-1/#theme-1)

## Personas

**`Sunita`** - A passionate multi-grade teacher in a rural school with limited access to continuous professional development. She teaches mixed-age classes (4th-6th grade) with diverse learning needs and limited resources. She's eager to implement innovative teaching methods but struggles with immediate pedagogical challenges in real-time classroom situations.

**`CRP` (Coordinador de Recursos Pedagógicos)** - The mentor responsible for providing professional development support to teachers. Appears rarely and often gives generic advice that doesn't fit the specific multi-grade classroom context. Benefits from EduSync-AI as it reduces the gap between teacher needs and support availability.

## Problem and Solution

| Aspect                                           | Description                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The Problem**                                  | **Pedagogical Isolation:** `Sunita` has no one to exchange ideas with in the moment of "chaos".<br><br>**Asynchronous and Generic Feedback:** The mentor (`CRP`) appears rarely and gives advice that doesn't apply to the multi-grade classroom reality.<br><br>**Implementation Anxiety:** The fear of making mistakes causes the teacher to abandon innovation and return to mechanical teaching. |
| **The Solution (EduSync AI: The Pocket Mentor)** | An offline voice assistant that uses Hybrid RAG to provide immediate management and pedagogical strategies, based on official state manuals, but adapted to the local context by AI.                                                                                                                                                                                                                 |

## User Experience Flow

| Stage                                | Description                                                                                                                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Voice Input**                      | `Sunita` presses a physical button (or voice command) and describes the problem: "4th grade class, advanced students agitated, others stuck on subtraction with zero. I need a quick hook!"               |
| **Local Processing (Edge)**          | The app converts voice to text (local STT) and feeds the SLM.                                                                                                                                             |
| **Contextual Retrieval (Local RAG)** | The app searches vector indices stored on the phone (pre-downloaded) for the manual excerpt about "Subtraction" and "Multi-grade classroom management".                                                   |
| **Adaptive Response**                | The app responds via audio: "`Sunita`, use the 'Student Monitor' strategy for the advanced ones. For the zero group, explain that zero is an 'empty chair' that needs help from the neighbor tens place." |

## Success Metrics

| Metric                                  | Description                                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Query-to-Resolution Time**            | Reduction in time between teacher's immediate need and receiving actionable guidance.                          |
| **Frequency of On-Demand Interactions** | Number of teachers using the system for real-time classroom support per week/month.                            |
| **Strategy Implementation Rate**        | Percentage of teachers successfully implementing personalized strategies in their specific classroom contexts. |
| **Implementation Anxiety Reduction**    | Self-reported confidence in trying innovative pedagogical methods without abandoning them mid-implementation.  |

## Technology Stack

### Frontend Repository

The mobile frontend (React Native) is maintained in a separate repository:

- **Repository:** [EduSync-AI-Frontend](https://github.com/Sofia-gith/)

### Backend & Cloud

| Component        | Description                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language         | Node.js (TypeScript).                                                                                                                             |
| Central Database | Supabase (PostgreSQL + pgvector) to store all manuals and teacher usage logs.                                                                     |
| RAG Pipeline     | LangChain.js to process manual PDFs and generate embeddings that will be sent to teachers' phones during synchronization (when there's internet). |
