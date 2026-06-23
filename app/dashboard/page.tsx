"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useDeviceFingerprint from "@/lib/hooks/useDeviceFingerprint";
import useRazorpayCheckout from "@/lib/hooks/useRazorpayCheckout";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  image: string | null;
  preferredLanguage: string;
  dob: string | null;
  state: string | null;
  city: string | null;
}

interface UserStats {
  totalPlayed: number;
  totalWins: number;
  accuracy: number; // 0-100
  avgResponseMs: number;
}

interface LiveQuiz {
  id: string;
  title: string;
  startTime: string;
  durationSeconds: number;
  entryFee: number;
  totalPrizePool: number;
  maxParticipants: number;
  status: "DRAFT" | "LIVE" | "COMPLETED";
}

const MOCK_STATS: UserStats = {
  totalPlayed: 0,
  totalWins: 0,
  accuracy: 0,
  avgResponseMs: 0,
};

const MOCK_LIVE_QUIZ: LiveQuiz = {
  id: "preview-quiz",
  title: "Friday Night Brainstorm",
  startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  durationSeconds: 600,
  entryFee: 49,
  totalPrizePool: 25000,
  maxParticipants: 1000,
  status: "LIVE",
};

const DashboardPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  useDeviceFingerprint(status === "authenticated");
  const {
    handleJoinQuiz,
    loading: joiningQuiz,
    loadingQuizId,
    error: joinError,
    clearError: clearJoinError,
  } = useRazorpayCheckout();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats>(MOCK_STATS);
  const [liveQuiz, setLiveQuiz] = useState<LiveQuiz | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Auth guard
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // Data loaders
  useEffect(() => {
    if (status !== "authenticated") return;

    const load = async () => {
      setLoading(true);
      try {
        const [meRes, statsRes, liveRes] = await Promise.allSettled([
          fetch("/api/user/me", { cache: "no-store" }),
          fetch("/api/user/stats", { cache: "no-store" }),
          fetch("/api/quizzes/live", { cache: "no-store" }),
        ]);

        if (meRes.status === "fulfilled" && meRes.value.ok) {
          const data: UserProfile = await meRes.value.json();
          setProfile(data);
          // Onboarding gate
          if (!data.dob || !data.state || !data.city) {
            router.replace("/onboarding");
            return;
          }
        }

        if (statsRes.status === "fulfilled" && statsRes.value.ok) {
          const data: UserStats = await statsRes.value.json();
          setStats(data);
        }

        if (liveRes.status === "fulfilled" && liveRes.value.ok) {
          const data: { quizzes?: LiveQuiz[] } | LiveQuiz[] = await liveRes.value.json();
          const list = Array.isArray(data) ? data : data?.quizzes ?? [];
          setLiveQuiz(list[0] ?? MOCK_LIVE_QUIZ);
        } else {
          setLiveQuiz(MOCK_LIVE_QUIZ);
        }
      } catch (err) {
        console.error("[Dashboard] load failed:", err);
        setLiveQuiz(MOCK_LIVE_QUIZ);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [status, router]);

  const userIdShort = useMemo<string>(() => {
    const id = profile?.id ?? "";
    if (!id) return "—";
    return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
  }, [profile?.id]);

  const accuracyText = useMemo<string>(() => `${Math.round(stats.accuracy ?? 0)}%`, [stats]);
  const avgRtText = useMemo<string>(() => {
    const ms = stats.avgResponseMs ?? 0;
    if (!ms) return "—";
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
  }, [stats]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#0B0D19]">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#0B0D19] pb-28">
      {/* Preload Razorpay Checkout SDK so the modal slides in instantly on click */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
      />

      {/* Ambient glows */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[#2563EB] opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-1/3 -left-16 h-56 w-56 rounded-full bg-[#10B981] opacity-15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-32 -right-10 h-56 w-56 rounded-full bg-[#F59E0B] opacity-15 blur-3xl" />

      {/* ============ HEADER ============ */}
      <header className="relative z-10 px-5 pt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <h1 className="text-xl font-extrabold leading-tight tracking-tight">
              <span className="text-[#2563EB]">Quiz</span>
              <span className="text-[#F59E0B]">Master</span>{" "}
              <span className="bg-[linear-gradient(135deg,#DC2626,#F59E0B,#10B981)] bg-clip-text text-transparent">
                INDIA
              </span>
            </h1>
            <p className="mt-1 text-[11px] uppercase tracking-[0.3em] text-white/40">
              Learn · Compete · Win
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-[10px] uppercase tracking-wider text-white/40">User ID</span>
              <span className="font-mono text-[11px] text-white/80">{userIdShort}</span>
            </div>

            <div className="relative">
              <div className="rounded-full p-[1.5px] bg-[linear-gradient(135deg,#2563EB_0%,#DC2626_33%,#F59E0B_66%,#10B981_100%)]">
                <div className="overflow-hidden rounded-full bg-[#0B0D19] p-[2px]">
                  {profile?.image || session?.user?.image ? (
                    <Image
                      src={profile?.image || session?.user?.image || ""}
                      alt={profile?.name ?? "User"}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#11142A] text-sm font-bold text-white/80">
                      {(profile?.name ?? session?.user?.name ?? "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User meta line */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/70">
            👋 {profile?.name ?? session?.user?.name ?? "Player"}
          </span>
          <span className="rounded-full border border-[#2563EB]/30 bg-[#2563EB]/10 px-3 py-1 text-[11px] font-semibold text-[#93C5FD]">
            🌐 {profile?.preferredLanguage ?? "English"}
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] text-white/60 sm:hidden">
            ID: {userIdShort}
          </span>
        </div>
      </header>

      {/* ============ STATS GRID ============ */}
      <section className="relative z-10 mt-6 px-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/70">
            Your Stats
          </h2>
          {loading && (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Quizzes Played"
            value={stats.totalPlayed.toString()}
            accent="#2563EB"
            icon="🎯"
          />
          <StatCard
            label="Total Wins"
            value={stats.totalWins.toString()}
            accent="#10B981"
            icon="🏆"
          />
          <StatCard
            label="Accuracy"
            value={accuracyText}
            accent="#F59E0B"
            icon="✅"
          />
          <StatCard
            label="Avg Response"
            value={avgRtText}
            accent="#DC2626"
            icon="⚡"
          />
        </div>
      </section>

      {/* ============ LIVE QUIZ CARD ============ */}
      <section className="relative z-10 mt-6 px-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/70">
            Live Arena
          </h2>
          {liveQuiz && (
            <span className="flex items-center gap-1.5 rounded-full border border-[#DC2626]/40 bg-[#DC2626]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FCA5A5]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#DC2626] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#DC2626]" />
              </span>
              Live
            </span>
          )}
        </div>

        {liveQuiz ? (
          <LiveQuizCard
            quiz={liveQuiz}
            onJoin={handleJoinQuiz}
            isJoining={joiningQuiz && loadingQuizId === liveQuiz.id}
          />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
            No live quizzes right now. Check back soon!
          </div>
        )}

        {joinError && (
          <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-[#DC2626]/40 bg-[#DC2626]/10 px-3 py-2 text-xs text-[#FCA5A5]">
            <span className="leading-relaxed">{joinError}</span>
            <button
              type="button"
              onClick={clearJoinError}
              className="text-white/60 hover:text-white"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}
      </section>

      {/* ============ BOTTOM NAV ============ */}
      <BottomNav active="home" />
    </div>
  );
};

/* ---------- Sub Components ---------- */

interface StatCardProps {
  label: string;
  value: string;
  accent: string;
  icon: string;
}

const StatCard = ({ label, value, accent, icon }: StatCardProps) => {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#11142A]/80 p-4 backdrop-blur"
    >
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

interface LiveQuizCardProps {
  quiz: LiveQuiz;
  onJoin: (quizId: string) => Promise<void> | void;
  isJoining: boolean;
}

const LiveQuizCard = ({ quiz, onJoin, isJoining }: LiveQuizCardProps) => {
  const start = new Date(quiz.startTime);
  const startText = start.toLocaleString("en-IN", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });

  const isFree = quiz.entryFee <= 0;

  const handleClick = () => {
    if (isJoining) return;
    onJoin(quiz.id);
  };

  return (
    <div className="relative rounded-3xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB_0%,#DC2626_33%,#F59E0B_66%,#10B981_100%)] shadow-[0_20px_60px_-20px_rgba(37,99,235,0.5)]">
      <div className="rounded-3xl bg-[#0F1224] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">
              Featured Live Quiz
            </p>
            <h3 className="mt-1 text-lg font-extrabold leading-tight text-white">
              {quiz.title}
            </h3>
            <p className="mt-1 text-xs text-white/50">Starts: {startText}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/40">
              Slots
            </p>
            <p className="text-sm font-bold text-white">{quiz.maxParticipants}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6EE7B7]">
              Prize Pool
            </p>
            <p className="mt-1 text-xl font-extrabold text-white">
              ₹{quiz.totalPrizePool.toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#FCD34D]">
              Entry Fee
            </p>
            <p className="mt-1 text-xl font-extrabold text-white">
              ₹{quiz.entryFee.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClick}
          disabled={isJoining}
          className="group mt-5 block w-full overflow-hidden rounded-2xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB_0%,#DC2626_33%,#F59E0B_66%,#10B981_100%)] shadow-[0_10px_40px_-10px_rgba(220,38,38,0.5)] transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B0D19] px-5 py-3.5 text-sm font-extrabold uppercase tracking-[0.2em] text-white transition-colors duration-150 group-hover:bg-[#11142A]">
            {isJoining ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span>{isFree ? "Joining…" : "Opening Payment…"}</span>
              </>
            ) : (
              <>
                <span>{isFree ? "Join Arena" : `Pay ₹${quiz.entryFee} & Join`}</span>
                <ArrowRightIcon />
              </>
            )}
          </span>
        </button>
      </div>
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

/* ---------- Bottom Nav ---------- */

type NavKey = "home" | "leaderboard" | "payments" | "profile";

const NAV_ITEMS: { key: NavKey; label: string; href: string; icon: JSX.Element }[] = [
  {
    key: "home",
    label: "Home",
    href: "/dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    key: "leaderboard",
    label: "Leaderboard",
    href: "/leaderboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M8 21h8M12 17v4M6 4h12v6a6 6 0 1 1-12 0V4z" />
        <path d="M4 6h2M18 6h2" />
      </svg>
    ),
  },
  {
    key: "payments",
    label: "Payments",
    href: "/payments",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M2 10h20M6 15h3" />
      </svg>
    ),
  },
  {
    key: "profile",
    label: "Profile",
    href: "/profile",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 1 1 16 0" />
      </svg>
    ),
  },
];

const BottomNav = ({ active }: { active: NavKey }) => {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[480px] px-4 pb-4">
      <div className="pointer-events-auto rounded-2xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB_0%,#DC2626_33%,#F59E0B_66%,#10B981_100%)] shadow-[0_10px_40px_-10px_rgba(37,99,235,0.5)]">
        <div className="grid grid-cols-4 rounded-2xl bg-[#0B0D19]/95 px-2 py-2 backdrop-blur-xl">
          {NAV_ITEMS.map((item) => {
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`relative flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  isActive ? "text-white" : "text-white/50 hover:text-white/80"
                }`}
              >
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-0 -z-10 rounded-xl bg-[linear-gradient(135deg,rgba(37,99,235,0.35),rgba(16,185,129,0.25))] ring-1 ring-white/10"
                  />
                )}
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default DashboardPage;
