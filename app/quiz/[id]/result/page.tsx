"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

interface ResultStats {
  quizId: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  incorrectCount: number;
  timeTakenMs: number;
  rank?: number | null;
  totalParticipants?: number | null;
  prizeWon?: number | null;
}

const MOCK_RESULT: ResultStats = {
  quizId: "",
  quizTitle: "Quiz Session Summary",
  score: 0,
  totalQuestions: 0,
  incorrectCount: 0,
  timeTakenMs: 0,
  rank: null,
  totalParticipants: null,
  prizeWon: null,
};

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

const safeInt = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
};

const formatTime = (ms: number): string => {
  const total = Math.max(0, Math.floor(safeInt(ms) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

const QuizResultPage = () => {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const quizId = (params?.id as string) ?? "";

  const { data: session, status: authStatus } = useSession();

  const [stats, setStats] = useState<ResultStats>(MOCK_RESULT);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /* ---------------- Auth Guard ---------------- */
  useEffect(() => {
    if (authStatus === "unauthenticated") router.replace("/login");
  }, [authStatus, router]);

  /* ---------------- Fetch Result ---------------- */
  useEffect(() => {
    if (!quizId || authStatus !== "authenticated") return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/quiz/${encodeURIComponent(quizId)}/result`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          throw new Error(`Failed to load results (HTTP ${res.status}).`);
        }
        const data: Partial<ResultStats> = await res.json();
        if (!active) return;
        setStats({
          quizId,
          quizTitle: data.quizTitle ?? MOCK_RESULT.quizTitle,
          score: safeInt(data.score),
          totalQuestions: safeInt(data.totalQuestions),
          incorrectCount: safeInt(data.incorrectCount),
          timeTakenMs: safeInt(data.timeTakenMs),
          rank: data.rank ?? null,
          totalParticipants: data.totalParticipants ?? null,
          prizeWon: data.prizeWon ?? null,
        });
      } catch (err) {
        if (!active) return;
        console.error("[QuizResult] load failed:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load quiz result."
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [quizId, authStatus]);

  /* ---------------- Derived ---------------- */
  const accuracy = useMemo<number>(() => {
    const score = safeInt(stats.score);
    const incorrect = safeInt(stats.incorrectCount);
    const answered = score + incorrect;
    if (answered <= 0) return 0;
    const pct = (score / answered) * 100;
    if (!Number.isFinite(pct)) return 0;
    return Math.round(pct);
  }, [stats]);

  const timeText = useMemo<string>(() => formatTime(stats.timeTakenMs), [stats]);

  const isWinner = (stats.rank ?? 0) === 1;

  /* ---------------- Render ---------------- */
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#0B0D19] pb-10 text-white">
      {/* Ambient glows */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[#2563EB] opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-1/3 -left-16 h-56 w-56 rounded-full bg-[#10B981] opacity-15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-32 -right-10 h-56 w-56 rounded-full bg-[#F59E0B] opacity-15 blur-3xl" />

      {/* ============ HEADER ============ */}
      <header className="relative z-10 flex items-center justify-between px-5 pt-6">
        <div>
          <h1 className="text-xl font-extrabold leading-tight tracking-tight">
            <span className="text-[#2563EB]">Quiz</span>
            <span className="text-[#F59E0B]">Master</span>{" "}
            <span className="bg-[linear-gradient(135deg,#DC2626,#F59E0B,#10B981)] bg-clip-text text-transparent">
              INDIA
            </span>
          </h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/40">
            Session Summary
          </p>
        </div>

        <div className="rounded-full p-[1.5px] bg-[linear-gradient(135deg,#2563EB_0%,#DC2626_33%,#F59E0B_66%,#10B981_100%)]">
          <div className="overflow-hidden rounded-full bg-[#0B0D19] p-[2px]">
            {session?.user?.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name ?? "User"}
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#11142A] text-xs font-bold text-white/80">
                {(session?.user?.name ?? "U").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ============ HERO RESULT CARD ============ */}
      <section className="relative z-10 mt-6 px-5">
        <div className="rounded-3xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB_0%,#F59E0B_55%,#10B981_100%)] shadow-[0_20px_80px_-20px_rgba(37,99,235,0.55)]">
          <div className="relative overflow-hidden rounded-3xl bg-[#0F1224] p-6">
            {/* Inner backlit accent */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-[linear-gradient(135deg,#2563EB,#F59E0B,#10B981)] opacity-25 blur-3xl"
            />

            <div className="relative flex flex-col items-center text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/40">
                {isWinner ? "Champion" : "Final Result"}
              </p>
              <h2 className="mt-1 text-lg font-extrabold leading-tight text-white">
                {stats.quizTitle}
              </h2>
              {loading && (
                <p className="mt-3 flex items-center gap-2 text-xs text-white/40">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  Computing your performance…
                </p>
              )}

              <div className="mt-5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                  Score
                </p>
                <div className="mt-1 flex items-end justify-center gap-2">
                  <span className="bg-[linear-gradient(135deg,#2563EB,#F59E0B_55%,#10B981)] bg-clip-text text-6xl font-black leading-none tracking-tight text-transparent">
                    {stats.score}
                  </span>
                  {stats.totalQuestions > 0 && (
                    <span className="pb-2 text-sm font-semibold text-white/40">
                      / {stats.totalQuestions}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[11px] uppercase tracking-wider text-white/40">
                  Accuracy {accuracy}%
                </p>
              </div>

              {stats.rank && (
                <div className="mt-4 rounded-full border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#FCD34D]">
                  🏆 Rank #{stats.rank}
                  {stats.totalParticipants ? ` of ${stats.totalParticipants}` : ""}
                </div>
              )}

              {stats.prizeWon != null && stats.prizeWon > 0 && (
                <div className="mt-3 rounded-full border border-[#10B981]/40 bg-[#10B981]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#6EE7B7]">
                  Prize Won ₹{stats.prizeWon.toLocaleString("en-IN")}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ METRICS GRID ============ */}
      <section className="relative z-10 mt-6 px-5">
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Correct"
            value={stats.score.toString()}
            accent="#10B981"
            icon="✅"
          />
          <MetricCard
            label="Incorrect"
            value={stats.incorrectCount.toString()}
            accent="#DC2626"
            icon="❌"
          />
          <MetricCard
            label="Time Taken"
            value={timeText}
            accent="#2563EB"
            icon="⏱️"
          />
          <MetricCard
            label="Accuracy"
            value={`${accuracy}%`}
            accent="#F59E0B"
            icon="🎯"
          />
        </div>
      </section>

      {error && (
        <div className="relative z-10 mx-5 mt-5 rounded-xl border border-[#DC2626]/40 bg-[#DC2626]/10 px-4 py-3 text-center text-xs font-medium text-[#FCA5A5]">
          {error}
        </div>
      )}

      {/* ============ FOOTER CTA ============ */}
      <footer className="relative z-10 mt-auto px-5 pt-8">
        <Link
          href="/dashboard"
          className="group block w-full overflow-hidden rounded-2xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB_0%,#DC2626_33%,#F59E0B_66%,#10B981_100%)] shadow-[0_10px_40px_-10px_rgba(37,99,235,0.6)] transition-transform duration-150 active:scale-[0.98]"
        >
          <span className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B0D19] px-5 py-4 text-sm font-extrabold uppercase tracking-[0.25em] text-white transition-colors duration-150 group-hover:bg-[#11142A]">
            <span>Return to Arena</span>
            <ArrowRightIcon />
          </span>
        </Link>

        <Link
          href="/leaderboard"
          className="mt-3 block w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/70 transition-colors hover:bg-white/10"
        >
          View Leaderboard
        </Link>
      </footer>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  SUB COMPONENTS                                                     */
/* ------------------------------------------------------------------ */

interface MetricCardProps {
  label: string;
  value: string;
  accent: string;
  icon: string;
}

const MetricCard = ({ label, value, accent, icon }: MetricCardProps) => {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#11142A]/80 p-4 backdrop-blur">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-25 blur-2xl"
        style={{ backgroundColor: accent }}
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
          {label}
        </span>
        <span className="text-base">{icon}</span>
      </div>
      <div className="mt-3 text-2xl font-extrabold tracking-tight text-white">
        {value}
      </div>
      <div
        aria-hidden
        className="mt-3 h-[3px] w-10 rounded-full"
        style={{ backgroundColor: accent }}
      />
    </div>
  );
};

const ArrowRightIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-4 w-4"
    aria-hidden
  >
    <path d="M5 12h14M13 5l7 7-7 7" />
  </svg>
);

export default QuizResultPage;
