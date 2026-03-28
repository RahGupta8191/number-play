"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { startSession } from "@/lib/api";

const KCS = [
  {
    id: "kc1",
    name: "Number Patterns",
    description: "Identify and extend patterns in sequences of numbers.",
    concepts: ["Identifying arithmetic patterns", "Extending number sequences", "Pattern rules and formulas"],
  },
  {
    id: "kc2",
    name: "Odd and Even Numbers",
    description: "Properties of odd and even numbers and their applications.",
    concepts: ["Properties of odd and even numbers", "Operations with odd and even numbers", "Counting odd and even numbers in a range"],
  },
  {
    id: "kc3",
    name: "Divisibility Rules",
    description: "Quick tests to determine if a number is divisible by another.",
    concepts: ["Divisibility by 2, 3, and 5", "Divisibility by 4, 6, and 9", "Divisibility by 7, 11, and 12"],
  },
  {
    id: "kc4",
    name: "Number Sequences",
    description: "Arithmetic and geometric sequences and their properties.",
    concepts: ["Arithmetic sequences", "Geometric sequences", "Mixed and complex sequences"],
  },
  {
    id: "kc5",
    name: "Logical Number Puzzles",
    description: "Apply logical reasoning to solve number-based puzzles.",
    concepts: ["Age and relationship puzzles", "Missing number puzzles", "Working backwards with inverse operations"],
  },
];

export default function HomePage() {
  const router = useRouter();

  const [name, setName]             = useState("");
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [returning, setReturning]   = useState<string | null>(null); // studentId

  useEffect(() => {
    const sid = localStorage.getItem("studentId") || "";
    const ses = localStorage.getItem("sessionId") || "";
    if (sid && ses) setReturning(sid);
    if (sid) setName(sid);
  }, []);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError("Please enter your name."); return; }

    setLoading(true);
    setError("");
    try {
      const res = await startSession(trimmed);
      localStorage.setItem("studentId", res.student_id);
      localStorage.setItem("sessionId", res.session_id);
      localStorage.setItem("chapterId", res.chapter_id);
      localStorage.removeItem("attempted_concepts");
      router.push("/chapter");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not connect. Is the backend running on port 8000?");
    } finally {
      setLoading(false);
    }
  }

  function handleNewSession() {
    setReturning(null);
    setName("");
    ["studentId", "sessionId", "chapterId", "attempted_concepts"].forEach((k) =>
      localStorage.removeItem(k)
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-16 py-4">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="text-center space-y-4">
        <div className="inline-block bg-purple-100 text-brand-purple text-xs font-black px-4 py-1 rounded-full uppercase tracking-widest mb-2">
          Grade 7 · Number Play
        </div>
        <h1 className="text-5xl font-black text-gray-900 leading-tight">
          Adaptive Tutoring System
        </h1>
        <p className="text-gray-500 text-lg max-w-xl mx-auto leading-relaxed">
          Master number patterns, divisibility, sequences and logical puzzles — the system
          adapts to your pace and fills knowledge gaps as you go.
        </p>
      </div>

      {/* ── Returning student ──────────────────────────────────────────────── */}
      {returning && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <p className="text-sm text-gray-400 font-semibold mb-1">Welcome back</p>
          <h2 className="text-2xl font-black text-gray-800 mb-4">{returning}</h2>
          <p className="text-sm text-gray-500 mb-5">Your progress has been saved. Pick up where you left off.</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => router.push("/learn")}
              className="btn-primary flex-1"
            >
              Continue Practice
            </button>
            <button
              onClick={() => router.push("/chapter")}
              className="btn-secondary flex-1"
            >
              Go to Lectures
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="btn-secondary flex-1"
            >
              View Progress
            </button>
          </div>
          <button
            onClick={handleNewSession}
            className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline w-full text-center block"
          >
            Start a new session as a different student
          </button>
        </div>
      )}

      {/* ── Login form ─────────────────────────────────────────────────────── */}
      {!returning && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm max-w-md mx-auto">
          <h2 className="text-2xl font-black text-gray-800 mb-2">Get Started</h2>
          <p className="text-sm text-gray-400 mb-6">Enter your name to begin or resume your session.</p>
          <form onSubmit={handleStart} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(""); }}
                placeholder="e.g. Rahul"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base font-semibold
                           focus:outline-none focus:border-brand-purple focus:ring-2 focus:ring-purple-100 transition"
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-sm font-semibold">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? "Starting…" : "Start Learning"}
            </button>
          </form>
        </div>
      )}

      {/* ── Knowledge Components ───────────────────────────────────────────── */}
      <div className="space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-800">Knowledge Components</h2>
            <p className="text-gray-400 text-sm mt-1">Click any component to study its concepts</p>
          </div>
          <span className="text-xs text-gray-400 font-semibold hidden sm:block">5 KCs · 15 concepts · 45 questions</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {KCS.map((kc, i) => (
            <div
              key={kc.id}
              className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-xs font-black text-brand-purple uppercase tracking-wide">KC{i + 1}</span>
                  <h3 className="font-black text-gray-800 text-base mt-0.5">{kc.name}</h3>
                </div>
                <span className="text-xs text-gray-400 font-semibold">9 questions</span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed mb-3">{kc.description}</p>
              <div className="space-y-1 mb-4">
                {kc.concepts.map((c, ci) => (
                  <p key={ci} className="text-xs text-gray-400 font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                    {c}
                  </p>
                ))}
              </div>
              {/* Actions */}
              <div className="flex gap-2 border-t border-gray-100 pt-3">
                <button
                  onClick={() => router.push(`/chapter?kc=${kc.id}`)}
                  className="flex-1 text-xs font-black text-brand-purple border border-brand-purple rounded-lg py-2 hover:bg-purple-50 transition"
                >
                  Study
                </button>
                <button
                  onClick={() => router.push(`/quiz?kc=${kc.id}`)}
                  className="flex-1 text-xs font-black text-white bg-brand-purple rounded-lg py-2 hover:bg-purple-700 transition"
                >
                  Take Quiz
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── How scoring works ──────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-8">
        <h2 className="text-xl font-black text-gray-800 mb-2">How Scoring Works</h2>
        <p className="text-sm text-gray-500 mb-6">
          Every question has a base of <strong>10 points</strong>. Three multipliers determine your actual score.
          Answer correctly on the <strong>first attempt, with no hints, quickly</strong> for maximum points.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            {
              label: "Attempt Factor",
              rows: [
                ["1st attempt", "×1.00"],
                ["2nd attempt", "×0.55"],
                ["3rd attempt", "×0.25"],
              ],
              tip: "The steepest factor — thinking before answering is rewarded most.",
            },
            {
              label: "Hint Factor",
              rows: [
                ["0 hints", "×1.00"],
                ["1 hint",  "×0.80"],
                ["2 hints", "×0.60"],
                ["3 hints", "×0.40"],
              ],
              tip: "Each hint significantly reduces your score. Try without hints first.",
            },
            {
              label: "Speed Factor",
              rows: [
                ["Fast (< 75% of limit)", "×1.10"],
                ["On time",               "×1.00"],
                ["Slightly slow",         "×0.90"],
                ["Slow",                  "×0.75"],
                ["Very slow",             "×0.55"],
              ],
              tip: "Answer quickly for a 10% speed bonus. Slow answers are penalised.",
            },
          ].map((block) => (
            <div key={block.label} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="font-black text-gray-700 text-sm mb-3">{block.label}</p>
              <div className="space-y-1.5">
                {block.rows.map(([cond, val]) => (
                  <div key={cond} className="flex justify-between text-xs font-semibold gap-2">
                    <span className="text-gray-500">{cond}</span>
                    <span className="text-brand-purple font-black shrink-0">{val}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-400 leading-relaxed border-t border-gray-200 pt-2">{block.tip}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-sm">
            <p className="font-black text-brand-purple mb-1">Best possible</p>
            <p className="text-gray-600">10 × 1.00 × 1.00 × 1.10 = <strong>10 pts</strong></p>
            <p className="text-xs text-gray-400 mt-1">1st attempt · no hints · fast answer</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-sm">
            <p className="font-black text-red-600 mb-1">Worst possible (but still correct)</p>
            <p className="text-gray-600">10 × 0.25 × 0.40 × 0.55 = <strong>0.55 pts</strong></p>
            <p className="text-xs text-gray-400 mt-1">3rd attempt · 3 hints · very slow</p>
          </div>
        </div>
      </div>

    </div>
  );
}
