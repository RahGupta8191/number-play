// ── API Response Types ─────────────────────────────────────────────────────

export interface Option {
  key: string;
  text: string;
}

export interface ConceptExplanation {
  title: string;
  body: string;
  key_idea: string;
}

export interface StoryExample {
  title: string;
  body: string;
}

export interface SolvedExample {
  question: string;
  steps: string[];
  answer: string;
}

export interface QuestionResponse {
  question_id: string;
  concept_id: string;
  subtopic_id: string;
  subtopic_name: string;
  concept_name: string;
  difficulty: number;
  question: string;
  options: Option[];
  expected_time: number;
  base_score: number;
  hints_available: number;
  concept_explanation?: ConceptExplanation;
  story_example?: StoryExample;
  solved_examples?: SolvedExample[];
}

export interface SubmitAnswerResponse {
  correct: boolean;
  correct_answer: string;
  explanation: string;
  score_earned: number;
  hint_factor: number;
  time_factor: number;
  show_remedial: boolean;
  next_action: "retry" | "next_question" | "remedial" | "complete";
  topic_score: number;
  message: string;
  attempts_on_question: number;
  attempt_factor: number;
}

export interface HintResponse {
  hint_level: number;
  hint_text: string;
  hints_remaining: number;
}

export interface RemedialContent {
  title: string;
  explanation: string;
  rule: string;
  example: string;
  apply: string;
}

export interface TopicScores {
  kc1: number;
  kc2: number;
  kc3: number;
  kc4: number;
  kc5: number;
  [key: string]: number;
}

export interface AttemptRecord {
  question_id: string;
  concept_id: string;
  subtopic_id: string;
  attempts: number;
  correctness: boolean;
  time_taken: number;
  hints_used: number;
  score_earned: number;
  timestamp: string;
}

export interface DashboardResponse {
  student_id: string;
  session_id: string;
  topic_scores: TopicScores;
  total_attempted: number;
  total_correct: number;
  total_hints_used: number;
  overall_score: number;        // points earned / max possible × 100
  current_level: number;
  badges: string[];
  recent_attempts: AttemptRecord[];
  first_attempt_correct: number;
  total_score_earned: number;
  max_possible_score: number;
  overall_kc_mastery: number;
}

export interface SessionPayload {
  student_id: string;
  session_id: string;
  chapter_id: string;
  total_attempted: number;
  correct: number;
  wrong: number;
  hints_used: number;
  time_spent: number;
  topic_scores: { [key: string]: number | null };
  completion_status: string;
}

export interface Concept {
  id: string;
  name: string;
}

export interface Subtopic {
  id: string;
  name: string;
  icon: string;
  description: string;
  concepts: Concept[];
}

export interface ChapterMetadata {
  chapter_id: string;
  chapter_name: string;
  grade: number;
  description: string;
  subtopics: Subtopic[];
}

// ── Lecture Types ──────────────────────────────────────────────────────────

export interface LectureConcept {
  id: string;
  name: string;
  order: number;
  explanation?: ConceptExplanation;
  story_example?: StoryExample;
  solved_examples?: SolvedExample[];
}

export interface LectureResponse {
  subtopic_id: string;
  subtopic_name: string;
  description: string;
  concepts: LectureConcept[];
}

// ── Local Session State ────────────────────────────────────────────────────

export interface SessionState {
  studentId: string;
  sessionId: string;
  chapterId: string;
}
