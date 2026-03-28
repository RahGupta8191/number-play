"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getRemedial } from "@/lib/api";
import type { RemedialContent } from "@/lib/types";
import { Suspense } from "react";

function RemedialContent_({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [content, setContent] = useState<RemedialContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    const sid  = localStorage.getItem("studentId") || "";
    const sesId = localStorage.getItem("sessionId") || "";
    if (!sid || !sesId) { router.push("/"); return; }

    getRemedial(sesId, sid, questionId)
      .then(setContent)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [questionId, router]);

  if (loading) return <div className="text-center p-12 text-2xl animate-bounce">📚</div>;
  if (error || !content) return <p className="text-red-500 text-center">{error || "Not found."}</p>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-pop">
      <div className="text-center">
        <div className="text-6xl mb-3">📚</div>
        <h1 className="text-3xl font-black text-orange-600">{content.title}</h1>
        <p className="text-gray-400 font-semibold mt-1">Let&apos;s understand this together!</p>
      </div>

      <div className="card border-l-4 border-orange-400">
        <p className="font-bold text-gray-700 mb-2">📖 Explanation</p>
        <p className="text-gray-600 leading-relaxed">{content.explanation}</p>
      </div>

      <div className="card border-l-4 border-blue-400">
        <p className="font-bold text-blue-700 mb-2">📐 The Rule</p>
        <p className="text-gray-600 leading-relaxed">{content.rule}</p>
      </div>

      <div className="card border-l-4 border-yellow-400">
        <p className="font-bold text-yellow-700 mb-2">✏️ Worked Example</p>
        <p className="text-gray-600 leading-relaxed font-mono bg-yellow-50 rounded-lg p-3">
          {content.example}
        </p>
      </div>

      <div className="card border-l-4 border-green-400">
        <p className="font-bold text-green-700 mb-2">✅ Applied to Your Question</p>
        <p className="text-gray-600 leading-relaxed">{content.apply}</p>
      </div>

      <button
        onClick={() => router.push("/learn")}
        className="btn-primary w-full text-lg"
      >
        Got it! Back to Questions ➡️
      </button>
    </div>
  );
}

export default function RemedialPage() {
  return (
    <Suspense fallback={<div className="text-center p-12 text-2xl animate-bounce">📚</div>}>
      <RemedialPageInner />
    </Suspense>
  );
}

function RemedialPageInner() {
  const params = useSearchParams();
  const qid = params.get("qid") || "";
  return <RemedialContent_ questionId={qid} />;
}
