"""
Pedagogical Model — Adaptive question selection and flow control.

Design
──────
This implements a mastery-based adaptive ITS following the flow:
  start easy → if correct → harder question
             → if wrong   → re-attempt (hints auto-revealed)
                          → 3 failures → remedial lesson → next question

Per-KC Difficulty Adaptation (up/down algorithm)
─────────────────────────────────────────────────
Each knowledge component (KC) tracks its own target difficulty (1–3)
and a consecutive-result streak:

  • 2 consecutive correct answers in KC  → advance difficulty (1→2→3)
  • 2 consecutive wrong  answers in KC  → drop difficulty    (3→2→1)
  • Advancing or dropping resets the streak counter for that KC

This means a learner who struggles at difficulty 2 will automatically
be given easier questions until they stabilise, then progress again.

Mastery Gate
────────────
A KC's difficulty can only advance if its topic score > 40%.
This prevents a lucky streak from pushing a weak learner to hard questions.

Question Selection Priority
───────────────────────────
1. Unattempted question at target difficulty for current KC
2. Unattempted question at any difficulty for current KC (sorted easy→hard)
3. Move to next KC (ordered kc1→kc5) and repeat steps 1–2
4. Extra practice on the KC with the lowest topic score
5. Final fallback: any remaining question

Subtopic Filter (Quiz Mode)
───────────────────────────
When subtopic_id is supplied, only that KC's questions are considered.
All other logic is identical.
"""

from typing import Optional, List, Dict

SUBTOPIC_ORDER = ["kc1", "kc2", "kc3", "kc4", "kc5"]


# ── Adaptive state helpers ─────────────────────────────────────────────────

def _get_difficulty_target(learner: Dict, subtopic_id: str) -> int:
    """Current target difficulty for a KC. Default: 1 (easy)."""
    return learner.get("difficulty_targets", {}).get(subtopic_id, 1)


def update_adaptive_state(learner: Dict, subtopic_id: str, correct: bool) -> None:
    """
    Update per-KC difficulty target and streak based on latest answer.
    Mutates the learner dict in-place (caller must save learner after).
    """
    difficulty_targets = learner.setdefault("difficulty_targets", {kc: 1 for kc in SUBTOPIC_ORDER})
    kc_streaks = learner.setdefault("kc_streaks", {kc: {"correct": 0, "wrong": 0} for kc in SUBTOPIC_ORDER})

    if subtopic_id not in kc_streaks:
        kc_streaks[subtopic_id] = {"correct": 0, "wrong": 0}
    if subtopic_id not in difficulty_targets:
        difficulty_targets[subtopic_id] = 1

    streak  = kc_streaks[subtopic_id]
    current = difficulty_targets[subtopic_id]
    topic_score = learner.get("topic_scores", {}).get(subtopic_id, 0.0)

    if correct:
        streak["correct"] += 1
        streak["wrong"]    = 0
        # Advance if 2 consecutive correct AND mastery gate cleared
        if streak["correct"] >= 2 and current < 3 and topic_score >= 40.0:
            difficulty_targets[subtopic_id] = current + 1
            streak["correct"] = 0   # reset after advancing
    else:
        streak["wrong"]  += 1
        streak["correct"] = 0
        # Drop difficulty if 2 consecutive wrong and not already at floor
        if streak["wrong"] >= 2 and current > 1:
            difficulty_targets[subtopic_id] = current - 1
            streak["wrong"] = 0   # reset after dropping

    kc_streaks[subtopic_id] = streak


# ── Question selection ──────────────────────────────────────────────────────

def get_next_question(
    learner: Dict,
    all_questions: Optional[List[Dict]] = None,
    subtopic_filter: Optional[str] = None,
    retake: bool = False,
) -> Optional[Dict]:
    """
    Select the next adaptive question for the learner.

    Args:
        learner:          Learner profile dict.
        all_questions:    Full ordered question list (from content_loader).
        subtopic_filter:  If set, restrict selection to this KC (quiz mode).

    Returns:
        Question dict or None if all questions in scope are answered correctly.
    """
    from content_loader import get_questions_ordered
    if all_questions is None:
        all_questions = get_questions_ordered()

    # Apply KC filter for quiz mode
    pool = (
        [q for q in all_questions if q["_subtopic_id"] == subtopic_filter]
        if subtopic_filter
        else all_questions
    )

    history    = learner.get("attempt_history", [])
    attempted  = {a["question_id"] for a in history}

    # In quiz retake mode, ignore correctly_done so all KC questions are fresh.
    # In normal quiz mode, scope correctly_done to current session only.
    current_session_id = learner.get("session_id", "")
    if subtopic_filter and retake:
        correctly_done = set()   # retake: all questions available again
    elif subtopic_filter:
        correctly_done = {
            a["question_id"] for a in history
            if a.get("correctness", False)
            and a.get("session_id", "") == current_session_id
        }
    else:
        correctly_done = {
            a["question_id"] for a in history if a.get("correctness", False)
        }
    remaining = [q for q in pool if q["id"] not in correctly_done]

    if not remaining:
        return None  # All done in scope

    # Determine subtopic traversal order
    if subtopic_filter:
        kc_order = [subtopic_filter]
    else:
        # Start with the KC that was last active, then continue in order
        last_kc = history[-1]["subtopic_id"] if history else SUBTOPIC_ORDER[0]
        # Put last KC first, then remaining KCs in order
        others = [kc for kc in SUBTOPIC_ORDER if kc != last_kc]
        kc_order = [last_kc] + others

    for subtopic_id in kc_order:
        target_diff = _get_difficulty_target(learner, subtopic_id)

        # Pass 1: unattempted questions at target difficulty for this KC
        candidates = [
            q for q in remaining
            if q["_subtopic_id"] == subtopic_id
            and q["id"] not in attempted
            and q.get("difficulty", 1) == target_diff
        ]
        if candidates:
            return candidates[0]

        # Pass 2: any unattempted question in this KC (sorted easy → hard)
        candidates = [
            q for q in remaining
            if q["_subtopic_id"] == subtopic_id
            and q["id"] not in attempted
        ]
        if candidates:
            candidates.sort(key=lambda q: q.get("difficulty", 1))
            return candidates[0]

    # Pass 3: extra practice — KC with lowest topic score that still has questions
    topic_scores = learner.get("topic_scores", {})
    kcs_by_score = sorted(
        [kc for kc in (kc_order if subtopic_filter else SUBTOPIC_ORDER)],
        key=lambda kc: topic_scores.get(kc, 0.0)
    )
    for kc in kcs_by_score:
        weak_qs = [q for q in remaining if q["_subtopic_id"] == kc]
        if weak_qs:
            weak_qs.sort(key=lambda q: q.get("difficulty", 1))
            return weak_qs[0]

    # Final fallback
    remaining.sort(key=lambda q: q.get("difficulty", 1))
    return remaining[0]


# ── Flow control ────────────────────────────────────────────────────────────

def determine_next_action(
    learner: Dict,
    question: Dict,
    correct: bool,
    attempts_on_question: int,
    subtopic_filter: Optional[str] = None,
) -> str:
    """
    Return one of: "retry" | "next_question" | "remedial" | "complete"
    """
    from content_loader import get_questions_ordered
    all_questions = get_questions_ordered()

    pool = (
        [q for q in all_questions if q["_subtopic_id"] == subtopic_filter]
        if subtopic_filter
        else all_questions
    )

    current_session_id = learner.get("session_id", "")
    history = learner.get("attempt_history", [])
    if subtopic_filter:
        correctly_done = {
            a["question_id"] for a in history
            if a.get("correctness", False)
            and a.get("session_id", "") == current_session_id
        }
    else:
        correctly_done = {
            a["question_id"] for a in history if a.get("correctness", False)
        }

    if correct:
        if len(correctly_done) >= len(pool):
            return "complete"
        return "next_question"

    # Wrong answer
    if attempts_on_question >= 3:
        # After remedial, check if anything remains
        remaining = [q for q in pool if q["id"] not in correctly_done]
        remaining = [q for q in remaining if q["id"] != question["id"]]
        if not remaining:
            return "complete"
        return "remedial"

    return "retry"


# ── Learner level update ────────────────────────────────────────────────────

def update_level(learner: Dict) -> int:
    """
    Level reflects overall mastery.
    Level 1 → 2: average KC score ≥ 50%
    Level 2 → 3: average KC score ≥ 80%
    """
    scores = [v for v in learner.get("topic_scores", {}).values() if v > 0]
    if not scores:
        return learner.get("current_level", 1)

    avg = sum(scores) / len(scores)
    if avg >= 80.0:
        return 3
    elif avg >= 50.0:
        return 2
    return 1


# ── Session completion ──────────────────────────────────────────────────────

def get_completion_status(learner: Dict, all_questions: List[Dict]) -> str:
    correctly_done = {
        a["question_id"] for a in learner.get("attempt_history", [])
        if a.get("correctness", False)
    }
    total = len(all_questions)
    done  = len(correctly_done)
    if done == 0:
        return "abandoned"
    if done >= total:
        return "completed"
    return "partial"


# ── Mastery summary (for feedback UI) ─────────────────────────────────────

def get_kc_mastery_summary(learner: Dict) -> Dict:
    """
    Returns per-KC summary for rich feedback display.
    {
      "kc1": {"score": 72.5, "difficulty": 2, "status": "progressing"},
      ...
    }
    Statuses: "not_started" | "struggling" | "progressing" | "mastered"
    """
    summary = {}
    for kc in SUBTOPIC_ORDER:
        score  = learner.get("topic_scores", {}).get(kc, 0.0)
        diff   = _get_difficulty_target(learner, kc)
        streak = learner.get("kc_streaks", {}).get(kc, {"correct": 0, "wrong": 0})

        if score == 0.0 and not any(
            a["subtopic_id"] == kc for a in learner.get("attempt_history", [])
        ):
            status = "not_started"
        elif score >= 80.0:
            status = "mastered"
        elif streak.get("wrong", 0) >= 1 or score < 40.0:
            status = "struggling"
        else:
            status = "progressing"

        summary[kc] = {"score": round(score, 1), "difficulty": diff, "status": status}
    return summary
