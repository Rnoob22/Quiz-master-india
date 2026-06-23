"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

type OptionKey = "A" | "B" | "C" | "D";
type QuizStatus = "DRAFT" | "LIVE" | "COMPLETED";

interface QuestionDraft {
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: OptionKey;
  points: number;
  explanation: string;
}

interface QuizForm {
  title: string;
  startTime: string; // datetime-local string
  durationSeconds: number;
  entryFee: number;
  totalPrizePool: number;
  maxParticipants: number;
  collectGst: boolean;
  status: QuizStatus;
}

const emptyQuestion = (): QuestionDraft => ({
  text: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctAnswer: "A",
  points: 1,
  explanation: "",
});

const DEFAULT_FORM: QuizForm = {
  title: "",
  startTime: "",
  durationSeconds: 300,
  entryFee: 49,
  totalPrizePool: 5000,
  maxParticipants: 500,
  collectGst: false,
  status: "DRAFT",
};

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

const AdminQuizCreatePage = () => {
  const { status } = useSession();
  const router = useRouter();

  const [form, setForm] = useState<QuizForm>(DEFAULT_FORM);
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  /* ---------------- Derived totals ---------------- */
  const totals = useMemo(() => {
    const tax = form.collectGst ? form.entryFee * 0.18 : 0;
    return {
      tax: Math.round(tax * 100) / 100,
      total: Math.round((form.entryFee + tax) * 100) / 100,
    };
  }, [form.entryFee, form.collectGst]);

  /* ---------------- Mutators ---------------- */
  const updateForm = <K extends keyof QuizForm>(key: K, value: QuizForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateQuestion = <K extends keyof QuestionDraft>(
    idx: number,
    key: K,
    value: QuestionDraft[K]
  ) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  };

  const addQuestion = () => setQuestions((prev) => [...prev, emptyQuestion()]);
  const removeQuestion = (idx: number) =>
    setQuestions((prev) => prev.filter((_, i) => i !== idx));

  const importQuestions = (items: ParsedQuestion[]) => {
    if (items.length === 0) return;
    setQuestions((prev) => {
      // If the form has only the single empty placeholder row, replace it.
      const onlyEmpty =
        prev.length === 1 &&
        !prev[0].text.trim() &&
        !prev[0].optionA.trim() &&
        !prev[0].optionB.trim() &&
        !prev[0].optionC.trim() &&
        !prev[0].optionD.trim();
      const base = onlyEmpty ? [] : prev;
      return [
        ...base,
        ...items.map<QuestionDraft>((q) => ({
          text: q.text,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctAnswer: q.correctAnswer,
          points: q.points,
          explanation: q.explanation,
        })),
      ];
    });
  };

  /* ---------------- Submit ---------------- */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setSuccess(null);

    if (!form.title.trim() || form.title.trim().length < 3) {
      setError("Title must be at least 3 characters.");
      return;
    }
    if (!form.startTime) {
      setError("Start time is required.");
      return;
    }
    if (questions.length === 0) {
      setError("Add at least one question.");
      return;
    }
    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i];
      if (
        !q.text.trim() ||
        !q.optionA.trim() ||
        !q.optionB.trim() ||
        !q.optionC.trim() ||
        !q.optionD.trim()
      ) {
        setError(`Question ${i + 1} is incomplete.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          startTime: new Date(form.startTime).toISOString(),
          durationSeconds: Number(form.durationSeconds),
          entryFee: Number(form.entryFee),
          totalPrizePool: Number(form.totalPrizePool),
          maxParticipants: Number(form.maxParticipants),
          collectGst: form.collectGst,
          status: form.status,
          questions: questions.map((q) => ({
            text: q.text.trim(),
            optionA: q.optionA.trim(),
            optionB: q.optionB.trim(),
            optionC: q.optionC.trim(),
            optionD: q.optionD.trim(),
            correctAnswer: q.correctAnswer,
            points: Math.max(1, Number(q.points) || 1),
            explanation: q.explanation.trim() || null,
          })),
        }),
      });

      if (!res.ok) {
        const errBody: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(errBody?.error ?? `Request failed (HTTP ${res.status}).`);
      }

      const created: { id: string; title: string } = await res.json();
      setSuccess(`Quiz "${created.title}" created successfully.`);
      setForm(DEFAULT_FORM);
      setQuestions([emptyQuestion()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quiz.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- Render ---------------- */
  if (status === "loading") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#0B0D19]">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#0B0D19] pb-10 text-white">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[#2563EB] opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-32 -right-10 h-56 w-56 rounded-full bg-[#F59E0B] opacity-15 blur-3xl" />

      {/* HEADER */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-6">
        <div>
          <h1 className="text-xl font-extrabold leading-tight tracking-tight">
            <span className="text-[#2563EB]">Admin</span>{" "}
            <span className="bg-[linear-gradient(135deg,#DC2626,#F59E0B,#10B981)] bg-clip-text text-transparent">
              Console
            </span>
          </h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/40">
            Create New Quiz
          </p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/70 hover:bg-white/10"
        >
          Exit
        </Link>
      </header>

      {/* FORM */}
      <form onSubmit={handleSubmit} className="relative z-10 mt-6 flex flex-col gap-5 px-5">
        {/* Quiz Config */}
        <section className="rounded-3xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB_0%,#DC2626_33%,#F59E0B_66%,#10B981_100%)]">
          <div className="flex flex-col gap-4 rounded-3xl bg-[#0F1224] p-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
              Quiz Details
            </h2>

            <Field label="Title">
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateForm("title", e.target.value)}
                placeholder="e.g. Friday Night Brainstorm"
                className={inputStyles}
                required
              />
            </Field>

            <Field label="Start Time">
              <input
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => updateForm("startTime", e.target.value)}
                className={`${inputStyles} [color-scheme:dark]`}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Duration (sec)">
                <input
                  type="number"
                  min={10}
                  value={form.durationSeconds}
                  onChange={(e) => updateForm("durationSeconds", Number(e.target.value))}
                  className={inputStyles}
                />
              </Field>
              <Field label="Max Participants">
                <input
                  type="number"
                  min={1}
                  value={form.maxParticipants}
                  onChange={(e) => updateForm("maxParticipants", Number(e.target.value))}
                  className={inputStyles}
                />
              </Field>
              <Field label="Entry Fee (₹)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.entryFee}
                  onChange={(e) => updateForm("entryFee", Number(e.target.value))}
                  className={inputStyles}
                />
              </Field>
              <Field label="Total Prize Pool (₹)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.totalPrizePool}
                  onChange={(e) => updateForm("totalPrizePool", Number(e.target.value))}
                  className={inputStyles}
                />
              </Field>
            </div>

            <Field label="Initial Status">
              <select
                value={form.status}
                onChange={(e) => updateForm("status", e.target.value as QuizStatus)}
                className={inputStyles}
              >
                <option value="DRAFT" className="bg-[#0B0D19]">DRAFT</option>
                <option value="LIVE" className="bg-[#0B0D19]">LIVE</option>
                <option value="COMPLETED" className="bg-[#0B0D19]">COMPLETED</option>
              </select>
            </Field>

            {/* GST Toggle */}
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/10">
              <input
                type="checkbox"
                checked={form.collectGst}
                onChange={(e) => updateForm("collectGst", e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[#10B981]"
              />
              <div className="flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-white">
                  Collect 18% Additional GST from Participants
                </p>
                <p className="mt-1 text-[11px] text-white/50">
                  When enabled, players pay ₹{form.entryFee.toFixed(2)} + ₹
                  {totals.tax.toFixed(2)} (GST) = ₹{totals.total.toFixed(2)} at checkout.
                </p>
              </div>
            </label>
          </div>
        </section>

        {/* Questions */}
        <section className="rounded-3xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB,#10B981)]">
          <div className="flex flex-col gap-4 rounded-3xl bg-[#0F1224] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
                Questions ({questions.length})
              </h2>
              <button
                type="button"
                onClick={addQuestion}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/80 hover:bg-white/10"
              >
                + Add
              </button>
            </div>

            <QuestionBulkImporter onImport={importQuestions} />


            {questions.map((q, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-white/10 bg-[#0B0D19] p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">
                    Question {idx + 1}
                  </span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(idx)}
                      className="text-[11px] font-semibold uppercase tracking-wider text-[#FCA5A5] hover:text-[#DC2626]"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-3">
                  <Field label="Question Text">
                    <textarea
                      rows={2}
                      value={q.text}
                      onChange={(e) => updateQuestion(idx, "text", e.target.value)}
                      className={`${inputStyles} resize-none`}
                    />
                  </Field>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(["A", "B", "C", "D"] as OptionKey[]).map((k) => (
                      <Field key={k} label={`Option ${k}`}>
                        <input
                          type="text"
                          value={q[`option${k}` as keyof QuestionDraft] as string}
                          onChange={(e) =>
                            updateQuestion(
                              idx,
                              `option${k}` as keyof QuestionDraft,
                              e.target.value as never
                            )
                          }
                          className={inputStyles}
                        />
                      </Field>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Correct Answer">
                      <select
                        value={q.correctAnswer}
                        onChange={(e) =>
                          updateQuestion(idx, "correctAnswer", e.target.value as OptionKey)
                        }
                        className={inputStyles}
                      >
                        {(["A", "B", "C", "D"] as OptionKey[]).map((k) => (
                          <option key={k} value={k} className="bg-[#0B0D19]">
                            {k}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Points">
                      <input
                        type="number"
                        min={1}
                        value={q.points}
                        onChange={(e) =>
                          updateQuestion(idx, "points", Math.max(1, Number(e.target.value) || 1))
                        }
                        className={inputStyles}
                      />
                    </Field>
                  </div>

                  <Field label="Explanation (optional)">
                    <input
                      type="text"
                      value={q.explanation}
                      onChange={(e) =>
                        updateQuestion(idx, "explanation", e.target.value)
                      }
                      className={inputStyles}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Status messages */}
        {error && (
          <div className="rounded-xl border border-[#DC2626]/40 bg-[#DC2626]/10 px-4 py-3 text-xs font-medium text-[#FCA5A5]">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-[#10B981]/40 bg-[#10B981]/10 px-4 py-3 text-xs font-medium text-[#6EE7B7]">
            {success}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="group relative w-full overflow-hidden rounded-2xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB_0%,#DC2626_33%,#F59E0B_66%,#10B981_100%)] shadow-[0_10px_40px_-10px_rgba(37,99,235,0.6)] transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#0B0D19] px-5 py-4 text-sm font-extrabold uppercase tracking-[0.25em] text-white transition-colors duration-150 group-hover:bg-[#11142A]">
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span>Creating Quiz…</span>
              </>
            ) : (
              <span>Publish Quiz</span>
            )}
          </span>
        </button>
      </form>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  SUB COMPONENTS                                                     */
/* ------------------------------------------------------------------ */

const inputStyles =
  "w-full rounded-xl border border-white/10 bg-[#0B0D19] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/40";

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
      {label}
    </span>
    {children}
  </label>
);

export default AdminQuizCreatePage;
