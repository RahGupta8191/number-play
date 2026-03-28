"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getNextQuestion, submitAnswer, getHint, getRemedial,
} from "@/lib/api";
import type { QuestionResponse, SubmitAnswerResponse, RemedialContent } from "@/lib/types";

// ── KC metadata ────────────────────────────────────────────────────────────

const KC_META: Record<string, { name: string; description: string; color: string; questions: number }> = {
  kc1: { name: "Number Patterns",     description: "Identify and extend patterns in number sequences.",        color: "purple", questions: 9 },
  kc2: { name: "Odd & Even Numbers",  description: "Properties and operations with odd and even numbers.",    color: "pink",   questions: 9 },
  kc3: { name: "Divisibility Rules",  description: "Quick rules to test divisibility without long division.", color: "blue",   questions: 9 },
  kc4: { name: "Number Sequences",    description: "Arithmetic and geometric sequence patterns.",             color: "green",  questions: 9 },
  kc5: { name: "Logical Puzzles",     description: "Apply logical reasoning to number-based puzzles.",        color: "orange", questions: 9 },
};

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  purple: { bg: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-200", bar: "bg-purple-500"  },
  pink:   { bg: "bg-pink-50",    text: "text-pink-700",    border: "border-pink-200",   bar: "bg-pink-500"    },
  blue:   { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200",   bar: "bg-blue-500"    },
  green:  { bg: "bg-green-50",   text: "text-green-700",   border: "border-green-200",  bar: "bg-green-500"   },
  orange: { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200", bar: "bg-orange-500"  },
};

// ── Reusable UI components ─────────────────────────────────────────────────

function ProgressBar({ value, max, barClass }: { value: number; max: number; barClass: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full ${barClass} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-400 font-semibold">
        <span>{value} / {max} questions</span>
        <span className="font-black">{pct}%</span>
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
    null,
    { label: "Easy",   cls: "bg-green-100 text-green-700"  },
    { label: "Medium", cls: "bg-yellow-100 text-yellow-700" },
    { label: "Hard",   cls: "bg-red-100 text-red-700"      },
  ];
  const c = cfg[level] ?? cfg[1]!;
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

function ConceptPanel({
  explanation, story, solvedExamples,
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
          <p className="text-xs text-brand-purple font-black uppercase tracking-widest mb-0.5">Concept Explanation</p>
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
                  {ex.steps.map((s, j) => <p key={j} className="text-gray-500 ml-3">→ {s}</p>)}
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

function HintsPanel({ hints }: { hints: string[] }) {
  if (hints.length === 0) return null;
  const styles = ["bg-blue-50 border-blue-200 text-blue-800", "bg-yellow-50 border-yellow-200 text-yellow-800"];
  return (
    <div className="space-y-2">
      {hints.map((text, i) => (
        <div key={i} className={`px-4 py-3 rounded-xl border text-sm font-semibold ${styles[i] ?? styles[1]}`}>
          <span className="font-black">Hint {i + 1}: </span>{text}
        </div>
      ))}
    </div>
  );
}

function ScoreBreakdown({ result }: { result: SubmitAnswerResponse }) {
  const af = result.attempt_factor;
  const hf = result.hint_factor;
  const tf = result.time_factor;

  const factorColor = (v: number, best = 1.0) =>
    v >= best ? "text-green-600" : v >= best * 0.75 ? "text-yellow-500" : "text-red-500";

  const timeLabel = tf > 1.0 ? "fast!" : tf >= 1.0 ? "on time" : tf >= 0.9 ? "slightly slow" : tf >= 0.75 ? "slow" : "very slow";
  const attLabel  = af >= 1.0 ? "1st try" : af >= 0.55 ? "2nd try" : "3rd try";
  const hintLabel = hf >= 1.0 ? "no hints" : hf >= 0.80 ? "1 hint" : hf >= 0.60 ? "2 hints" : "3 hints";

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap text-sm">
        <span className="font-black text-gray-700 text-base">{result.correct ? result.score_earned.toFixed(1) : "0"}</span>
        <span className="text-gray-400">pts</span>
        <span className="text-gray-300 mx-1">=</span>
        <span className="text-gray-500">10</span>
        {[
          { v: af, label: attLabel,  prefix: "attempt" },
          { v: hf, label: hintLabel, prefix: "hints"   },
          { v: tf, label: timeLabel, prefix: "speed"   },
        ].map((b) => (
          <span key={b.prefix} className="flex items-center gap-1">
            <span className="text-gray-300">×</span>
            <span className={`font-black ${factorColor(b.v)}`}>{b.v.toFixed(2)}</span>
            <span className="text-gray-400 text-xs">({b.label})</span>
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { t: "Attempt", v: `×${af.toFixed(2)}`, sub: attLabel,  c: factorColor(af) },
          { t: "Hints",   v: `×${hf.toFixed(2)}`, sub: hintLabel, c: factorColor(hf) },
          { t: "Speed",   v: `×${tf.toFixed(2)}`, sub: timeLabel, c: factorColor(tf, 1.0) },
        ].map((b) => (
          <div key={b.t} className="bg-white rounded-xl p-3 border border-gray-100 text-center">
            <p className={`font-black text-lg ${b.c}`}>{b.v}</p>
            <p className="text-xs font-black text-gray-500 mt-0.5">{b.t}</p>
            <p className="text-xs text-gray-400">{b.sub}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-gray-100">
        <div>
          <p className="text-xs font-black text-gray-400 uppercase tracking-wide">KC Mastery Score</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {result.correct ? "Advanced by correct answer" : "Small decay for wrong answer"}
          </p>
        </div>
        <p className="font-black text-brand-purple text-xl">{result.topic_score.toFixed(1)}%</p>
      </div>
    </div>
  );
}

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

// ── Main quiz component (inner, uses useSearchParams) ─────────────────────

type Phase = "loading" | "concept" | "question" | "feedback" | "remedial" | "complete";

function QuizContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const kcId         = searchParams.get("kc") ?? "kc1";
  const kc           = KC_META[kcId] ?? KC_META["kc1"];
  const colors       = COLOR_MAP[kc.color] ?? COLOR_MAP["purple"];

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

  // Quiz result accumulation
  const [quizResults, setQuizResults]     = useState<{ correct: number; wrong: number; score: number }>({ correct: 0, wrong: 0, score: 0 });

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

  // ── Fetch next question (KC-scoped) ───────────────────────────────────

  const fetchNext = useCallback(async (sid: string, sesId: string) => {
    stopTimer();
    setPhase("loading");
    setSelected(null);
    setResult(null);
    setAutoHints([]);
    setRemedial(null);
    setAttempts(0);
    setErrorMsg("");

    try {
      const res = await getNextQuestion(sesId, sid, kcId);
      if ("status" in res && res.status === "complete") {
        setPhase("complete");
        return;
      }
      const q = res as QuestionResponse;
      setQuestion(q);

      const seen: string[] = JSON.parse(localStorage.getItem(`attempted_concepts_${kcId}`) || "[]");
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
  }, [kcId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const seen: string[] = JSON.parse(localStorage.getItem(`attempted_concepts_${kcId}`) || "[]");
    if (!seen.includes(question.concept_id)) {
      localStorage.setItem(`attempted_concepts_${kcId}`, JSON.stringify([...seen, question.concept_id]));
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
        kcId,  // subtopicId — scopes adaptive logic to this KC
      );

      const newAttempts = attemptsOnQuestion + 1;
      setAttempts(newAttempts);
      setResult(res);

      if (res.correct) {
        setAnswered((n) => n + 1);
        setQuizResults((r) => ({
          correct: r.correct + 1,
          wrong:   r.wrong,
          score:   r.score + res.score_earned,
        }));
        setPhase("feedback");
        return;
      }

      // Wrong
      setQuizResults((r) => ({ ...r, wrong: r.wrong + 1 }));

      if (newAttempts >= 3) {
        // 3rd wrong → reveal hint 2 + remedial
        const newHints = [...autoHints];
        if (newHints.length < 2 && question.hints_available >= 2) {
          try {
            const h = await getHint(sessionId, studentId, question.question_id, 2);
            newHints.push(h.hint_text);
          } catch (_) {}
        }
        setAutoHints(newHints);
        try {
          const rem = await getRemedial(sessionId, studentId, question.question_id);
          setRemedial(rem);
        } catch (_) {}
        setPhase("remedial");
      } else {
        // 2nd wrong → reveal hint 1
        if (newAttempts >= 2 && autoHints.length < 1 && question.hints_available >= 1) {
          try {
            const h = await getHint(sessionId, studentId, question.question_id, 1);
            setAutoHints([h.hint_text]);
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
    const total   = kc.questions;
    const correct = quizResults.correct;
    const pct     = total > 0 ? Math.round((correct / total) * 100) : 0;
    const grade   = pct >= 80 ? { label: "Excellent!", color: "text-green-600" }
                  : pct >= 60 ? { label: "Good work!",  color: "text-blue-600"  }
                  :             { label: "Keep practising", color: "text-orange-600" };

    return (
      <div className="max-w-lg mx-auto py-12 space-y-8">
        <div className="text-center space-y-3">
          <div className={`w-20 h-20 rounded-full ${colors.bg} border-2 ${colors.border} flex items-center justify-center mx-auto`}>
            <span className="font-black text-3xl">{pct}%</span>
          </div>
          <h1 className="text-3xl font-black text-gray-900">Quiz Complete</h1>
          <p className={`font-black text-lg ${grade.color}`}>{grade.label}</p>
          <p className="text-gray-500 text-sm">{kc.name} · {studentId}</p>
        </div>

        {/* Results breakdown */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <p className="text-xs text-gray-400 font-black uppercase tracking-widest">Your Results</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-black text-green-600">{quizResults.correct}</p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">Correct</p>
            </div>
            <div>
              <p className="text-3xl font-black text-red-500">{quizResults.wrong}</p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">Wrong</p>
            </div>
            <div>
              <p className="text-3xl font-black text-brand-purple">{quizResults.score.toFixed(1)}</p>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">Points</p>
            </div>
          </div>
        </div>

        {/* Adaptive feedback */}
        <div className={`${colors.bg} border ${colors.border} rounded-2xl p-5 text-sm`}>
          <p className={`font-black ${colors.text} mb-1`}>Adaptive Feedback</p>
          {pct >= 80 ? (
            <p className="text-gray-600">Great mastery of {kc.name}! The system will now serve you harder questions in this KC during full practice.</p>
          ) : pct >= 60 ? (
            <p className="text-gray-600">You&apos;re getting there with {kc.name}. Review the concept explanations in Lectures, then try again.</p>
          ) : (
            <p className="text-gray-600">This KC needs more work. Go to Lectures to study the concepts, then retake the quiz.</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <button onClick={() => { localStorage.removeItem(`attempted_concepts_${kcId}`); window.location.reload(); }} className="btn-primary w-full">
            Retake Quiz
          </button>
          <button onClick={() => router.push("/chapter")} className="btn-secondary w-full">
            Study Lectures
          </button>
          <button onClick={() => router.push("/learn")} className="btn-secondary w-full">
            Full Practice Mode
          </button>
        </div>
      </div>
    );
  }

  const displayAttempt = attemptsOnQuestion + 1;

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      {/* ── Header bar ──────────────────────────────────────────────────── */}
      <div className={`${colors.bg} border ${colors.border} rounded-2xl px-5 py-4 space-y-3`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-xs font-black uppercase tracking-widest ${colors.text}`}>
              KC Quiz
            </p>
            <p className="font-black text-gray-800">{kc.name}</p>
          </div>
          <TimerDisplay seconds={elapsed} running={phase === "question"} />
        </div>
        <ProgressBar value={answered} max={kc.questions} barClass={colors.bar} />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-semibold">Q {answered + 1} of {kc.questions}</span>
          {question && <DifficultyPill level={question.difficulty} />}
          <AttemptPill attempt={displayAttempt} />
        </div>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
          <p className="font-black text-red-600">Error</p>
          <p className="text-red-500 mt-0.5">{errorMsg}</p>
          <p className="text-xs text-gray-400 mt-1 font-mono">uvicorn main:app --reload --port 8000</p>
        </div>
      )}

      {/* ── Concept phase ────────────────────────────────────────────────── */}
      {phase === "concept" && question && (
        <div className="space-y-4">
          <div className={`${colors.bg} border ${colors.border} rounded-xl px-4 py-3 text-sm`}>
            <span className={`font-black ${colors.text}`}>New concept: </span>
            <span className="text-gray-600">Read the explanation below before attempting.</span>
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
            <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">
              {question.concept_name}
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
                  if (reveal && isCorrect)  cls += "bg-green-50 border-green-400 text-green-800";
                  else if (isSelected)      cls += "bg-red-50 border-red-300 text-red-700";
                  else                      cls += "bg-gray-50 border-gray-200 text-gray-400";
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

          {/* Remedial */}
          {remedial && phase === "remedial" && <RemedialPanel content={remedial} />}

          {/* Buttons */}
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
            {phase === "feedback" && result?.correct && (
              <button onClick={handleNext} className="btn-primary w-full">
                {result.next_action === "complete" ? "Finish Quiz" : "Next Question →"}
              </button>
            )}
            {phase === "feedback" && result && !result.correct && (
              <button onClick={handleTryAgain} className="btn-orange w-full">
                Try Again
              </button>
            )}
            {phase === "remedial" && (
              <button onClick={handleNext} className="btn-primary w-full">
                {result?.next_action === "complete" ? "Finish Quiz" : "Next Question →"}
              </button>
            )}
          </div>

          <div className="text-center">
            <button
              onClick={() => router.push("/chapter")}
              className="text-xs text-gray-400 hover:text-brand-purple underline transition-colors"
            >
              Back to Lectures
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page wrapper with Suspense ─────────────────────────────────────────────

export default function QuizPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <QuizContent />
    </Suspense>
  );
}
