"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

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
  competitionStartTime: string | null;
  competitionEndTime: string | null;
  minParticipantsThreshold: number;
  questionCount: number;
}

const toLocalInput = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const inputStyles =
  "w-full rounded-xl border border-white/10 bg-[#0B0D19] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/40";

const AdminQuizEditPage = () => {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = (params?.id as string) ?? "";

  const [quiz, setQuiz] = useState<QuizRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [form, setForm] = useState<Partial<QuizRow>>({});

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch("/api/admin/quizzes", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        const q: QuizRow | undefined = d?.quizzes?.find((x: QuizRow) => x.id === id);
        if (q) {
          setQuiz(q);
          setForm({
            title: q.title,
            startTime: toLocalInput(q.startTime),
            durationSeconds: q.durationSeconds,
            entryFee: q.entryFee,
            totalPrizePool: q.totalPrizePool,
            maxParticipants: q.maxParticipants,
            collectGst: q.collectGst,
            competitionStartTime: toLocalInput(q.competitionStartTime),
            competitionEndTime: toLocalInput(q.competitionEndTime),
            minParticipantsThreshold: q.minParticipantsThreshold,
          });
        }
        setLoading(false);
      });
  }, [id]);

  const canEdit = quiz?.status === "DRAFT";
  const totals = useMemo(() => {
    const tax = form.collectGst ? Number(form.entryFee ?? 0) * 0.18 : 0;
    return { tax, total: Number(form.entryFee ?? 0) + tax };
  }, [form.entryFee, form.collectGst]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !canEdit) return;
    setBusy(true); setMsg(null);
    try {
      const payload = {
        title: form.title,
        startTime: form.startTime ? new Date(form.startTime as string).toISOString() : undefined,
        durationSeconds: Number(form.durationSeconds),
        entryFee: Number(form.entryFee),
        totalPrizePool: Number(form.totalPrizePool),
        maxParticipants: Number(form.maxParticipants),
        collectGst: form.collectGst === true,
        competitionStartTime: form.competitionStartTime ? new Date(form.competitionStartTime as string).toISOString() : null,
        competitionEndTime: form.competitionEndTime ? new Date(form.competitionEndTime as string).toISOString() : null,
        minParticipantsThreshold: Number(form.minParticipantsThreshold),
      };
      const res = await fetch(`/api/admin/quizzes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setMsg({ ok: true, text: "✅ Quiz details updated." });
      setQuiz((q) => q ? { ...q, ...data.quiz } : q);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" /></div>;
  if (!quiz) return <p className="text-xs text-white/50">Quiz not found.</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Edit Quiz</p>
          <h1 className="truncate text-xl font-extrabold">{quiz.title}</h1>
          <p className="mt-1 text-[10px] uppercase tracking-wider text-white/40">Status: <span className={quiz.status === "DRAFT" ? "text-[#FCD34D]" : "text-[#6EE7B7]"}>{quiz.status}</span> · {quiz.questionCount} question(s)</p>
        </div>
        <Link href="/admin/quizzes" className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:bg-white/10">← All</Link>
      </div>

      {!canEdit && (
        <div className="rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-2 text-[11px] text-[#FCD34D]">
          Quiz fields can only be edited while status is <strong>DRAFT</strong>. Move it back to DRAFT to edit, or only change status.
        </div>
      )}

      <form onSubmit={onSave} className="flex flex-col gap-4">
        <section className="rounded-3xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB,#10B981)]">
          <div className="flex flex-col gap-3 rounded-3xl bg-[#0F1224] p-5">
            <Field label="Title">
              <input className={inputStyles} value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} disabled={!canEdit} />
            </Field>
            <Field label="Start Time">
              <input type="datetime-local" className={`${inputStyles} [color-scheme:dark]`} value={(form.startTime as string) ?? ""} onChange={(e) => setForm({ ...form, startTime: e.target.value })} disabled={!canEdit} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duration (sec)">
                <input type="number" className={inputStyles} value={Number(form.durationSeconds ?? 0)} onChange={(e) => setForm({ ...form, durationSeconds: Number(e.target.value) })} disabled={!canEdit} />
              </Field>
              <Field label="Max Participants">
                <input type="number" className={inputStyles} value={Number(form.maxParticipants ?? 0)} onChange={(e) => setForm({ ...form, maxParticipants: Number(e.target.value) })} disabled={!canEdit} />
              </Field>
              <Field label="Entry Fee (₹)">
                <input type="number" step="0.01" className={inputStyles} value={Number(form.entryFee ?? 0)} onChange={(e) => setForm({ ...form, entryFee: Number(e.target.value) })} disabled={!canEdit} />
              </Field>
              <Field label="Total Prize Pool (₹)">
                <input type="number" step="0.01" className={inputStyles} value={Number(form.totalPrizePool ?? 0)} onChange={(e) => setForm({ ...form, totalPrizePool: Number(e.target.value) })} disabled={!canEdit} />
              </Field>
            </div>
            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#10B981]" checked={form.collectGst === true} onChange={(e) => setForm({ ...form, collectGst: e.target.checked })} disabled={!canEdit} />
              <div className="flex-1">
                <p className="text-xs font-semibold text-white">Collect 18% GST</p>
                <p className="mt-0.5 text-[10px] text-white/50">Players pay ₹{Number(form.entryFee ?? 0).toFixed(2)} + ₹{totals.tax.toFixed(2)} = ₹{totals.total.toFixed(2)}.</p>
              </div>
            </label>
          </div>
        </section>

        <section className="rounded-3xl p-[1.5px] bg-[linear-gradient(135deg,#F59E0B,#DC2626)]">
          <div className="flex flex-col gap-3 rounded-3xl bg-[#0F1224] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/50">Competition Window</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label="Competition Start">
                <input type="datetime-local" className={`${inputStyles} [color-scheme:dark]`} value={(form.competitionStartTime as string) ?? ""} onChange={(e) => setForm({ ...form, competitionStartTime: e.target.value })} disabled={!canEdit} />
              </Field>
              <Field label="Competition End">
                <input type="datetime-local" className={`${inputStyles} [color-scheme:dark]`} value={(form.competitionEndTime as string) ?? ""} onChange={(e) => setForm({ ...form, competitionEndTime: e.target.value })} disabled={!canEdit} />
              </Field>
            </div>
            <Field label="Min Participants Threshold">
              <input type="number" className={inputStyles} value={Number(form.minParticipantsThreshold ?? 1000)} onChange={(e) => setForm({ ...form, minParticipantsThreshold: Number(e.target.value) })} disabled={!canEdit} />
            </Field>
          </div>
        </section>

        {msg && (
          <div className={`rounded-xl border px-3 py-2 text-xs ${msg.ok ? "border-[#10B981]/40 bg-[#10B981]/10 text-[#6EE7B7]" : "border-[#DC2626]/40 bg-[#DC2626]/10 text-[#FCA5A5]"}`}>{msg.text}</div>
        )}

        <div className="flex gap-2">
          <button type="submit" disabled={busy || !canEdit} className="flex-1 rounded-2xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB_0%,#10B981_100%)] disabled:opacity-50">
            <span className="flex w-full items-center justify-center rounded-2xl bg-[#0B0D19] px-5 py-3 text-xs font-extrabold uppercase tracking-[0.25em] text-white hover:bg-[#11142A]">
              {busy ? "Saving…" : "Save changes"}
            </span>
          </button>
          <Link href={`/admin/quizzes/${id}/questions`} className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-xs font-extrabold uppercase tracking-[0.25em] text-white/80 hover:bg-white/10">
            Manage Questions →
          </Link>
        </div>
      </form>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">{label}</span>
    {children}
  </label>
);

export default AdminQuizEditPage;
