"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

type OptionKey = "A" | "B" | "C" | "D";

interface QuizQuestion {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  points: number;
  correctAnswer?: OptionKey | string; // present only if backend trusts us; we don't rely on it client-side
}

interface QuizMeta {
  id: string;
  title: string;
  durationSeconds: number;
  startTime?: string;
}

interface QuizPayload {
  quiz: QuizMeta;
  questions: QuizQuestion[];
}

/* ------------------------------------------------------------------ */
/*  GATE DEFAULTS                                                      */
/* ------------------------------------------------------------------ */
//
// IMPORTANT: There are NO fallback / preview questions on this page. Until
// the server-gated /api/quiz/[id] endpoint returns a 200 (which it only
// does after verifying an unconsumed SUCCESS payment for paid quizzes),
// this page must NEVER render playable content. The previous fallback
// constants were the root cause of a payment bypass — do not reintroduce
// them.

const EMPTY_META: QuizMeta = {
  id: "",
  title: "",
  durationSeconds: 0,
};

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

const QuizArenaPage = () => {
  const params = useParams<{ id: string }>();
  const quizId = (params?.id as string) ?? "";
  const router = useRouter();
  const { status: authStatus } = useSession();

  /* ---------------- State ---------------- */
  const [loading, setLoading] = useState<boolean>(true);
  const [meta, setMeta] = useState<QuizMeta>(EMPTY_META);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [denied, setDenied] = useState<{
    message: string;
    code: string;
  } | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<OptionKey | null>(null);
  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [score, setScore] = useState<number>(0);
  const [incorrectCount, setIncorrectCount] = useState<number>(0);
  const [remaining, setRemaining] = useState<number>(0);
  const [cheated, setCheated] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /* ---------------- Refs ---------------- */
  const startedAtRef = useRef<number>(Date.now());
  const submittedRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef({ score: 0, incorrectCount: 0, cheated: false });
  stateRef.current = { score, incorrectCount, cheated };

  /* ---------------- Auth Guard ---------------- */
  useEffect(() => {
    if (authStatus === "unauthenticated") router.replace("/login");
  }, [authStatus, router]);

  /* ---------------- Load Quiz Payload (STRICT DENY-BY-DEFAULT) ---------------- */
  useEffect(() => {
    if (!quizId) return;
    let active = true;

    const denyAndRedirect = (
      message: string,
      code: string,
      target: "result" | "dashboard"
    ) => {
      if (!active) return;
      setDenied({ message, code });
      setLoading(false);
      if (typeof window !== "undefined") {
        // Use a microtask-deferred alert so the deny screen flashes first.
        setTimeout(() => {
          try {
            window.alert(message);
          } catch {
            /* ignore */
          }
          if (target === "result") {
            router.replace(`/quiz/${encodeURIComponent(quizId)}/result`);
          } else {
            router.replace("/dashboard");
          }
        }, 50);
      }
    };

    const load = async () => {
      setLoading(true);
      try {
        // ---- 1) Pre-flight entry gate ----
        // Default to DENY. We only proceed if the gate explicitly returns
        // 200 + canPlay:true. Any 4xx/5xx, network error, or canPlay:false
        // blocks the user and redirects them out.
        let gateOk = false;
        let gateCode = "unknown";
        let gateMsg = "Entry verification failed.";
        let submissionId: string | null = null;
        try {
          const gateRes = await fetch(
            `/api/quiz/${encodeURIComponent(quizId)}/entry-check`,
            { cache: "no-store" }
          );
          if (gateRes.ok) {
            const gate: {
              canPlay: boolean;
              reason: string;
              submissionId: string | null;
              message: string;
            } = await gateRes.json();
            gateOk = !!gate.canPlay;
            gateCode = gate.reason || gateCode;
            gateMsg = gate.message || gateMsg;
            submissionId = gate.submissionId ?? null;
          } else if (gateRes.status === 401) {
            gateCode = "unauthorized";
            gateMsg = "Please sign in again to continue.";
          } else {
            const body: { error?: string; reason?: string } = await gateRes
              .json()
              .catch(() => ({}));
            gateCode = body?.reason ?? `http_${gateRes.status}`;
            gateMsg = body?.error ?? `Entry check failed (HTTP ${gateRes.status}).`;
          }
        } catch (gateErr) {
          console.error("[QuizArena] gate fetch failed:", gateErr);
          gateCode = "gate_error";
          gateMsg = "Could not verify your entry. Please try again.";
        }

        if (!gateOk) {
          denyAndRedirect(
            gateMsg,
            gateCode,
            gateCode === "already_submitted" ? "result" : "dashboard"
          );
          // Suppress unused-var lint warning for submissionId
          void submissionId;
          return;
        }

        // ---- 2) Fetch the gated quiz payload ----
        // The server-side /api/quiz/[id] endpoint re-validates payment +
        // submission state. If it returns anything other than 200 we MUST
        // block — the previous version fell back to hard-coded preview
        // questions here, which was the payment-bypass root cause.
        const res = await fetch(`/api/quiz/${encodeURIComponent(quizId)}`, {
          cache: "no-store",
        });
        if (!active) return;
        if (!res.ok) {
          const body: { error?: string; code?: string } = await res
            .json()
            .catch(() => ({}));
          denyAndRedirect(
            body?.error ?? `Failed to load quiz (HTTP ${res.status}).`,
            body?.code ?? `http_${res.status}`,
            body?.code === "already_submitted" ? "result" : "dashboard"
          );
          return;
        }
        const data: QuizPayload = await res.json();
        if (!data?.questions?.length || !data?.quiz) {
          denyAndRedirect(
            "This quiz has no questions yet. Please contact support.",
            "no_questions",
            "dashboard"
          );
          return;
        }
        setMeta(data.quiz);
        setQuestions(data.questions);
        setRemaining(data.quiz.durationSeconds ?? 0);
      } catch (err) {
        console.error("[QuizArena] load failed:", err);
        denyAndRedirect(
          "Unexpected error. Please try again.",
          "load_error",
          "dashboard"
        );
      } finally {
        if (active) {
          setLoading(false);
          startedAtRef.current = Date.now();
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [quizId, router]);

  /* ---------------- Submission Handler ---------------- */
  const submitQuiz = useCallback(
    async (reason: "completed" | "timeout" | "cheated") => {
      if (submittedRef.current || typeof window === "undefined") return;
      submittedRef.current = true;
      setSubmitting(true);
      setSubmitError(null);

      const timeTakenMs = Date.now() - startedAtRef.current;

      try {
        const res = await fetch("/api/quiz/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quizId,
            score: stateRef.current.score,
            incorrectCount: stateRef.current.incorrectCount,
            timeTakenMs,
            answers,
            cheated: stateRef.current.cheated || reason === "cheated",
            reason,
          }),
        });
        if (!res.ok) {
          const errBody: { error?: string } = await res.json().catch(() => ({}));
          throw new Error(errBody?.error ?? `Submit failed (HTTP ${res.status}).`);
        }
      } catch (err) {
        console.error("[QuizArena] submit failed:", err);
        setSubmitError(
          err instanceof Error ? err.message : "Failed to submit quiz."
        );
      } finally {
        // Always best-effort exit fullscreen and route to result
        try {
          if (typeof document !== "undefined" && document.fullscreenElement) {
            await document.exitFullscreen().catch(() => undefined);
          }
        } catch {
          /* ignore */
        }
        setSubmitting(false);
        router.replace(`/quiz/${encodeURIComponent(quizId)}/result`);
      }
    },
    [quizId, answers, router]
  );

  /* ---------------- Anti-Cheat: full-screen + visibility + focus ---------------- */
  const triggerCheat = useCallback(
    (origin: string) => {
      if (submittedRef.current) return;
      console.warn("[QuizArena] anti-cheat triggered:", origin);
      setCheated(true);
      // Auto-submit immediately on cheat detection
      submitQuiz("cheated");
    },
    [submitQuiz]
  );

  useEffect(() => {
    if (loading || denied || questions.length === 0 || typeof window === "undefined") return;

    const requestFs = async () => {
      try {
        const el = containerRef.current ?? document.documentElement;
        if (!document.fullscreenElement && el.requestFullscreen) {
          await el.requestFullscreen({ navigationUI: "hide" }).catch(() => undefined);
        }
      } catch {
        /* ignore */
      }
    };
    requestFs();

    const onVisibility = () => {
      if (document.visibilityState !== "visible") triggerCheat("visibility");
    };
    const onBlur = () => triggerCheat("window-blur");
    const onFsChange = () => {
      if (!document.fullscreenElement) triggerCheat("fullscreen-exit");
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onSelectStart = (e: Event) => e.preventDefault();
    const onCopy = (e: ClipboardEvent) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key?.toLowerCase();
      // Block paste / copy / cut / save / print / view-source / devtools
      if (
        (e.ctrlKey || e.metaKey) &&
        ["c", "v", "x", "s", "p", "u", "a"].includes(key)
      ) {
        e.preventDefault();
        return;
      }
      if (key === "f12") {
        e.preventDefault();
        return;
      }
      // Ctrl+Shift+I / J / C → devtools shortcuts
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        ["i", "j", "c", "k"].includes(key)
      ) {
        e.preventDefault();
        return;
      }
      // Escape blocks fullscreen — flag as cheat attempt
      if (key === "escape") {
        triggerCheat("escape-key");
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!submittedRef.current) {
        e.preventDefault();
        e.returnValue = "Leaving will forfeit this quiz.";
        return e.returnValue;
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("selectstart", onSelectStart);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCopy);
    document.addEventListener("paste", onCopy);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("selectstart", onSelectStart);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCopy);
      document.removeEventListener("paste", onCopy);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [loading, triggerCheat]);

  /* ---------------- Countdown Timer ---------------- */
  useEffect(() => {
    if (loading || denied || questions.length === 0 || cheated || submittedRef.current) return;
    if (remaining <= 0) {
      submitQuiz("timeout");
      return;
    }
    const t = window.setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [remaining, loading, denied, questions.length, cheated, submitQuiz]);

  /* ---------------- Derived ---------------- */
  const total = questions.length;
  const current = questions[currentQuestionIndex];
  const progressPct = useMemo<number>(
    () => (total > 0 ? Math.round(((currentQuestionIndex) / total) * 100) : 0),
    [currentQuestionIndex, total]
  );
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timerText = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;

  /* ---------------- Answer Handling ---------------- */
  const handleSelect = (opt: OptionKey) => {
    if (cheated || submittedRef.current) return;
    setSelectedOption(opt);
  };

  const handleNext = useCallback(() => {
    if (!current || cheated || submittedRef.current) return;
    if (!selectedOption) return;

    // Record answer locally; final scoring is authoritative on backend.
    setAnswers((prev) => ({ ...prev, [current.id]: selectedOption }));

    // Optimistic client-side scoring using correctAnswer if backend supplied it.
    if (current.correctAnswer) {
      const isCorrect =
        String(current.correctAnswer).toUpperCase() === selectedOption;
      if (isCorrect) setScore((s) => s + (current.points ?? 1));
      else setIncorrectCount((c) => c + 1);
    }

    if (currentQuestionIndex + 1 >= total) {
      // Completed all questions
      submitQuiz("completed");
      return;
    }

    setCurrentQuestionIndex((i) => i + 1);
    setSelectedOption(null);
  }, [current, selectedOption, cheated, currentQuestionIndex, total, submitQuiz]);

  /* ---------------- Render ---------------- */
  if (authStatus === "loading" || loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#0B0D19]">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  // STRICT DENY screen — rendered whenever the entry gate or the gated
  // questions endpoint rejects this user. The redirect to /dashboard fires
  // shortly after this paint via the load effect above.
  if (denied) {
    return (
      <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#0B0D19] px-6 text-center">
        <div className="rounded-3xl border border-[#DC2626]/40 bg-[#DC2626]/10 p-8 max-w-sm">
          <p className="text-5xl">🔒</p>
          <h1 className="mt-4 text-xl font-extrabold text-white">
            Entry Blocked
          </h1>
          <p className="mt-2 text-sm text-white/70">{denied.message}</p>
          <p className="mt-3 text-[10px] uppercase tracking-widest text-white/40">
            Reason: {denied.code}
          </p>
          <p className="mt-4 text-xs text-white/50">Redirecting…</p>
        </div>
      </div>
    );
  }

  if (cheated) {
    return (
      <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#0B0D19] px-6 text-center">
        <div className="rounded-3xl border border-[#DC2626]/40 bg-[#DC2626]/10 p-8">
          <p className="text-5xl">🚫</p>
          <h1 className="mt-4 text-xl font-extrabold text-white">
            Quiz Locked
          </h1>
          <p className="mt-2 max-w-xs text-sm text-white/70">
            Anti-cheat protection has flagged your session. You can no longer
            continue this quiz. Your current score has been submitted.
          </p>
          {submitting && (
            <p className="mt-3 text-xs text-white/50">Submitting…</p>
          )}
          {submitError && (
            <p className="mt-3 text-xs text-[#FCA5A5]">{submitError}</p>
          )}
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#0B0D19] text-white/60">
        No questions available for this quiz.
      </div>
    );
  }

  const options: { key: OptionKey; text: string }[] = [
    { key: "A", text: current.optionA },
    { key: "B", text: current.optionB },
    { key: "C", text: current.optionC },
    { key: "D", text: current.optionD },
  ];

  const timerCritical = remaining <= 10;

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-screen w-full select-none flex-col bg-[#0B0D19] text-white"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Ambient brand glows */}
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-[#2563EB] opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 -left-16 h-56 w-56 rounded-full bg-[#10B981] opacity-15 blur-3xl" />

      {/* Header / Progress / Timer */}
      <header className="relative z-10 px-5 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">
              Live Arena
            </p>
            <h1 className="mt-0.5 text-base font-extrabold leading-tight text-white">
              {meta.title}
            </h1>
          </div>
          <div
            className={`rounded-xl border px-3 py-1.5 text-center ${
              timerCritical
                ? "border-[#DC2626]/60 bg-[#DC2626]/15 text-[#FCA5A5]"
                : "border-white/10 bg-white/5 text-white"
            }`}
          >
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/50">
              Time
            </p>
            <p className="font-mono text-lg font-extrabold leading-tight">
              {timerText}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-white/50">
            <span>
              Question {currentQuestionIndex + 1} / {total}
            </span>
            <span>{progressPct}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#2563EB,#F59E0B,#10B981)] transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      {/* Question card */}
      <main className="relative z-10 mt-6 flex-1 px-5">
        <div className="rounded-3xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB_0%,#DC2626_33%,#F59E0B_66%,#10B981_100%)] shadow-[0_20px_60px_-20px_rgba(37,99,235,0.5)]">
          <div className="rounded-3xl bg-[#0F1224] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
              Question {currentQuestionIndex + 1}
            </p>
            <h2 className="mt-2 text-lg font-bold leading-snug text-white">
              {current.text}
            </h2>

            <div className="mt-5 flex flex-col gap-3">
              {options.map((opt) => {
                const active = selectedOption === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => handleSelect(opt.key)}
                    disabled={cheated || submitting}
                    className={`group relative w-full overflow-hidden rounded-2xl p-[1.5px] transition-transform duration-150 active:scale-[0.99] ${
                      active
                        ? "bg-[linear-gradient(135deg,#2563EB,#10B981)] shadow-[0_10px_40px_-10px_rgba(16,185,129,0.5)]"
                        : "bg-white/10"
                    }`}
                  >
                    <span
                      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-sm font-semibold transition-colors ${
                        active
                          ? "bg-[#0B0D19] text-white"
                          : "bg-[#11142A] text-white/85 group-hover:bg-[#15193A]"
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold ${
                          active
                            ? "bg-[linear-gradient(135deg,#2563EB,#10B981)] text-white"
                            : "bg-white/10 text-white/80"
                        }`}
                      >
                        {opt.key}
                      </span>
                      <span className="flex-1">{opt.text}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Footer / Next button */}
      <footer className="relative z-10 px-5 pb-8 pt-6">
        <button
          type="button"
          onClick={handleNext}
          disabled={!selectedOption || cheated || submitting}
          className="group relative w-full overflow-hidden rounded-2xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB_0%,#DC2626_33%,#F59E0B_66%,#10B981_100%)] shadow-[0_10px_40px_-10px_rgba(37,99,235,0.6)] transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B0D19] px-5 py-4 text-sm font-extrabold uppercase tracking-[0.2em] text-white transition-colors duration-150 group-hover:bg-[#11142A]">
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span>Submitting…</span>
              </>
            ) : currentQuestionIndex + 1 >= total ? (
              <span>Finish Quiz</span>
            ) : (
              <span>Next Question</span>
            )}
          </span>
        </button>

        {submitError && (
          <p className="mt-3 rounded-lg border border-[#DC2626]/40 bg-[#DC2626]/10 px-3 py-2 text-center text-xs font-medium text-[#FCA5A5]">
            {submitError}
          </p>
        )}
      </footer>
    </div>
  );
};

export default QuizArenaPage;
