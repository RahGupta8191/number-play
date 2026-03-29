"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getNextQuestion, submitAnswer, getHint, getRemedial, completeSession,
} from "@/lib/api";
import type { QuestionResponse, SubmitAnswerResponse, RemedialContent } from "@/lib/types";

// ── Small display components ───────────────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="h-2 rounded-full bg-brand-purple transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400 font-semibold">
        <span>{value} completed</span>
        <span className="text-brand-purple font-black">{pct}%</span>
        <span>{max} total</span>
      </div>
    </div>
  );
}

function TimerDisplay({ seconds, running }: { seconds: number; running: boolean }) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  const color = seconds >= 90 ? "text-red-500" : seconds >= 50 ? "text-orange-500" : "text-gray-600";
  return (
    <span className={`font-black tabular-nums text-sm ${color} ${!running ? "opacity-40" : ""}`}>
      {mins}:{secs}
    </span>
  );
}

function DifficultyPill({ level }: { level: number }) {
  const cfg = [
    { label: "Easy",   cls: "bg-green-100 text-green-700" },
    { label: "Easy",   cls: "bg-green-100 text-green-700" },
    { label: "Medium", cls: "bg-yellow-100 text-yellow-700" },
    { label: "Hard",   cls: "bg-red-100 text-red-700" },
  ];
  const c = cfg[level] ?? cfg[1];
  return <span className={`text-xs font-black px-2.5 py-1 rounded-full ${c.cls}`}>{c.label}</span>;
}

function AttemptPill({ attempt }: { attempt: number }) {
  if (attempt <= 1) return null;
  const cfg: Record<number, { cls: string; label: string }> = {
    2: { cls: "bg-orange-100 text-orange-700", label: "2nd attempt" },
    3: { cls: "bg-red-100 text-red-700",       label: "3rd attempt" },
  };
  const c = cfg[attempt] ?? cfg[3];
  return <span className={`text-xs font-black px-2.5 py-1 rounded-full ${c.cls}`}>{c.label}</span>;
}

// ── Concept explanation panel ──────────────────────────────────────────────

function ConceptPanel({
  explanation,
  story,
  solvedExamples,
}: {
  explanation?: { title: string; body: string; key_idea: string };
  story?: { title: string; body: string };
  solvedExamples?: { question: string; steps: string[]; answer: string }[];
}) {
  const [open, setOpen] = useState(true);
  if (!explanation) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition"
      >
        <div>
          <p className="text-xs text-brand-purple font-black uppercase tracking-widest mb-0.5">
            Concept Explanation
          </p>
          <p className="font-black text-gray-800">{explanation.title}</p>
        </div>
        <span className="text-gray-400 font-black text-sm ml-4 shrink-0">{open ? "Hide ▲" : "Show ▼"}</span>
      </button>

      {open && (
        <div className="px-6 pb-6 space-y-4 border-t border-gray-100">
          <p className="text-gray-700 leading-relaxed text-sm whitespace-pre-line pt-4">{explanation.body}</p>
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-sm">
            <span className="font-black text-brand-purple">Key Idea: </span>
            <span className="text-gray-700">{explanation.key_idea}</span>
          </div>

          {story && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm">
              <p className="font-black text-amber-700 mb-1">{story.title}</p>
              <p className="text-gray-600 leading-relaxed">{story.body}</p>
            </div>
          )}

          {solvedExamples && solvedExamples.length > 0 && (
            <div className="space-y-3">
              <p className="font-black text-gray-600 text-sm">Worked Examples</p>
              {solvedExamples.map((ex, i) => (
                <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm">
                  <p className="font-semibold text-gray-700 mb-2">{ex.question}</p>
                  {ex.steps.map((s, j) => (
                    <p key={j} className="text-gray-500 ml-3">→ {s}</p>
                  ))}
                  <p className="mt-2 font-black text-green-700">Answer: {ex.answer}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Auto-hints panel ───────────────────────────────────────────────────────

function HintsPanel({ hints }: { hints: string[] }) {
  if (hints.length === 0) return null;
  const styles = [
    "bg-blue-50 border-blue-200 text-blue-800",
    "bg-yellow-50 border-yellow-200 text-yellow-800",
  ];
  return (
    <div className="space-y-2">
      {hints.map((text, i) => (
        <div key={i} className={`px-4 py-3 rounded-xl border text-sm font-semibold ${styles[i] ?? styles[1]}`}>
          <span className="font-black">Hint {i + 1}: </span>
          {text}
        </div>
      ))}
    </div>
  );
}

// ── Score breakdown ────────────────────────────────────────────────────────

function factorColor(value: number, type: "attempt" | "hint" | "time"): string {
  // Green = full credit, yellow = reduced, red = heavily reduced
  if (type === "attempt") {
    if (value >= 1.0) return "text-green-600";
    if (value >= 0.55) return "text-yellow-500";
    return "text-red-500";
  }
  if (type === "hint") {
    if (value >= 1.0) return "text-green-600";
    if (value >= 0.80) return "text-yellow-500";
    return "text-red-500";
  }
  // time
  if (value >= 1.0) return "text-green-600";
  if (value >= 0.90) return "text-yellow-500";
  return "text-red-500";
}

function factorLabel(value: number, type: "attempt" | "hint" | "time"): string {
  if (type === "attempt") {
    if (value >= 1.0) return "1st try";
    if (value >= 0.55) return "2nd try";
    return "3rd try";
  }
  if (type === "hint") {
    if (value >= 1.0) return "no hints";
    if (value >= 0.80) return "1 hint";
    if (value >= 0.60) return "2 hints";
    return "3 hints";
  }
  if (value > 1.0) return "fast!";
  if (value >= 1.0) return "on time";
  if (value >= 0.90) return "slightly slow";
  if (value >= 0.75) return "slow";
  return "very slow";
}

function ScoreBreakdown({ result }: { result: SubmitAnswerResponse }) {
  const blocks = [
    {
      title: "Attempt",
      value: `×${result.attempt_factor.toFixed(2)}`,
      sub: factorLabel(result.attempt_factor, "attempt"),
      color: factorColor(result.attempt_factor, "attempt"),
      hint: "1st try ×1.00 · 2nd ×0.55 · 3rd ×0.25",
    },
    {
      title: "Hints",
      value: `×${result.hint_factor.toFixed(2)}`,
      sub: factorLabel(result.hint_factor, "hint"),
      color: factorColor(result.hint_factor, "hint"),
      hint: "0 hints ×1.00 · 1 hint ×0.80 · 2 ×0.60 · 3 ×0.40",
    },
    {
      title: "Speed",
      value: `×${result.time_factor.toFixed(2)}`,
      sub: factorLabel(result.time_factor, "time"),
      color: factorColor(result.time_factor, "time"),
      hint: "Fast ×1.10 · On time ×1.00 · Slow ×0.75–0.55",
    },
  ];

  return (
    <div className="mt-4 space-y-3">
      {/* Formula row */}
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <span className="font-black text-gray-700 text-base">
          {result.correct ? result.score_earned.toFixed(1) : "0"}
        </span>
        <span className="text-gray-400 font-semibold">pts</span>
        <span className="text-gray-300 mx-1">=</span>
        <span className="text-gray-500 font-semibold">10</span>
        {blocks.map((b) => (
          <span key={b.title} className="flex items-center gap-1">
            <span className="text-gray-300">×</span>
            <span className={`font-black ${b.color}`}>{b.value.replace("×", "")}</span>
            <span className="text-gray-400 text-xs font-semibold">({b.sub})</span>
          </span>
        ))}
      </div>

      {/* Factor cards */}
      <div className="grid grid-cols-3 gap-2">
        {blocks.map((b) => (
          <div key={b.title} className="bg-white rounded-xl p-3 border border-gray-100 text-center">
            <p className={`font-black text-lg ${b.color}`}>{b.value}</p>
            <p className="text-xs font-black text-gray-500 mt-0.5">{b.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">{b.sub}</p>
          </div>
        ))}
      </div>

      {/* KC score */}
      <div className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-gray-100">
        <div>
          <p className="text-xs font-black text-gray-400 uppercase tracking-wide">KC Mastery Score</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {result.correct
              ? "Updated: correct answer advances mastery"
              : "Small decay: wrong answer reduces mastery estimate"}
          </p>
        </div>
        <p className="font-black text-brand-purple text-xl">{result.topic_score.toFixed(1)}%</p>
      </div>
    </div>
  );
}

// ── Remedial panel ─────────────────────────────────────────────────────────

function RemedialPanel({ content }: { content: RemedialContent }) {
  return (
    <div className="bg-white border border-orange-200 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 bg-orange-50 border-b border-orange-200">
        <p className="text-xs font-black text-orange-600 uppercase tracking-widest mb-0.5">Lesson Review</p>
        <p className="font-black text-gray-800">{content.title}</p>
      </div>
      <div className="px-6 py-5 space-y-4">
        <p className="text-gray-700 text-sm leading-relaxed">{content.explanation}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
            <p className="font-black text-orange-700 mb-1 text-xs uppercase">The Rule</p>
            <p className="text-gray-700">{content.rule}</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="font-black text-blue-700 mb-1 text-xs uppercase">Example</p>
            <p className="text-gray-700">{content.example}</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl p-3">
            <p className="font-black text-green-700 mb-1 text-xs uppercase">Applied Here</p>
            <p className="text-gray-700">{content.apply}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main learning page ─────────────────────────────────────────────────────

type Phase = "loading" | "concept" | "question" | "feedback" | "remedial" | "complete";

export default function LearnPage() {
  const router = useRouter();

  const [studentId, setStudentId]         = useState("");
  const [sessionId, setSessionId]         = useState("");
  const [question, setQuestion]           = useState<QuestionResponse | null>(null);
  const [selected, setSelected]           = useState<string | null>(null);
  const [result, setResult]               = useState<SubmitAnswerResponse | null>(null);
  const [phase, setPhase]                 = useState<Phase>("loading");
  const [attemptsOnQuestion, setAttempts] = useState(0);
  const [autoHints, setAutoHints]         = useState<string[]>([]);
  const [remedial, setRemedial]           = useState<RemedialContent | null>(null);
  const [elapsed, setElapsed]             = useState(0);
  const timerRef                          = useRef<ReturnType<typeof setInterval> | null>(null);
  const [answered, setAnswered]           = useState(0);
  const [errorMsg, setErrorMsg]           = useState("");
  const [submitting, setSubmitting]       = useState(false);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const TOTAL = 45;

  // ── Timer ──────────────────────────────────────────────────────────────

  function startTimer() {
    setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function resumeTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  }

  // ── Fetch next question ────────────────────────────────────────────────

  const fetchNext = useCallback(async (sid: string, sesId: string) => {
    stopTimer();
    setPhase("loading");
    setSelected(null);
    setResult(null);
    setAutoHints([]);
    setRemedial(null);
    setAttempts(0);
    setErrorMsg("");
    setShowReviewPrompt(false);

    try {
      const res = await getNextQuestion(sesId, sid);
      if ("status" in res && res.status === "complete") {
        setPhase("complete");
        return;
      }
      const q = res as QuestionResponse;
      setQuestion(q);

      const seen: string[] = JSON.parse(localStorage.getItem("attempted_concepts") || "[]");
      if (q.concept_explanation && !seen.includes(q.concept_id)) {
        setPhase("concept");
      } else {
        setPhase("question");
        startTimer();
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to load. Check backend on port 8000.");
      setPhase("question");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Init ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const sid   = localStorage.getItem("studentId") || "";
    const sesId = localStorage.getItem("sessionId") || "";
    if (!sid || !sesId) { router.push("/"); return; }
    setStudentId(sid);
    setSessionId(sesId);
    fetchNext(sid, sesId);
    return () => stopTimer();
  }, [router, fetchNext]);

  // ── Actions ────────────────────────────────────────────────────────────

  function proceedToQuestion() {
    if (!question) return;
    const seen: string[] = JSON.parse(localStorage.getItem("attempted_concepts") || "[]");
    if (!seen.includes(question.concept_id)) {
      localStorage.setItem("attempted_concepts", JSON.stringify([...seen, question.concept_id]));
    }
    setPhase("question");
    startTimer();
  }

  async function handleSubmit() {
    if (!selected || !question || submitting) return;
    stopTimer();
    setSubmitting(true);
    setErrorMsg("");

    try {
      const res = await submitAnswer(
        sessionId, studentId,
        question.question_id,
        selected,
        elapsed,
        autoHints.length,
      );

      const newAttempts = attemptsOnQuestion + 1;
      setAttempts(newAttempts);
      setResult(res);

      if (res.correct) {
        setAnswered((n) => n + 1);
        setShowReviewPrompt(res.topic_score < 70);
        setPhase("feedback");
        return;
      }

      if (newAttempts >= 3) {
        // 3rd wrong → remedial (hints already progressively revealed)
        try {
          const rem = await getRemedial(sessionId, studentId, question.question_id);
          setRemedial(rem);
        } catch (_) {}
        setPhase("remedial");
      } else {
        // After each wrong attempt, reveal the next hint before the next try
        // Attempt 1 wrong → reveal hint 1; Attempt 2 wrong → reveal hint 2
        const nextHintLevel = autoHints.length + 1;
        if (nextHintLevel <= question.hints_available) {
          try {
            const h = await getHint(sessionId, studentId, question.question_id, nextHintLevel);
            setAutoHints((prev) => [...prev, h.hint_text]);
          } catch (_) {}
        }
        setPhase("feedback");
      }
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Submission failed. Check backend.");
      resumeTimer();
    } finally {
      setSubmitting(false);
    }
  }

  function handleTryAgain() {
    setSelected(null);
    setResult(null);
    setErrorMsg("");
    resumeTimer();
    setPhase("question");
  }

  async function handleNext() {
    if (result?.next_action === "complete") { setPhase("complete"); return; }
    await fetchNext(studentId, sessionId);
  }

  async function handleComplete() {
    try { await completeSession(sessionId, studentId); } catch (_) {}
    router.push("/dashboard");
  }

  // ── Render ─────────────────────────────────────────────────────────────

  if (phase === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <div className="w-10 h-10 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 font-semibold text-sm">Selecting your next question…</p>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <div className="max-w-lg mx-auto text-center py-16 space-y-6">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center text-4xl mx-auto">
          ✓
        </div>
        <div>
          <h1 className="text-3xl font-black text-gray-900">Chapter Complete!</h1>
          <p className="text-gray-500 mt-2">
            Well done, {studentId}. You answered {answered} question{answered !== 1 ? "s" : ""}.
          </p>
        </div>
        <button onClick={handleComplete} className="btn-primary px-10">
          View My Results
        </button>
      </div>
    );
  }

  const displayAttempt = attemptsOnQuestion + 1;

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
              {question?.subtopic_name}
            </p>
            <p className="text-sm font-black text-brand-purple">{question?.concept_name}</p>
          </div>
          <TimerDisplay seconds={elapsed} running={phase === "question"} />
        </div>
        <ProgressBar value={answered} max={TOTAL} />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-semibold">
            Q {answered + 1} of {TOTAL}
          </span>
          {question && <DifficultyPill level={question.difficulty} />}
          <AttemptPill attempt={displayAttempt} />
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
          <p className="font-black text-red-600">Connection Error</p>
          <p className="text-red-500 mt-0.5">{errorMsg}</p>
          <p className="text-xs text-gray-400 mt-1 font-mono">uvicorn main:app --reload --port 8000</p>
        </div>
      )}

      {/* ── Concept phase ────────────────────────────────────────────────── */}
      {phase === "concept" && question && (
        <div className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-sm">
            <span className="font-black text-brand-purple">New concept: </span>
            <span className="text-gray-600">Read the explanation below before attempting the question.</span>
          </div>
          <ConceptPanel
            explanation={question.concept_explanation}
            story={question.story_example}
            solvedExamples={question.solved_examples}
          />
          <button onClick={proceedToQuestion} className="btn-primary w-full">
            I understand — show me the question
          </button>
        </div>
      )}

      {/* ── Question / Feedback / Remedial ──────────────────────────────── */}
      {(phase === "question" || phase === "feedback" || phase === "remedial") && question && (
        <div className="space-y-4">

          {/* Question card */}
          <div className="bg-white border border-gray-200 rounded-2xl px-6 py-5">
            <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-3">
              Question {answered + 1}
            </p>
            <p className="text-lg font-black text-gray-900 leading-snug mb-5">
              {question.question}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {question.options.map((opt) => {
                let cls = "flex items-start gap-3 p-4 rounded-xl border-2 font-semibold text-sm transition-all duration-150 ";

                if (phase === "feedback" || phase === "remedial") {
                  const isCorrect  = opt.key === result?.correct_answer;
                  const isSelected = opt.key === selected;
                  const reveal     = result?.correct || phase === "remedial";
                  if (reveal && isCorrect) cls += "bg-green-50 border-green-400 text-green-800";
                  else if (isSelected)     cls += "bg-red-50 border-red-300 text-red-700";
                  else                     cls += "bg-gray-50 border-gray-200 text-gray-400";
                } else {
                  cls += opt.key === selected
                    ? "bg-purple-50 border-brand-purple text-brand-purple cursor-pointer"
                    : "bg-white border-gray-200 hover:border-gray-400 text-gray-700 cursor-pointer";
                }

                return (
                  <button
                    key={opt.key}
                    disabled={phase !== "question"}
                    onClick={() => setSelected(opt.key)}
                    className={cls}
                  >
                    <span className="w-6 h-6 rounded-full bg-brand-purple text-white flex items-center justify-center text-xs font-black shrink-0">
                      {opt.key}
                    </span>
                    <span className="text-left leading-snug">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Auto hints */}
          <HintsPanel hints={autoHints} />

          {/* Feedback */}
          {result && (phase === "feedback" || phase === "remedial") && (
            <div className={`rounded-2xl border-2 px-6 py-4 ${result.correct ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
              <p className={`font-black text-base ${result.correct ? "text-green-700" : "text-red-700"}`}>
                {result.message}
              </p>
              <ScoreBreakdown result={result} />
            </div>
          )}

          {/* Remedial lesson */}
          {remedial && phase === "remedial" && <RemedialPanel content={remedial} />}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {phase === "question" && (
              <button
                disabled={!selected || submitting}
                onClick={handleSubmit}
                className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? "Checking…" : "Check Answer"}
              </button>
            )}

            {phase === "feedback" && result?.correct && showReviewPrompt && question && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm">
                <p className="font-black text-amber-700 mb-1">Review Recommended</p>
                <p className="text-amber-600 mb-2">
                  Your mastery of <strong>{question.subtopic_name}</strong> is below 70%. Re-reading the lesson will help you improve.
                </p>
                <button
                  onClick={() => router.push(`/chapter?kc=${question.subtopic_id}`)}
                  className="text-xs font-black text-amber-700 underline hover:text-amber-900"
                >
                  Go to Lecture →
                </button>
              </div>
            )}

            {phase === "feedback" && result?.correct && (
              <button onClick={handleNext} className="btn-primary w-full">
                {result.next_action === "complete" ? "Finish Chapter" : "Next Question →"}
              </button>
            )}

            {phase === "feedback" && result && !result.correct && (
              <button onClick={handleTryAgain} className="btn-orange w-full">
                Try Again
              </button>
            )}

            {phase === "remedial" && (
              <button onClick={handleNext} className="btn-primary w-full">
                {result?.next_action === "complete" ? "Finish Chapter" : "Next Question →"}
              </button>
            )}
          </div>

          <div className="text-center">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-xs text-gray-400 hover:text-brand-purple underline transition-colors"
            >
              View progress dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
