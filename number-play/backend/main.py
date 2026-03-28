"""
Number Play — Intelligent Tutoring System
FastAPI Backend
"""
import uuid
import math
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import database as db
import content_loader as cl
import scoring as sc
import pedagogical_model as pm
from models import (
    StartSessionRequest, StartSessionResponse,
    NextQuestionRequest, QuestionResponse, OptionModel,
    SubmitAnswerRequest, SubmitAnswerResponse,
    HintRequest, HintResponse,
    RemedialRequest, RemedialResponse,
    CompleteSessionRequest, SessionPayload,
    DashboardResponse, AttemptRecord,
)

# ── App Setup ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="Number Play ITS",
    description="Intelligent Tutoring System for Number Play (Grade 7)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    db.init_db()
    cl.load_content()
    print("[ITS] Database initialised. Content loaded.")


# ── Helpers ────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.utcnow().isoformat()


def _load_or_404(session_id: str) -> dict:
    learner = db.load_learner(session_id)
    if not learner:
        raise HTTPException(status_code=404, detail="Session not found.")
    return learner


def _attempts_on(learner: dict, question_id: str) -> int:
    return sum(
        1 for a in learner.get("attempt_history", [])
        if a["question_id"] == question_id
    )


def _build_question_response(q: dict, include_concept: bool = False) -> QuestionResponse:
    options = [OptionModel(key=o["key"], text=o["text"]) for o in q["options"]]
    return QuestionResponse(
        question_id=q["id"],
        concept_id=q["_concept_id"],
        subtopic_id=q["_subtopic_id"],
        subtopic_name=q["_subtopic_name"],
        concept_name=q["_concept_name"],
        difficulty=q.get("difficulty", 1),
        question=q["question"],
        options=options,
        expected_time=q.get("expected_time", 60),
        base_score=q.get("base_score", 10),
        hints_available=len(q.get("hints", [])),
        concept_explanation=q.get("_concept_explanation") if include_concept else None,
        story_example=q.get("_story_example") if include_concept else None,
        solved_examples=q.get("_solved_examples", []) if include_concept else None,
    )


# ── Routes ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "Number Play ITS"}


@app.get("/metadata")
def get_metadata():
    """Return chapter structure (subtopics + concepts)."""
    return cl.get_metadata()


@app.get("/lectures")
def get_lectures(subtopic_id: str):
    """Return full concept explanations for a subtopic (for study/lecture mode)."""
    subtopic = cl.get_subtopic(subtopic_id)
    if not subtopic:
        raise HTTPException(status_code=404, detail=f"Subtopic '{subtopic_id}' not found.")

    concepts = []
    for concept in subtopic.get("concepts", []):
        concepts.append({
            "id": concept["id"],
            "name": concept["name"],
            "order": concept.get("order", 0),
            "explanation": concept.get("explanation"),
            "story_example": concept.get("story_example"),
            "solved_examples": concept.get("solved_examples", []),
        })

    return {
        "subtopic_id": subtopic["id"],
        "subtopic_name": subtopic["name"],
        "description": subtopic.get("description", ""),
        "concepts": concepts,
    }


@app.post("/start-session", response_model=StartSessionResponse)
def start_session(req: StartSessionRequest):
    """Create a new learner session."""
    if not req.student_id.strip():
        raise HTTPException(status_code=400, detail="student_id cannot be empty.")

    session_id = str(uuid.uuid4())
    now = _now()

    # Carry over progress if this student has learned before
    existing = db.load_learner_by_student_id(req.student_id.strip())
    profile = {
        "student_id": req.student_id.strip(),
        "session_id": session_id,
        "chapter_id": req.chapter_id,
        "current_level": existing["current_level"] if existing else 1,
        "topic_scores": existing["topic_scores"] if existing else {"kc1": 0.0, "kc2": 0.0, "kc3": 0.0, "kc4": 0.0, "kc5": 0.0},
        "attempt_history": existing["attempt_history"] if existing else [],
        "created_at": now,
        "updated_at": now,
    }
    db.save_learner(profile)

    return StartSessionResponse(
        session_id=session_id,
        student_id=req.student_id.strip(),
        chapter_id=req.chapter_id,
        message="Session started! Let's play with numbers 🎉",
    )


@app.get("/next-question")
def next_question(
    session_id: str,
    student_id: str,
    subtopic_id: Optional[str] = None,
):
    """
    Return the next adaptive question for the learner.
    Optional subtopic_id restricts selection to a single KC (quiz mode).
    """
    learner = _load_or_404(session_id)

    if learner["student_id"] != student_id:
        raise HTTPException(status_code=403, detail="student_id mismatch.")

    all_questions = cl.get_questions_ordered()
    q = pm.get_next_question(learner, all_questions, subtopic_filter=subtopic_id)

    if q is None:
        return {"status": "complete", "message": "You have completed this section!"}

    # Include concept explanation only on the first question of a new concept
    attempted_concepts = {a["concept_id"] for a in learner.get("attempt_history", [])}
    include_concept = q["_concept_id"] not in attempted_concepts

    return _build_question_response(q, include_concept=include_concept)


@app.post("/submit-answer", response_model=SubmitAnswerResponse)
def submit_answer(req: SubmitAnswerRequest):
    """Record a learner's answer and update their model."""
    learner = _load_or_404(req.session_id)

    if learner["student_id"] != req.student_id:
        raise HTTPException(status_code=403, detail="student_id mismatch.")

    q = cl.get_question(req.question_id)
    if q is None:
        raise HTTPException(status_code=404, detail="Question not found.")

    correct = req.selected_answer.strip().upper() == q["correct_answer"].strip().upper()

    # Count total attempts on this question so far (must be defined before calculate_score)
    prev_attempts = _attempts_on(learner, req.question_id)
    attempts_now = prev_attempts + 1

    # Calculate score (only award if correct)
    score_data = sc.calculate_score(
        base_score=q.get("base_score", 10),
        hints_used=req.hints_used,
        time_taken=req.time_taken,
        expected_time=q.get("expected_time", 60),
        attempts=attempts_now,
    )
    score_earned = score_data["score"] if correct else 0.0

    # Update topic score
    subtopic_id = q["_subtopic_id"]
    old_score = learner["topic_scores"].get(subtopic_id, 0.0)
    new_score = sc.update_topic_score(old_score, score_earned, q.get("base_score", 10), correct)
    learner["topic_scores"][subtopic_id] = new_score

    # Update per-KC adaptive state (difficulty target + streak).
    # Only on first attempt per question to avoid double-penalising retries,
    # but always update when correct (even on retry) so progress is recorded.
    if attempts_now == 1 or correct:
        pm.update_adaptive_state(learner, q["_subtopic_id"], correct)

    # Append attempt record
    attempt = {
        "question_id": req.question_id,
        "concept_id": q["_concept_id"],
        "subtopic_id": subtopic_id,
        "attempts": attempts_now,
        "correctness": correct,
        "time_taken": req.time_taken,
        "hints_used": req.hints_used,
        "score_earned": score_earned,
        "timestamp": _now(),
    }
    learner["attempt_history"].append(attempt)

    # Update overall level from aggregate mastery
    learner["current_level"] = pm.update_level(learner)

    db.save_learner(learner)

    # Determine next action (scope to KC in quiz mode)
    all_questions = cl.get_questions_ordered()
    next_action = pm.determine_next_action(
        learner, q, correct, attempts_now,
        subtopic_filter=req.subtopic_id,
    )

    show_remedial = attempts_now >= 3 and not correct

    if correct:
        message = "✅ Correct! Great job!"
    elif attempts_now >= 3:
        # Final attempt — reveal explanation in remedial, not here
        message = "❌ Not quite. Check the lesson below to understand why."
    else:
        # Retryable — never reveal the answer or explanation
        message = "❌ Not quite! Have another look and try again."

    return SubmitAnswerResponse(
        correct=correct,
        correct_answer=q["correct_answer"],
        explanation=q["explanation"],
        score_earned=score_earned,
        hint_factor=score_data["hint_factor"],
        time_factor=score_data["time_factor"],
        show_remedial=show_remedial,
        next_action=next_action,
        topic_score=new_score,
        message=message,
        attempts_on_question=attempts_now,
        attempt_factor=score_data["attempt_factor"],
    )


@app.get("/hint", response_model=HintResponse)
def get_hint(session_id: str, student_id: str, question_id: str, hint_level: int):
    """Return a specific hint for a question (1-indexed)."""
    learner = _load_or_404(session_id)

    if learner["student_id"] != student_id:
        raise HTTPException(status_code=403, detail="student_id mismatch.")

    q = cl.get_question(question_id)
    if q is None:
        raise HTTPException(status_code=404, detail="Question not found.")

    hints = q.get("hints", [])
    if hint_level < 1 or hint_level > len(hints):
        raise HTTPException(
            status_code=400,
            detail=f"hint_level must be between 1 and {len(hints)}."
        )

    return HintResponse(
        hint_level=hint_level,
        hint_text=hints[hint_level - 1],
        hints_remaining=len(hints) - hint_level,
    )


@app.get("/remedial", response_model=RemedialResponse)
def get_remedial(session_id: str, student_id: str, question_id: str):
    """Return remedial content for a question."""
    learner = _load_or_404(session_id)

    if learner["student_id"] != student_id:
        raise HTTPException(status_code=403, detail="student_id mismatch.")

    q = cl.get_question(question_id)
    if q is None:
        raise HTTPException(status_code=404, detail="Question not found.")

    remedial = q.get("remedial", {})
    if not remedial:
        raise HTTPException(status_code=404, detail="No remedial content for this question.")

    return RemedialResponse(
        title=remedial.get("title", "Let's Review"),
        explanation=remedial.get("explanation", ""),
        rule=remedial.get("rule", ""),
        example=remedial.get("example", ""),
        apply=remedial.get("apply", ""),
    )


@app.post("/complete-session", response_model=SessionPayload)
def complete_session(req: CompleteSessionRequest):
    """
    Finalise the session. Build, validate, and store ONE payload per session.
    Re-calling this endpoint for the same session_id is rejected (409).
    """
    learner = _load_or_404(req.session_id)

    if learner["student_id"] != req.student_id:
        raise HTTPException(status_code=403, detail="student_id mismatch.")

    # ── Rule: ONE payload per session ─────────────────────────────────────
    if db.payload_exists(req.session_id):
        raise HTTPException(
            status_code=409,
            detail="Payload already submitted for this session. No duplicates allowed."
        )

    history = learner.get("attempt_history", [])
    all_questions = cl.get_questions_ordered()

    # Compute aggregate stats — one entry per unique question (last attempt counts)
    seen: dict = {}
    for a in history:
        seen[a["question_id"]] = a  # last attempt wins

    total_attempted = len(seen)
    correct   = sum(1 for a in seen.values() if a.get("correctness", False))
    wrong     = total_attempted - correct
    hints_used = sum(a.get("hints_used", 0) for a in seen.values())
    time_spent = sum(a.get("time_taken", 0) for a in history)

    # ── Sanity Checks (STRICT) ─────────────────────────────────────────────
    if correct + wrong > total_attempted:
        raise HTTPException(
            status_code=422,
            detail=f"Validation failed: correct({correct}) + wrong({wrong}) > attempted({total_attempted})"
        )

    max_questions = len(all_questions)
    if total_attempted > max_questions:
        raise HTTPException(
            status_code=422,
            detail=f"Validation failed: attempted({total_attempted}) > total({max_questions})"
        )

    max_hints = total_attempted * 3
    if hints_used > max_hints:
        raise HTTPException(
            status_code=422,
            detail=f"Validation failed: hints_used({hints_used}) > max({max_hints})"
        )

    # ── Topic scores: null (NaN) for KCs with zero attempts ───────────────
    attempted_subtopics = {a["subtopic_id"] for a in history}
    raw_scores = learner.get("topic_scores", {})
    topic_scores: dict = {}
    for k, v in raw_scores.items():
        if k not in attempted_subtopics:
            topic_scores[k] = None          # NaN — no data for this KC
        else:
            rounded = round(v, 2)
            if not (0.0 <= rounded <= 100.0):
                raise HTTPException(
                    status_code=422,
                    detail=f"Validation failed: topic_scores.{k}={rounded} out of [0,100]"
                )
            topic_scores[k] = rounded

    completion_status = pm.get_completion_status(learner, all_questions)

    payload = {
        "student_id": learner["student_id"],
        "session_id": req.session_id,
        "chapter_id": learner.get("chapter_id", "grade7_number_play"),
        "total_attempted": total_attempted,
        "correct": correct,
        "wrong": wrong,
        "hints_used": hints_used,
        "time_spent": time_spent,
        "topic_scores": topic_scores,
        "completion_status": completion_status,
    }

    try:
        db.save_payload(req.session_id, payload)
    except Exception as e:
        db.store_failed_payload(payload)
        raise HTTPException(
            status_code=500,
            detail=f"Payload storage failed (stored for retry): {e}"
        )

    return SessionPayload(**payload)


@app.get("/dashboard", response_model=DashboardResponse)
def dashboard(session_id: str, student_id: str):
    """Return learner's progress dashboard."""
    learner = _load_or_404(session_id)

    if learner["student_id"] != student_id:
        raise HTTPException(status_code=403, detail="student_id mismatch.")

    history = learner.get("attempt_history", [])
    seen: dict = {}
    for a in history:
        seen[a["question_id"]] = a

    total_attempted = len(seen)
    total_correct = sum(1 for a in seen.values() if a.get("correctness", False))
    total_hints = sum(a.get("hints_used", 0) for a in seen.values())

    topic_scores = learner.get("topic_scores", {})
    non_zero = [v for v in topic_scores.values() if v > 0]
    overall = round(sum(non_zero) / len(non_zero), 2) if non_zero else 0.0

    badges = []
    if total_correct >= 5:
        badges.append("⭐ 5 Correct Answers")
    if total_hints == 0 and total_correct > 0:
        badges.append("🏆 No Hints Needed")
    if overall >= 80:
        badges.append("🔥 Top Scorer")
    if total_correct >= total_attempted > 0 and total_attempted >= 3:
        badges.append("✅ Perfect Session")

    recent = sorted(history, key=lambda a: a.get("timestamp", ""), reverse=True)[:5]
    recent_attempts = [AttemptRecord(**a) for a in recent]

    return DashboardResponse(
        student_id=learner["student_id"],
        session_id=session_id,
        topic_scores=topic_scores,
        total_attempted=total_attempted,
        total_correct=total_correct,
        total_hints_used=total_hints,
        overall_score=overall,
        current_level=learner.get("current_level", 1),
        badges=badges,
        recent_attempts=recent_attempts,
    )


@app.post("/retry-failed-payloads")
def retry_failed():
    """Retry all stored failed payloads."""
    failed = db.get_failed_payloads()
    results = []
    for entry in failed:
        payload = entry["payload"]
        try:
            db.save_payload(payload["session_id"], payload)
            db.clear_failed_payload(payload["session_id"])
            results.append({"session_id": payload["session_id"], "status": "retried_ok"})
        except Exception as e:
            results.append({"session_id": payload.get("session_id"), "status": "failed", "error": str(e)})
    return {"retried": len(results), "results": results}
