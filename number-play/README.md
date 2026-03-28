# Number Play — Intelligent Tutoring System
### ET 605 Assignment | Anika Sahoo · Harshil Singla · Rahul Gupta

---

## System Overview

**Number Play** is a full-stack Adaptive Learning System (ITS) for Grade 7 students.
It implements all three classic ITS components:

| Component | Technology | Purpose |
|---|---|---|
| Domain Model | `backend/data/content.json` | All course content, questions, hints, remedial |
| Learner Model | SQLite + JSON | Per-student attempt history, topic scores, level |
| Pedagogical Model | `pedagogical_model.py` | Adaptive question selection, difficulty control |

---

## Folder Structure

```
number-play/
├── backend/
│   ├── main.py                  ← FastAPI routes
│   ├── models.py                ← Pydantic models + validation
│   ├── database.py              ← SQLite persistence + retry logic
│   ├── content_loader.py        ← Content indexing
│   ├── pedagogical_model.py     ← Adaptive logic
│   ├── scoring.py               ← PersonalizedScore formula
│   ├── requirements.txt
│   └── data/
│       ├── content.json         ← Full course content (5 KCs, 17 questions)
│       ├── learners.db          ← SQLite DB (auto-created on startup)
│       └── failed_payloads.json ← Retry queue
├── frontend/
│   ├── app/
│   │   ├── page.tsx             ← Home / Login
│   │   ├── chapter/page.tsx     ← Chapter overview
│   │   ├── learn/page.tsx       ← Main learning screen ⭐
│   │   ├── dashboard/page.tsx   ← Progress dashboard
│   │   └── remedial/page.tsx    ← Standalone remedial view
│   ├── lib/
│   │   ├── api.ts               ← All API calls
│   │   └── types.ts             ← TypeScript types
│   ├── package.json
│   ├── next.config.js
│   └── tailwind.config.js
├── metadata.json                ← Chapter structure (deliverable)
├── sample_session_payload.json  ← Validated sample payload (deliverable)
└── README.md
```

---

## Running Locally

### 1 — Backend (FastAPI)

```bash
cd number-play/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start server (auto-reloads on change)
uvicorn main:app --reload --port 8000
```

Backend runs at: **http://localhost:8000**
API docs: **http://localhost:8000/docs**

---

### 2 — Frontend (Next.js)

```bash
cd number-play/frontend

# Install dependencies
npm install

# Set API URL (create .env.local)
echo 'NEXT_PUBLIC_API_URL=http://localhost:8000' > .env.local

# Start dev server
npm run dev
```

Frontend runs at: **http://localhost:3000**

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/start-session` | Create new learner session |
| `GET`  | `/next-question` | Get next adaptive question |
| `POST` | `/submit-answer` | Submit answer, update learner model |
| `GET`  | `/hint` | Get hint (levels 1–3) |
| `GET`  | `/remedial` | Get remedial content |
| `POST` | `/complete-session` | Finalise session, return validated payload |
| `GET`  | `/dashboard` | Learner progress dashboard |
| `GET`  | `/metadata` | Chapter structure |
| `POST` | `/retry-failed-payloads` | Retry stored failed submissions |

---

## Scoring Formula

```
PersonalizedScore = BaseScore × HintFactor × TimeFactor
```

| Hints Used | HintFactor | Time Taken vs Expected | TimeFactor |
|---|---|---|---|
| 0 | 1.0 | ≤ T | 1.0 |
| 1 | 0.9 | ≤ 1.5T | 0.9 |
| 2 | 0.8 | ≤ 2T | 0.8 |
| 3 | 0.7 | > 2T | 0.7 |

Topic scores use a rolling weighted average: `new = 0.7 × old + 0.3 × (earned/base × 100)`

---

## Adaptive Logic

```
IF correct:
  → increase difficulty / move to next concept
  → IF all topic_scores > 80% → increase current_level

IF incorrect:
  → attempt 1: show Hint 1
  → attempt 2: show Hint 2
  → attempt 3: show Hint 3 + force remedial

IF topic_score < 50%: → extra practice + remedial
IF topic_score > 80%: → harder questions
```

---

## Session Payload Validation (Strict)

Before `/complete-session` returns, it enforces:

1. `correct + wrong ≤ total_attempted`
2. `total_attempted ≤ total questions in chapter`
3. `hints_used ≤ total_attempted × 3`
4. All `topic_scores` in `[0.0, 100.0]`
5. Missing values → `NaN` (never `0`)
6. Failed payloads stored to `failed_payloads.json` and retried via `/retry-failed-payloads`

---

## Deployment

### Frontend → Vercel

```bash
# 1. Push frontend/ to a GitHub repository
# 2. Go to https://vercel.com → New Project → Import repo
# 3. Set root directory to: number-play/frontend
# 4. Add environment variable:
#    NEXT_PUBLIC_API_URL = https://your-backend.onrender.com
# 5. Deploy
```

### Backend → Render

```bash
# 1. Push the entire repo to GitHub
# 2. Go to https://render.com → New Web Service
# 3. Connect your repo
# 4. Set:
#    Root Directory:   number-play/backend
#    Build Command:    pip install -r requirements.txt
#    Start Command:    uvicorn main:app --host 0.0.0.0 --port $PORT
# 5. Deploy (free tier works)
```

### Connecting Frontend and Backend

- Copy the Render deployment URL (e.g. `https://number-play-api.onrender.com`)
- In Vercel, set environment variable: `NEXT_PUBLIC_API_URL=https://number-play-api.onrender.com`
- Redeploy frontend

---

## Demo Instructions (for Evaluation)

### Demo Flow: Wrong → Hints → Remedial → Correct

1. Open `http://localhost:3000`
2. Enter name → click **Start Learning**
3. On any question, **select a wrong answer** → Submit
4. Click **💡 Hint 1** → wrong answer again
5. Click **💡 Hint 2** → wrong again
6. After 3 attempts → **📚 Show Me the Lesson** appears (remedial triggered)
7. Read the remedial → click **Got it!**
8. Next question arrives at appropriate difficulty

### Demo Flow: Adaptive Difficulty

1. Answer 3+ questions correctly with no hints
2. Visit `/dashboard` → observe topic score rising above 80%
3. Next questions will be `difficulty: 2` or `difficulty: 3`

### Demo Flow: Session Payload

1. Complete several questions
2. Call `POST /complete-session` (or answer all questions → click Finish)
3. Dashboard loads with full validated payload

---

## Content Structure

| KC | Topic | Concepts | Questions |
|---|---|---|---|
| KC1 | Number Patterns | 3 | 9 |
| KC2 | Odd & Even Numbers | 3 | 9 |
| KC3 | Divisibility Rules | 3 | 9 |
| KC4 | Number Sequences | 3 | 9 |
| KC5 | Logical Number Puzzles | 3 | 9 |
| **Total** | | **15** | **45** |

Each question has:
- 4 MCQ options
- 3 progressive hints
- Remedial lesson
- Expected time (for TimeFactor scoring)

---

## Design Report Alignment

| Section | Implementation |
|---|---|
| Domain Model | `content.json` — full content hierarchy |
| Learner Model | SQLite `learners` table + JSON profile |
| Pedagogical Logic | `pedagogical_model.py` — adaptive selection |
| Scoring Model | `scoring.py` — PersonalizedScore formula |
| Session Tracking | One payload per session, strict validation |
| Failure Handling | `failed_payloads.json` + `/retry-failed-payloads` |
