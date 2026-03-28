from pydantic import BaseModel, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
import math


# ── Request / Response Models ──────────────────────────────────────────────

class StartSessionRequest(BaseModel):
    student_id: str
    chapter_id: str = "grade7_number_play"


class StartSessionResponse(BaseModel):
    session_id: str
    student_id: str
    chapter_id: str
    message: str


class NextQuestionRequest(BaseModel):
    session_id: str
    student_id: str


class OptionModel(BaseModel):
    key: str
    text: str


class HintModel(BaseModel):
    level: int
    text: str


class QuestionResponse(BaseModel):
    question_id: str
    concept_id: str
    subtopic_id: str
    subtopic_name: str
    concept_name: str
    difficulty: int
    question: str
    options: List[OptionModel]
    expected_time: int
    base_score: int
    hints_available: int
    # Concept explanation sent with the question
    concept_explanation: Optional[Dict[str, Any]] = None
    story_example: Optional[Dict[str, Any]] = None
    solved_examples: Optional[List[Dict[str, Any]]] = None


class SubmitAnswerRequest(BaseModel):
    session_id: str
    student_id: str
    question_id: str
    selected_answer: str
    time_taken: int          # seconds
    hints_used: int          # 0-3
    subtopic_id: Optional[str] = None  # set in quiz mode to scope adaptive state


class SubmitAnswerResponse(BaseModel):
    correct: bool
    correct_answer: str
    explanation: str
    score_earned: float
    hint_factor: float
    time_factor: float
    show_remedial: bool
    next_action: str          # "retry" | "next_question" | "remedial" | "complete"
    topic_score: float
    message: str
    attempts_on_question: int = 0
    attempt_factor: float = 1.0


class HintRequest(BaseModel):
    session_id: str
    student_id: str
    question_id: str
    hint_level: int           # 1, 2, or 3


class HintResponse(BaseModel):
    hint_level: int
    hint_text: str
    hints_remaining: int


class RemedialRequest(BaseModel):
    session_id: str
    student_id: str
    question_id: str


class RemedialResponse(BaseModel):
    title: str
    explanation: str
    rule: str
    example: str
    apply: str


class CompleteSessionRequest(BaseModel):
    session_id: str
    student_id: str


# ── Learner Model ──────────────────────────────────────────────────────────

class AttemptRecord(BaseModel):
    question_id: str
    concept_id: str
    subtopic_id: str
    attempts: int
    correctness: bool
    time_taken: int
    hints_used: int
    score_earned: float
    timestamp: str


class TopicScores(BaseModel):
    kc1: float = 0.0
    kc2: float = 0.0
    kc3: float = 0.0
    kc4: float = 0.0
    kc5: float = 0.0


class LearnerProfile(BaseModel):
    student_id: str
    session_id: str
    current_level: int = 1
    topic_scores: Dict[str, float] = {
        "kc1": 0.0, "kc2": 0.0, "kc3": 0.0, "kc4": 0.0, "kc5": 0.0
    }
    attempt_history: List[AttemptRecord] = []
    created_at: str = ""
    updated_at: str = ""


# ── Session Payload (final submission) ────────────────────────────────────

class SessionPayload(BaseModel):
    student_id: str
    session_id: str
    chapter_id: str
    total_attempted: int
    correct: int
    wrong: int
    hints_used: int
    time_spent: int                          # total seconds
    topic_scores: Dict[str, Optional[float]] # null = NaN (no data), never 0 for unvisited
    completion_status: str                   # "completed" | "partial" | "abandoned"

    @validator("correct")
    def correct_le_attempted(cls, v, values):
        if "total_attempted" in values and v > values["total_attempted"]:
            raise ValueError("correct cannot exceed total_attempted")
        return v

    @validator("wrong")
    def wrong_le_attempted(cls, v, values):
        if "total_attempted" in values and "correct" in values:
            if values["correct"] + v > values["total_attempted"]:
                raise ValueError("correct + wrong cannot exceed total_attempted")
        return v

    @validator("topic_scores")
    def scores_in_range(cls, v):
        for key, score in v.items():
            if score is not None and not (0.0 <= score <= 100.0):
                raise ValueError(f"topic score {key}={score} must be in [0, 100]")
        return v


# ── Dashboard ──────────────────────────────────────────────────────────────

class DashboardResponse(BaseModel):
    student_id: str
    session_id: str
    topic_scores: Dict[str, float]
    total_attempted: int
    total_correct: int
    total_hints_used: int
    overall_score: float
    current_level: int
    badges: List[str]
    recent_attempts: List[AttemptRecord]
