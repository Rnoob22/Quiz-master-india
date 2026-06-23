"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type QuizStatus = "DRAFT" | "LIVE" | "COMPLETED";

interface QuizRow {
  id: string;
  title: string;
  status: QuizStatus;
  startTime: string;
  durationSeconds: number;
  entryFee: number;
  totalPrizePool: number;
  maxParticipants: number;
  collectGst: boolean;
  questionCount: number;
}

const STATUS_STYLES: Record<QuizStatus, string> = {
  DRAFT: "border-white/20 bg-white/5 text-white/70",
  LIVE: "border-[#10B981]/40 bg-[#10B981]/10 text-[#6EE7B7]",
  COMPLETED: "border-[#DC2626]/40 bg-[#DC2626]/10 text-[#FCA5A5]",
};

const formatINR = (n: number): string =>
  `₹${(Math.round((n ?? 0) * 100) / 100).toLocaleString("en-IN")}`;

const AdminQuizzesPage = () => {
  const [quizzes, setQuizzes] = useState<QuizRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/quizzes", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { quizzes: QuizRow[] } = await res.json();
      setQuizzes(data.quizzes ?? []);
    } catch (err) {
      console.error("[AdminQuizzes] load failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load quizzes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateStatus = async (id: string, status: QuizStatus) => {
    if (actionId) return;
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/quizzes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const errBody: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(errBody?.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Status update failed.");
    } finally {
      setActionId(null);
    }
  };

  const deleteQuiz = async (id: string, title: string) => {
    if (actionId) return;
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/quizzes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const errBody: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(errBody?.error ?? `HTTP ${res.status}`);
      }
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold leading-tight">Manage Quizzes</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">{quizzes.length} total</p>
        </div>
        <Link
          href="/admin/quiz-create"
          className="rounded-xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB,#10B981)]"
        >
          <span className="block rounded-xl bg-[#0B0D19] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white hover:bg-[#11142A]">
            + New
          </span>
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[#DC2626]/40 bg-[#DC2626]/10 px-3 py-2 text-xs text-[#FCA5A5]">
          {error}
        </div>
      )}

      {!loading && quizzes.length === 0 && !error && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-4xl">🎨</p>
          <p className="mt-3 text-sm font-bold text-white">No quizzes yet</p>
          <p className="mt-1 text-xs text-white/50">Create your first quiz to get started.</p>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {quizzes.map((q) => (
          <li key={q.id} className="rounded-2xl border border-white/10 bg-[#0F1224] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold text-white">{q.title}</h3>
                <p className="mt-0.5 text-[10px] text-white/40">
                  {new Date(q.startTime).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STATUS_STYLES[q.status]}`}>
                {q.status}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <Meta label="Entry" value={formatINR(q.entryFee)} />
              <Meta label="Pool" value={formatINR(q.totalPrizePool)} />
              <Meta label="Questions" value={String(q.questionCount)} />
              <Meta label="Slots" value={String(q.maxParticipants)} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {q.status !== "LIVE" && (
                <ActionBtn onClick={() => updateStatus(q.id, "LIVE")} disabled={actionId === q.id} color="#10B981">
                  Go Live
                </ActionBtn>
              )}
              {q.status !== "DRAFT" && (
                <ActionBtn onClick={() => updateStatus(q.id, "DRAFT")} disabled={actionId === q.id} color="#F59E0B">
                  Draft
                </ActionBtn>
              )}
              {q.status !== "COMPLETED" && (
                <ActionBtn onClick={() => updateStatus(q.id, "COMPLETED")} disabled={actionId === q.id} color="#2563EB">
                  Complete
                </ActionBtn>
              )}
              <ActionBtn onClick={() => deleteQuiz(q.id, q.title)} disabled={actionId === q.id} color="#DC2626" outline>
                Delete
              </ActionBtn>
              <Link
                href={`/leaderboard?quizId=${q.id}`}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:bg-white/10"
              >
                Board
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

const Meta = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-white/5 bg-white/5 px-2 py-1.5">
    <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
    <p className="text-xs font-bold text-white">{value}</p>
  </div>
);

interface ActionBtnProps {
  onClick: () => void;
  disabled?: boolean;
  color: string;
  outline?: boolean;
  children: React.ReactNode;
}

const ActionBtn = ({ onClick, disabled, color, outline, children }: ActionBtnProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    style={{
      backgroundColor: outline ? "transparent" : `${color}22`,
      borderColor: `${color}55`,
      color,
    }}
  >
    {children}
  </button>
);

export default AdminQuizzesPage;
