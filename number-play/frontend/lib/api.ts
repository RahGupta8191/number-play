import type {
  QuestionResponse,
  SubmitAnswerResponse,
  HintResponse,
  RemedialContent,
  DashboardResponse,
  SessionPayload,
  ChapterMetadata,
  LectureResponse,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "API error");
  }
  return res.json() as Promise<T>;
}

// ── Session ────────────────────────────────────────────────────────────────

export async function startSession(studentId: string, chapterId = "grade7_number_play") {
  return request<{ session_id: string; student_id: string; chapter_id: string; message: string }>(
    "/start-session",
    { method: "POST", body: JSON.stringify({ student_id: studentId, chapter_id: chapterId }) }
  );
}

// ── Content ────────────────────────────────────────────────────────────────

export async function getMetadata(): Promise<ChapterMetadata> {
  return request<ChapterMetadata>("/metadata");
}

export async function getLectures(subtopicId: string): Promise<LectureResponse> {
  const params = new URLSearchParams({ subtopic_id: subtopicId });
  return request<LectureResponse>(`/lectures?${params}`);
}

// ── Question Flow ──────────────────────────────────────────────────────────

export async function getNextQuestion(
  sessionId: string,
  studentId: string,
  subtopicId?: string,
  retake?: boolean,
): Promise<QuestionResponse | { status: "complete"; message: string }> {
  const params = new URLSearchParams({ session_id: sessionId, student_id: studentId });
  if (subtopicId) params.set("subtopic_id", subtopicId);
  if (retake) params.set("retake", "true");
  return request<QuestionResponse | { status: "complete"; message: string }>(
    `/next-question?${params}`
  );
}

export async function submitAnswer(
  sessionId: string,
  studentId: string,
  questionId: string,
  selectedAnswer: string,
  timeTaken: number,
  hintsUsed: number,
  subtopicId?: string,
): Promise<SubmitAnswerResponse> {
  return request<SubmitAnswerResponse>("/submit-answer", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      student_id: studentId,
      question_id: questionId,
      selected_answer: selectedAnswer,
      time_taken: timeTaken,
      hints_used: hintsUsed,
      subtopic_id: subtopicId ?? null,
    }),
  });
}

// ── Hints ──────────────────────────────────────────────────────────────────

export async function getHint(
  sessionId: string,
  studentId: string,
  questionId: string,
  hintLevel: number
): Promise<HintResponse> {
  const params = new URLSearchParams({
    session_id: sessionId,
    student_id: studentId,
    question_id: questionId,
    hint_level: String(hintLevel),
  });
  return request<HintResponse>(`/hint?${params}`);
}

// ── Remedial ───────────────────────────────────────────────────────────────

export async function getRemedial(
  sessionId: string,
  studentId: string,
  questionId: string
): Promise<RemedialContent> {
  const params = new URLSearchParams({
    session_id: sessionId,
    student_id: studentId,
    question_id: questionId,
  });
  return request<RemedialContent>(`/remedial?${params}`);
}

// ── Session Completion ─────────────────────────────────────────────────────

export async function completeSession(
  sessionId: string,
  studentId: string
): Promise<SessionPayload> {
  return request<SessionPayload>("/complete-session", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, student_id: studentId }),
  });
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export async function getDashboard(
  sessionId: string,
  studentId: string
): Promise<DashboardResponse> {
  const params = new URLSearchParams({ session_id: sessionId, student_id: studentId });
  return request<DashboardResponse>(`/dashboard?${params}`);
}
