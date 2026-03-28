"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDashboard } from "@/lib/api";
import type { DashboardResponse } from "@/lib/types";

const KC_META: Record<string, { name: string; bar: string; text: string }> = {
  kc1: { name: "Number Patterns",    bar: "bg-purple-500", text: "text-purple-600" },
  kc2: { name: "Odd & Even Numbers", bar: "bg-pink-500",   text: "text-pink-600"   },
  kc3: { name: "Divisibility Rules", bar: "bg-blue-500",   text: "text-blue-600"   },
  kc4: { name: "Number Sequences",   bar: "bg-green-500",  text: "text-green-600"  },
  kc5: { name: "Logical Puzzles",    bar: "bg-orange-500", text: "text-orange-600" },
};

function ScoreBar({ score, barColor }: { score: number; barColor: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
      <div
        className={`h-3 rounded-full ${barColor} transition-all duration-700`}
        style={{ width: `${Math.min(score, 100)}%` }}
      />
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData]       = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    const sid   = localStorage.getItem("studentId") || "";
    const sesId = localStorage.getItem("sessionId") || "";
    if (!sid || !sesId) { router.push("/"); return; }

    getDashboard(sesId, sid)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load dashboard."))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] gap-3">
        <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-400 font-semibold">Loading results…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-red-500 font-bold">{error || "Could not load dashboard."}</p>
        <p className="text-gray-400 text-sm">Make sure the backend server is running.</p>
        <button onClick={() => router.push("/")} className="btn-secondary mt-2">Back to Home</button>
      </div>
    );
  }

  const accuracy = data.total_attempted > 0
    ? Math.round((data.total_correct / data.total_attempted) * 100)
    : 0;

  const levelLabels = ["", "Beginner", "Intermediate", "Advanced"];

  return (
    <div className="max-w-3xl mx-auto space-y-8">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">Progress Report</p>
        <h1 className="text-3xl font-black text-gray-900">
          {data.student_id}
        </h1>
        <p className="text-gray-400 text-sm mt-1 font-semibold">
          Level {data.current_level} — {levelLabels[data.current_level] ?? "Learner"}
        </p>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Attempted",  value: data.total_attempted,               sub: "questions"  },
          { label: "Correct",    value: data.total_correct,                 sub: "answers"    },
          { label: "Accuracy",   value: `${accuracy}%`,                     sub: "overall"    },
          { label: "Hints Used", value: data.total_hints_used,              sub: "total"      },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-4 text-center">
            <p className="text-3xl font-black text-brand-purple">{s.value}</p>
            <p className="text-gray-700 font-black text-sm mt-0.5">{s.label}</p>
            <p className="text-gray-400 text-xs font-semibold">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Overall score ───────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 flex items-center justify-between gap-6">
        <div>
          <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">Overall Score</p>
          <p className="text-5xl font-black text-brand-purple">{data.overall_score.toFixed(1)}</p>
          <p className="text-gray-400 text-sm font-semibold mt-1">out of 100</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">Level</p>
          <p className="text-xl font-black text-gray-800">{levelLabels[data.current_level] ?? "Learner"}</p>
          <p className="text-xs text-gray-400 mt-1">
            {data.current_level < 3 ? "Keep improving to advance" : "Top level reached!"}
          </p>
        </div>
      </div>

      {/* ── KC Scores ───────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-5">Knowledge Component Scores</p>
        <div className="space-y-5">
          {Object.entries(KC_META).map(([id, meta]) => {
            const score = data.topic_scores[id] ?? 0;
            const status = score < 50 ? "Needs practice" : score < 80 ? "Getting there" : "Mastered";
            const statusColor = score < 50 ? "text-red-400" : score < 80 ? "text-yellow-500" : "text-green-600";
            return (
              <div key={id} className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className={`font-black text-sm ${meta.text}`}>{meta.name}</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold ${statusColor}`}>{status}</span>
                    <span className={`font-black tabular-nums text-sm ${meta.text}`}>{score.toFixed(1)}%</span>
                  </div>
                </div>
                <ScoreBar score={score} barColor={meta.bar} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Badges ──────────────────────────────────────────────────────── */}
      {data.badges.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-4">Achievements</p>
          <div className="flex flex-wrap gap-2">
            {data.badges.map((b) => (
              <span key={b} className="px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-full font-semibold text-yellow-800 text-sm">
                {b}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent activity ─────────────────────────────────────────────── */}
      {data.recent_attempts.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-4">Recent Activity</p>
          <div className="space-y-2">
            {data.recent_attempts.map((a, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl text-sm border
                  ${a.correctness ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}
              >
                <span className={`font-black text-xs shrink-0 ${a.correctness ? "text-green-600" : "text-red-500"}`}>
                  {a.correctness ? "CORRECT" : "WRONG"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-500 text-xs font-semibold truncate">
                    Attempt {a.attempts} · {a.hints_used} hint{a.hints_used !== 1 ? "s" : ""} · {a.time_taken}s
                  </p>
                </div>
                <span className={`font-black text-sm shrink-0 ${a.correctness ? "text-green-600" : "text-gray-400"}`}>
                  {a.score_earned > 0 ? `+${a.score_earned}` : "0"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Actions ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 pb-4">
        <button onClick={() => router.push("/learn")} className="btn-primary flex-1">
          Continue Practice
        </button>
        <button onClick={() => router.push("/chapter")} className="btn-secondary flex-1">
          Go to Lectures
        </button>
      </div>

    </div>
  );
}
