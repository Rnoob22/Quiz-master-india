"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import QuestionBulkImporter from "@/components/admin/QuestionBulkImporter";
import type { ParsedQuestion } from "@/lib/parseQuestionsFile";

interface QuestionRow {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  points: number;
  explanation: string | null;
}

interface QuizInfo {
  id: string;
  title: string;
}

const AdminQuestionsPage = () => {
  const params = useParams<{ id: string }>();
  const quizId = (params?.id as string) ?? "";

  const [quiz, setQuiz] = useState<QuizInfo | null>(null);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [info, setInfo] = useState<string | null>(null);

  const load = async () => {
    if (!quizId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quizzes/${quizId}/questions`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const e: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(e?.error ?? `HTTP ${res.status}`);
      }
      const data: { quiz: QuizInfo; questions: QuestionRow[] } = await res.json();
      setQuiz(data.quiz);
      setQuestions(data.questions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [quizId]);

  const importQuestions = async (
    items: ParsedQuestion[],
    mode: "append" | "replace"
  ) => {
    if (items.length === 0) return;
    if (
      mode === "replace" &&
      !confirm(`Replace all ${questions.length} existing questions with ${items.length} new ones?`)
    )
      return;

    setBusy(true);
    setInfo(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quizzes/${quizId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: items, mode }),
      });
      if (!res.ok) {
        const e: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(e?.error ?? `HTTP ${res.status}`);
      }
      const data: { added: number; total: number } = await res.json();
      setInfo(`✅ Added ${data.added} question(s). Quiz now has ${data.total} total.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  const deleteQuestion = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const e: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(e?.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-extrabold leading-tight">
            {quiz?.title ?? "Quiz Questions"}
          </h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            {questions.length} question{questions.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/admin/quizzes"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:bg-white/10"
        >
          ← All Quizzes
        </Link>
      </div>

      {/* Bulk import card */}
      <BulkActions onAppend={(qs) => importQuestions(qs, "append")} onReplace={(qs) => importQuestions(qs, "replace")} busy={busy} />

      {info && (
        <div className="rounded-xl border border-[#10B981]/40 bg-[#10B981]/10 px-3 py-2 text-xs font-medium text-[#6EE7B7]">
          {info}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-[#DC2626]/40 bg-[#DC2626]/10 px-3 py-2 text-xs font-medium text-[#FCA5A5]">
          {error}
        </div>
      )}

      {/* Question list */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      ) : questions.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-4xl">📝</p>
          <p className="mt-3 text-sm font-bold text-white">No questions yet</p>
          <p className="mt-1 text-xs text-white/50">Use the bulk importer above to add them in one go.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {questions.map((q, idx) => (
            <li key={q.id} className="rounded-2xl border border-white/10 bg-[#0F1224] p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="flex-1 text-sm font-semibold leading-snug text-white">
                  <span className="mr-2 text-[10px] uppercase tracking-wider text-white/40">
                    Q{idx + 1}
                  </span>
                  {q.text}
                </p>
                <button
                  type="button"
                  onClick={() => deleteQuestion(q.id)}
                  disabled={busy}
                  className="rounded-lg border border-[#DC2626]/40 bg-[#DC2626]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#FCA5A5] hover:bg-[#DC2626]/20 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
              <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {(["A", "B", "C", "D"] as const).map((k) => {
                  const correct = q.correctAnswer.toUpperCase() === k;
                  return (
                    <li
                      key={k}
                      className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 text-[11px] ${
                        correct
                          ? "border-[#10B981]/40 bg-[#10B981]/10 text-[#6EE7B7]"
                          : "border-white/5 bg-white/5 text-white/80"
                      }`}
                    >
                      <span className="font-bold">{k}.</span>
                      <span className="flex-1">{q[`option${k}` as keyof QuestionRow] as string}</span>
                      {correct && <span>✓</span>}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-white/40">
                <span>Points: {q.points}</span>
                {q.explanation && (
                  <span className="truncate normal-case tracking-normal text-white/50">· {q.explanation}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const BulkActions = ({
  onAppend,
  onReplace,
  busy,
}: {
  onAppend: (qs: ParsedQuestion[]) => void;
  onReplace: (qs: ParsedQuestion[]) => void;
  busy: boolean;
}) => {
  const [mode, setMode] = useState<"append" | "replace">("append");
  return (
    <section className="rounded-3xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB,#10B981)]">
      <div className="flex flex-col gap-3 rounded-3xl bg-[#0F1224] p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
            Bulk Import
          </h2>
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-0.5">
            <button
              type="button"
              onClick={() => setMode("append")}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                mode === "append" ? "bg-white/10 text-white" : "text-white/50"
              }`}
            >
              Append
            </button>
            <button
              type="button"
              onClick={() => setMode("replace")}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                mode === "replace" ? "bg-[#DC2626]/30 text-[#FCA5A5]" : "text-white/50"
              }`}
            >
              Replace
            </button>
          </div>
        </div>

        <QuestionBulkImporter
          mode={mode}
          onImport={(qs) => (mode === "replace" ? onReplace(qs) : onAppend(qs))}
        />

        {busy && (
          <p className="flex items-center gap-2 text-[11px] text-white/60">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            Saving to database…
          </p>
        )}
      </div>
    </section>
  );
};

export default AdminQuestionsPage;
