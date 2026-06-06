# EduAI — AI‑Powered Quiz & Performance Analytics Platform

EduAI is an end‑to‑end adaptive learning platform for **students (B2C)** and **schools / institutes (B2B)**. It uses Google **Gemini** to generate quizzes and exam papers, grade handwritten and typed answers, tutor students 24/7, and turn every result into personalized, actionable insight — online **and** offline.

> **Stack at a glance:** Express + TypeScript + MongoDB (backend) · Next.js 16 (App Router) + Tailwind CSS v4 (frontend) · Google Gemini for all AI.

---

## Table of contents

1. [Feature overview](#feature-overview)
2. [Architecture](#architecture)
3. [Tech stack](#tech-stack)
4. [Project structure](#project-structure)
5. [Getting started](#getting-started)
6. [Environment variables](#environment-variables)
7. [NPM scripts](#npm-scripts)
8. [Data models](#data-models)
9. [API reference](#api-reference)
10. [Frontend pages](#frontend-pages)
11. [Notes & limitations](#notes--limitations)

---

## Feature overview

### Learning & assessment
- **AI quiz generation** — Gemini creates MCQ practice quizzes targeted at a student's weak chapters (or a general quiz when no weakness data exists yet).
- **AI exam‑paper generation** — full school/board‑style papers (UT, Mid‑Term, Final) with a 3‑attempt validation/repair loop, exported to **PDF** via Puppeteer.
- **Answer‑sheet analysis & auto‑grading** — upload a photo/PDF of a question paper + answer sheet; Gemini extracts, grades, and builds chapter‑level topic health with a transcription‑confidence flag for manual review.
- **Adaptive exam** — timed exam whose difficulty rises/falls with recent accuracy; results are saved to history.
- **Persisted quizzes & history** — every practice / adaptive / offline quiz can be saved, reviewed later, and **paused & resumed**.

### Offline mode
- **Download a quiz while online**, then take it with **no internet** (answers graded locally).
- Attempts are **queued and auto‑sync** to your history when the device reconnects.
- **Handwritten‑answer scanner** — photograph a handwritten answer; Gemini OCR returns a transcription, a 0–100 legibility **confidence**, and a confidence‑aware preliminary grade.

### B2B institute portal
- Teachers/institutes **author exams** with **AI‑generated or manual** MCQ + descriptive questions, set duration/marks, and publish with a shareable **exam code**.
- Students **search exams** by institute, title, or code, attempt them with a **live timer**, and receive an **auto‑graded report** (descriptive answers graded by Gemini) with grade, strengths/weaknesses, and recommendations.
- Teachers see **per‑exam analytics** (submissions, average %, pass rate, per‑student results).

### Proctoring & integrity
- **Webcam proctoring** using the browser `FaceDetector` API (no‑face / multiple‑faces detection) plus tab‑switch / window‑blur monitoring, batched to the backend. Gracefully degrades to activity monitoring when face detection is unsupported.
- **Answer‑similarity checker** — deterministic cosine‑similarity across submissions to flag potential copying.

### AI insight & personalization
- **Predictive insights & alerts** — data‑driven risk scoring per subject, at‑risk topics, and recommended actions.
- **Performance analytics & dashboards** — student and teacher dashboards, trends, subject breakdowns, leaderboard.
- **Weakness heat map** — chapter‑level mastery grid coloured from topic‑health + exam data.
- **Smart content + meta‑learning** — per‑weak‑topic video/reading/flashcard suggestions (honest search links, no fabricated URLs) and study strategies (spaced repetition, concept mapping, mixed practice).
- **AI Tutor** — 24/7 Socratic tutor aware of the student's weak topics.
- **Multilingual** — a language selector makes the tutor, quizzes, recommendations, grading, and reports respond in the chosen language (English, Hindi, Spanish, French, German, Arabic, Bengali, Tamil, Telugu, Marathi).
- **Essay auto‑grading** — rubric‑based AI grading for long/essay answers.

---

## Architecture

```
Browser (Next.js 16, App Router)
   │   fetches "/api/*"
   ▼
Next.js dev server  ──(rewrite, next.config.ts)──▶  Express API  :5000
                                                        │
                                                        ├─ Mongoose ──▶ MongoDB
                                                        └─ Google Gemini (generate / grade / tutor / OCR)
```

- The frontend calls a relative `/api` base; `frontend/next.config.ts` rewrites `/api/*` to the Express server (`NEXT_PUBLIC_API_TARGET`, default `http://localhost:5000`).
- Auth is **JWT** (`Authorization: Bearer <token>`); a `protect` middleware attaches the user, and `requireRole("teacher")` guards authoring/grading endpoints.

---

## Tech stack

| Layer | Technology |
|------|------------|
| Backend | Node.js, Express 5, TypeScript (ESM), Mongoose 9 |
| Database | MongoDB |
| AI | Google Gemini (`@google/generative-ai`) — text, vision, chat |
| Auth | JWT (`jsonwebtoken`), `bcryptjs` |
| Files / PDF | `multer` (uploads), `puppeteer` (PDF rendering) |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4, Axios, react‑icons |

---

## Project structure

```
EduAI/
├── backend/                 # Express + TypeScript API
│   ├── config/db.ts         # MongoDB connection
│   ├── middleware/          # auth (JWT/roles), upload (multer)
│   ├── models/              # Mongoose schemas
│   ├── services/            # Gemini + business logic
│   ├── controllers/         # request handlers
│   ├── routes/              # route definitions
│   ├── scripts/             # seed + migrations
│   └── index.ts             # app entry / route wiring
└── frontend/                # Next.js 16 app
    └── src/
        ├── app/             # routes: (auth) + (app) groups
        ├── components/      # UI kit, layout, ProctorGuard, SmartContent, LanguageSelect
        ├── context/         # AppContext (auth), ThemeContext, LanguageContext
        ├── hooks/           # useStudentWorkspace, useStudentOverview
        └── lib/             # api client, shared types, utils
```

---

## Getting started

**Prerequisites:** Node.js 20+, a running MongoDB instance, and a Google Gemini API key (https://aistudio.google.com/app/apikey).

```bash
# 1) Backend
cd backend
cp .env.example .env          # then fill in MONGO_URI, GEMINI_API_KEY, JWT_SECRET
npm install
npm run dev                   # http://localhost:5000  (tsx watch)

# 2) Frontend (new terminal)
cd frontend
npm install
npm run dev                   # http://localhost:3000
```

Open http://localhost:3000, create an account (student or teacher), and go.

Optional: seed sample data with `cd backend && npm run seed`.

---

## Environment variables

`backend/.env` (see `backend/.env.example`):

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default 5000) |
| `FRONTEND_URL` | CORS origin (default `http://localhost:3000`) |
| `MONGO_URI` | MongoDB connection string (**required**) |
| `JWT_SECRET` | JWT signing secret (**required in production**) |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `GEMINI_API_KEY` *(or `API_KEY`)* | Google Gemini key (**required**) |
| `GEMINI_TEXT_MODEL` / `GEMINI_FILE_MODEL` | Optional model overrides (default `gemini-2.5-flash`) |

> In `NODE_ENV=production` the server refuses to start if `JWT_SECRET` is missing or left at the default.

Frontend: set `NEXT_PUBLIC_API_TARGET` only if the backend is not on `http://localhost:5000`.

---

## NPM scripts

**backend/**
| Script | Action |
|--------|--------|
| `npm run dev` | Start API with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled server |
| `npm run typecheck` | Type‑check without emitting |
| `npm run seed` | Seed sample data |

**frontend/**
| Script | Action |
|--------|--------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint |

---

## Data models

| Model | Purpose |
|-------|---------|
| `User` | Auth account (teacher/student), profile, links to a `Student` |
| `Student` | Learner profile (name, class, school) + virtual relations |
| `Exam`, `Question`, `StudentResponse` | Analyzed real exams and per‑question grading |
| `TopicHealth` | Per‑subject chapter/sub‑topic mastery status |
| `GeneratedPaper` | AI‑generated exam papers (with PDF export) |
| `Quiz` | Legacy AI‑scheduled quizzes |
| `QuizAttempt` | Persisted practice/adaptive/offline attempts (+ pause/resume) |
| `InstituteExam`, `InstituteAttempt` | B2B exams and student attempts with embedded report |
| `ProctorEvent` | Integrity signals captured during monitored attempts |

---

## API reference

Base: `/api` and `/api/v1`. All `v1` endpoints except registration/login require a Bearer token.

**Auth** — `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET|PUT /api/v1/auth/me`

**Papers & exam analysis** — `POST /api/generate-paper`, `GET /api/papers`, `GET /api/papers/:id`, `GET /api/papers/:id/download`, `GET /api/papers/class/:class`, `POST /api/analyze-exam`

**Students & analytics** — `GET /api/v1/students`, `GET /api/v1/students/:id/overview`, `GET /api/v1/students/:id/insights`, `GET /api/v1/students/:id/heatmap`, `GET /api/v1/analytics/overview`, `GET /api/v1/leaderboard`, `POST /api/v1/student/practice-quiz`

**Quiz attempts** — `POST /api/v1/quiz/attempts`, `POST /api/v1/quiz/attempts/progress`, `GET /api/v1/quiz/attempts`, `GET /api/v1/quiz/attempts/:id`

**Adaptive & tutor** — `POST /api/v1/adaptive/next`, `POST /api/v1/tutor/ask`

**Offline OCR** — `POST /api/v1/offline/ocr` (multipart image)

**Institute (B2B)** — `POST /api/v1/institute/generate-questions`, `POST|GET /api/v1/institute/exams`, `GET /api/v1/institute/exams/:id`, `GET /api/v1/institute/exams/:id/attempts`, `GET /api/v1/institute/search`, `GET /api/v1/institute/take/:code`, `POST /api/v1/institute/take/:code/start`, `POST /api/v1/institute/attempts/:id/submit`, `GET /api/v1/institute/attempts/:id/report`, `GET /api/v1/institute/my-attempts`

**Proctoring** — `POST /api/v1/proctor/events`, `GET /api/v1/proctor/events/:sessionId`

**Content & grading** — `POST /api/v1/content/recommendations`, `POST /api/v1/grading/essay` *(teacher)*, `POST /api/v1/grading/similarity` *(teacher)*

---

## Frontend pages

**Student:** Dashboard · My Exams · Quiz · Quiz History · Offline Mode · Adaptive Exam · Find Exams (+ attempt/report) · AI Tutor · Performance · Heat Map · Insights · Recommendations (+ smart content) · Leaderboard · Profile

**Teacher:** Dashboard · Generate Paper · My Exams · Institute Exams (author + results) · Students · Analytics · Essay Grader (grading + similarity) · Leaderboard · Profile

---

## Notes & limitations

- **AI quality** depends on the Gemini model and prompt; outputs are validated and normalized but should be reviewed for high‑stakes grading.
- **Webcam face detection** uses the experimental `FaceDetector` API (Chromium). On other browsers, proctoring falls back to tab/window‑activity monitoring; tab/blur monitoring works everywhere.
- **Offline mode** uses `localStorage` for the cached quiz and the sync queue; MCQ grading is done locally, while handwritten OCR requires a connection.
- Requires a reachable **MongoDB** and a valid **Gemini API key** to run.

---

_All quiz generation, grading, tutoring, recommendations, and analytics are powered by Google Gemini — a complete adaptive learning solution for students and schools._
