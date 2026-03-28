"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getMetadata, getLectures } from "@/lib/api";
import type { ChapterMetadata, LectureConcept, LectureResponse } from "@/lib/types";

// ── Concept content viewer ─────────────────────────────────────────────────

function ConceptCard({ concept }: { concept: LectureConcept }) {
  const [open, setOpen] = useState(false);
  const exp = concept.explanation;
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition text-left"
      >
        <div>
          <p className="font-black text-gray-800">{concept.name}</p>
          {exp && (
            <p className="text-xs text-gray-400 mt-0.5 font-semibold">{exp.title}</p>
          )}
        </div>
        <span className="text-gray-400 font-black text-sm ml-4 shrink-0">{open ? "Hide ▲" : "Study ▼"}</span>
      </button>

      {open && exp && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 bg-white">
          {/* Explanation */}
          <div className="pt-4">
            <p className="text-gray-700 leading-relaxed whitespace-pre-line text-sm">{exp.body}</p>
            <div className="mt-3 bg-purple-50 border border-purple-100 rounded-xl p-3 text-sm">
              <span className="font-black text-brand-purple">Key Idea: </span>
              <span className="text-gray-700">{exp.key_idea}</span>
            </div>
          </div>

          {/* Story example */}
          {concept.story_example && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm">
              <p className="font-black text-amber-700 mb-1">{concept.story_example.title}</p>
              <p className="text-gray-600 leading-relaxed">{concept.story_example.body}</p>
            </div>
          )}

          {/* Solved examples */}
          {concept.solved_examples && concept.solved_examples.length > 0 && (
            <div className="space-y-3">
              <p className="font-black text-gray-600 text-sm">Worked Examples</p>
              {concept.solved_examples.map((ex, i) => (
                <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm">
                  <p className="font-semibold text-gray-700 mb-2">{ex.question}</p>
                  <div className="space-y-1 mb-2">
                    {ex.steps.map((s, j) => (
                      <p key={j} className="text-gray-500 ml-3">→ {s}</p>
                    ))}
                  </div>
                  <p className="font-black text-green-700">Answer: {ex.answer}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── KC lecture panel ───────────────────────────────────────────────────────

function KCLecture({ subtopicId }: { subtopicId: string; subtopicName: string }) {
  const [lecture, setLecture]   = useState<LectureResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    getLectures(subtopicId)
      .then(setLecture)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load lecture."))
      .finally(() => setLoading(false));
  }, [subtopicId]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-8 text-gray-400">
        <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
        <span className="font-semibold text-sm">Loading concepts…</span>
      </div>
    );
  }

  if (error || !lecture) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm font-semibold">
        {error || "Could not load lecture content."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-black text-gray-800">{lecture.subtopic_name}</h2>
        <p className="text-sm text-gray-500 mt-1">{lecture.description}</p>
      </div>
      <div className="space-y-3">
        {lecture.concepts.map((c) => (
          <ConceptCard key={c.id} concept={c} />
        ))}
      </div>
    </div>
  );
}

// ── KC Sidebar item ────────────────────────────────────────────────────────

const KC_COLORS: Record<string, string> = {
  kc1: "bg-purple-100 text-purple-700 border-purple-200",
  kc2: "bg-pink-100   text-pink-700   border-pink-200",
  kc3: "bg-blue-100   text-blue-700   border-blue-200",
  kc4: "bg-green-100  text-green-700  border-green-200",
  kc5: "bg-orange-100 text-orange-700 border-orange-200",
};

// ── Inner page content (requires useSearchParams) ──────────────────────────

function ChapterContent() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const kcParam     = searchParams.get("kc");

  const [metadata, setMetadata] = useState<ChapterMetadata | null>(null);
  const [activeKC, setActiveKC] = useState<string>("");
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  useEffect(() => {
    const sid = localStorage.getItem("studentId") || "";
    if (!sid) { router.push("/"); return; }

    getMetadata()
      .then((data) => {
        setMetadata(data);
        // Set active KC from URL param or first KC
        const firstId = data.subtopics[0]?.id ?? "kc1";
        setActiveKC(kcParam ?? firstId);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load chapter."))
      .finally(() => setLoading(false));
  }, [router, kcParam]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] gap-3">
        <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
        <span className="text-gray-400 font-semibold">Loading chapter…</span>
      </div>
    );
  }

  if (error || !metadata) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-red-500 font-bold">{error || "Could not load chapter."}</p>
        <p className="text-gray-400 text-sm">Check that the backend server is running on port 8000.</p>
        <button onClick={() => router.push("/")} className="btn-secondary mt-2">Back to Home</button>
      </div>
    );
  }

  const activeSubtopic = metadata.subtopics.find((s) => s.id === activeKC);

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs text-gray-400 font-black uppercase tracking-widest mb-1">
            {metadata.chapter_name} · Grade {metadata.grade}
          </p>
          <h1 className="text-3xl font-black text-gray-900">Lectures</h1>
          <p className="text-gray-500 text-sm mt-1">Study each concept before practising questions.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push("/learn")} className="btn-primary text-sm">
            Start Practice
          </button>
          <button onClick={() => router.push("/dashboard")} className="btn-secondary text-sm">
            My Progress
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">

        {/* ── KC sidebar ──────────────────────────────────────────────────── */}
        <div className="md:w-56 shrink-0 space-y-2">
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
            Knowledge Components
          </p>
          {metadata.subtopics.map((st, i) => {
            const colorCls = KC_COLORS[st.id] ?? KC_COLORS["kc1"];
            const isActive = st.id === activeKC;
            return (
              <button
                key={st.id}
                onClick={() => {
                  setActiveKC(st.id);
                  router.push(`/chapter?kc=${st.id}`, { scroll: false });
                }}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all
                  ${isActive
                    ? `${colorCls} shadow-sm`
                    : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
              >
                <span className="font-black text-xs block mb-0.5 opacity-60">KC{i + 1}</span>
                {st.name}
              </button>
            );
          })}
        </div>

        {/* ── Concept content ─────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {activeKC && activeSubtopic ? (
            <KCLecture
              key={activeKC}
              subtopicId={activeKC}
              subtopicName={activeSubtopic.name}
            />
          ) : (
            <p className="text-gray-400 text-sm">Select a knowledge component to view its lecture.</p>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="font-black text-gray-800">Ready to test your knowledge?</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Take a focused quiz on this KC, or jump into full adaptive practice.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          {activeKC && (
            <button
              onClick={() => router.push(`/quiz?kc=${activeKC}`)}
              className="btn-secondary text-sm"
            >
              Quiz this KC
            </button>
          )}
          <button onClick={() => router.push("/learn")} className="btn-primary text-sm">
            Full Practice
          </button>
        </div>
      </div>

    </div>
  );
}

// ── Page wrapper ───────────────────────────────────────────────────────────

export default function ChapterPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ChapterContent />
    </Suspense>
  );
}
