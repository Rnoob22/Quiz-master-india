"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

interface LeaderboardEntry {
  rank: number;
  submissionId: string;
  userId: string;
  name: string;
  image: string | null;
  state: string | null;
  city: string | null;
  score: number;
  timeTakenMs: number;
  incorrectCount: number;
  submittedAt: string;
  isCurrentUser: boolean;
}

interface LeaderboardResponse {
  quizId: string;
  quizTitle: string | null;
  scope: { state: string | null };
  total: number;
  entries: LeaderboardEntry[];
}

interface LiveQuiz {
  id: string;
  title: string;
  status: string;
}

/* ------------------------------------------------------------------ */
/*  CONSTANTS                                                          */
/* ------------------------------------------------------------------ */

const INDIAN_STATES: string[] = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
];

const MOCK_ENTRIES: LeaderboardEntry[] = [
  {
    rank: 1,
    submissionId: "mock-1",
    userId: "u1",
    name: "Aarav Mehta",
    image: null,
    state: "Maharashtra",
    city: "Mumbai",
    score: 18,
    timeTakenMs: 145000,
    incorrectCount: 2,
    submittedAt: new Date().toISOString(),
    isCurrentUser: false,
  },
  {
    rank: 2,
    submissionId: "mock-2",
    userId: "u2",
    name: "Diya Sharma",
    image: null,
    state: "Karnataka",
    city: "Bengaluru",
    score: 17,
    timeTakenMs: 162000,
    incorrectCount: 3,
    submittedAt: new Date().toISOString(),
    isCurrentUser: false,
  },
  {
    rank: 3,
    submissionId: "mock-3",
    userId: "u3",
    name: "Karan Verma",
    image: null,
    state: "Delhi",
    city: "Delhi",
    score: 16,
    timeTakenMs: 170000,
    incorrectCount: 4,
    submittedAt: new Date().toISOString(),
    isCurrentUser: false,
  },
];

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

const formatTime = (ms: number): string => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const initialsOf = (name: string): string => {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "?";
};

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

const LeaderboardPage = () => {
  const router = useRouter();
  const search = useSearchParams();
  const { status: authStatus } = useSession();

  const [quizId, setQuizId] = useState<string>(search?.get("quizId") ?? "");
  const [stateFilter, setStateFilter] = useState<string>(search?.get("state") ?? "");
  const [entries, setEntries] = useState<LeaderboardEntry[]>(MOCK_ENTRIES);
  const [quizTitle, setQuizTitle] = useState<string>("Leaderboard");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState<boolean>(false);

  /* Auth guard */
  useEffect(() => {
    if (authStatus === "unauthenticated") router.replace("/login");
  }, [authStatus, router]);

  /* If no quizId in URL, fetch a default live one */
  useEffect(() => {
    if (quizId) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/quizzes/live", { cache: "no-store" });
        if (!res.ok) return;
        const data: LiveQuiz[] | { quizzes?: LiveQuiz[] } = await res.json();
        const list = Array.isArray(data) ? data : data?.quizzes ?? [];
        if (active && list[0]?.id) setQuizId(list[0].id);
      } catch (err) {
        console.error("[Leaderboard] live quiz lookup failed:", err);
      }
    })();
    return () => { active = false; };
  }, [quizId]);

  /* Fetch leaderboard */
  useEffect(() => {
    if (!quizId || authStatus !== "authenticated") return;
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ quizId });
        if (stateFilter) qs.set("state", stateFilter);
        const res = await fetch(`/api/leaderboard?${qs.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const errBody: { error?: string } = await res.json().catch(() => ({}));
          throw new Error(errBody?.error ?? `Failed (HTTP ${res.status}).`);
        }
        const data: LeaderboardResponse = await res.json();
        if (!active) return;
        setQuizTitle(data.quizTitle ?? "Leaderboard");
        if (data.entries.length > 0) {
          setEntries(data.entries);
          setUsingMock(false);
        } else {
          setEntries([]);
          setUsingMock(false);
        }
      } catch (err) {
        if (!active) return;
        console.error("[Leaderboard] fetch failed:", err);
        setError(err instanceof Error ? err.message : "Failed to load leaderboard.");
        setEntries(MOCK_ENTRIES);
        setUsingMock(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [quizId, stateFilter, authStatus]);

  const podium = useMemo<LeaderboardEntry[]>(() => entries.slice(0, 3), [entries]);
  const rest = useMemo<LeaderboardEntry[]>(() => entries.slice(3), [entries]);

  /* ---------------- Render ---------------- */
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#0B0D19] pb-24 text-white">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[#2563EB] opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-1/3 -left-16 h-56 w-56 rounded-full bg-[#10B981] opacity-15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-32 -right-10 h-56 w-56 rounded-full bg-[#F59E0B] opacity-15 blur-3xl" />

      {/* HEADER */}
      <header className="relative z-10 px-5 pt-6">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-extrabold leading-tight tracking-tight">
              <span className="text-[#2563EB]">Leader</span>
              <span className="bg-[linear-gradient(135deg,#DC2626,#F59E0B,#10B981)] bg-clip-text text-transparent">
                board
              </span>
            </h1>
            <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/40">
              Live Rankings
            </p>
          </div>
          {loading && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          )}
        </div>

        <p className="mt-3 truncate text-sm text-white/70">
          <span className="text-white/40">Quiz: </span>
          <span className="font-semibold text-white">{quizTitle}</span>
        </p>

        {/* Scope filter */}
        <div className="mt-4 flex items-center gap-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Region
          </label>
          <div className="relative flex-1">
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="w-full appearance-none rounded-xl border border-white/10 bg-[#0F1224] px-3 py-2 pr-8 text-xs text-white outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/40"
            >
              <option value="">All India</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s} className="bg-[#0B0D19]">
                  {s}
                </option>
              ))}
            </select>
            <span aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40">▼</span>
          </div>
        </div>

        {usingMock && (
          <p className="mt-3 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-3 py-2 text-[11px] font-medium text-[#FCD34D]">
            Showing sample data — live leaderboard will appear once a quiz is selected.
          </p>
        )}
      </header>

      {/* CONTENT */}
      {!quizId ? (
        <EmptyState
          title="Select a Quiz"
          message="No quiz scope is active. Visit the dashboard and join a live quiz to view its leaderboard."
        />
      ) : entries.length === 0 ? (
        <EmptyState
          title="No entries yet"
          message="Submissions for this quiz haven't started rolling in. Be the first to play!"
        />
      ) : (
        <>
          {/* PODIUM */}
          {podium.length > 0 && (
            <section className="relative z-10 mt-6 px-5">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/40">
                Podium
              </h2>
              <div className="flex items-end justify-between gap-3">
                {podium[1] && <PodiumColumn entry={podium[1]} height="h-24" accent="#94A3B8" medal="🥈" />}
                {podium[0] && <PodiumColumn entry={podium[0]} height="h-32" accent="#F59E0B" medal="🥇" tall />}
                {podium[2] && <PodiumColumn entry={podium[2]} height="h-20" accent="#DC2626" medal="🥉" />}
              </div>
            </section>
          )}

          {/* LIST */}
          <section className="relative z-10 mt-6 px-5">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/40">
              All Rankings
            </h2>
            <ul className="flex flex-col gap-2">
              {(rest.length > 0 ? rest : podium).map((entry) => (
                <LeaderRow key={entry.submissionId} entry={entry} />
              ))}
            </ul>
          </section>
        </>
      )}

      {error && !usingMock && (
        <div className="relative z-10 mx-5 mt-4 rounded-xl border border-[#DC2626]/40 bg-[#DC2626]/10 px-3 py-2 text-center text-xs font-medium text-[#FCA5A5]">
          {error}
        </div>
      )}

      {/* BACK CTA */}
      <div className="relative z-10 mt-auto px-5 pt-8">
        <Link
          href="/dashboard"
          className="block w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/80 transition-colors hover:bg-white/10"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  SUB COMPONENTS                                                     */
/* ------------------------------------------------------------------ */

const EmptyState = ({ title, message }: { title: string; message: string }) => (
  <div className="relative z-10 mx-5 mt-10 rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
    <p className="text-5xl">🏆</p>
    <h3 className="mt-3 text-base font-extrabold text-white">{title}</h3>
    <p className="mt-2 text-xs leading-relaxed text-white/60">{message}</p>
  </div>
);

interface PodiumProps {
  entry: LeaderboardEntry;
  height: string;
  accent: string;
  medal: string;
  tall?: boolean;
}

const PodiumColumn = ({ entry, height, accent, medal, tall }: PodiumProps) => {
  return (
    <div className="flex flex-1 flex-col items-center">
      <Avatar entry={entry} size={tall ? 56 : 48} accent={accent} />
      <p className={`mt-2 line-clamp-1 ${tall ? "text-sm" : "text-xs"} font-bold text-white`}>
        {entry.name}
      </p>
      <p className="text-[10px] text-white/40">
        {entry.state ?? "—"}
      </p>
      <div
        className={`mt-2 flex w-full ${height} flex-col items-center justify-end rounded-t-2xl border-t border-white/10 px-2 pb-2`}
        style={{
          background: `linear-gradient(180deg, ${accent}33 0%, ${accent}11 100%)`,
        }}
      >
        <p className="text-2xl">{medal}</p>
        <p className="mt-0.5 text-base font-extrabold text-white">{entry.score}</p>
        <p className="text-[9px] uppercase tracking-wider text-white/50">
          {formatTime(entry.timeTakenMs)}
        </p>
      </div>
    </div>
  );
};

const LeaderRow = ({ entry }: { entry: LeaderboardEntry }) => {
  const isPodium = entry.rank <= 3;
  const accent =
    entry.rank === 1
      ? "#F59E0B"
      : entry.rank === 2
      ? "#94A3B8"
      : entry.rank === 3
      ? "#DC2626"
      : "#2563EB";

  return (
    <li
      className={`relative overflow-hidden rounded-2xl p-[1px] ${
        entry.isCurrentUser
          ? "bg-[linear-gradient(135deg,#2563EB,#10B981)]"
          : "bg-white/5"
      }`}
    >
      <div className="flex items-center gap-3 rounded-2xl bg-[#0F1224] px-3 py-3">
        {/* Rank badge */}
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${
            isPodium ? "text-white" : "text-white/80"
          }`}
          style={{
            background: isPodium
              ? `linear-gradient(135deg, ${accent}, ${accent}AA)`
              : "rgba(255,255,255,0.06)",
          }}
        >
          {entry.rank.toString().padStart(2, "0")}
        </div>

        {/* Avatar */}
        <Avatar entry={entry} size={36} accent={accent} compact />

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-sm font-bold text-white">
            <span className="truncate">{entry.name}</span>
            {entry.isCurrentUser && (
              <span className="rounded-full bg-[#10B981]/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#6EE7B7]">
                You
              </span>
            )}
          </p>
          <p className="truncate text-[10px] uppercase tracking-wider text-white/40">
            {entry.state ?? "—"} {entry.city ? `· ${entry.city}` : ""}
          </p>
        </div>

        {/* Score + time */}
        <div className="text-right">
          <p className="text-base font-extrabold text-white">{entry.score}</p>
          <p className="font-mono text-[10px] text-white/50">
            {formatTime(entry.timeTakenMs)}
          </p>
        </div>
      </div>
    </li>
  );
};

interface AvatarProps {
  entry: LeaderboardEntry;
  size: number;
  accent: string;
  compact?: boolean;
}

const Avatar = ({ entry, size, accent }: AvatarProps) => {
  const dim = `${size}px`;
  return (
    <div
      className="shrink-0 rounded-full p-[1.5px]"
      style={{
        background: `linear-gradient(135deg, ${accent}, #10B981)`,
        width: `calc(${dim} + 3px)`,
        height: `calc(${dim} + 3px)`,
      }}
    >
      <div
        className="overflow-hidden rounded-full bg-[#0B0D19] p-[2px]"
        style={{ width: "100%", height: "100%" }}
      >
        {entry.image ? (
          <Image
            src={entry.image}
            alt={entry.name}
            width={size}
            height={size}
            className="rounded-full object-cover"
            style={{ width: dim, height: dim }}
            unoptimized
          />
        ) : (
          <div
            className="flex items-center justify-center rounded-full bg-[#11142A] text-[10px] font-bold text-white/80"
            style={{ width: dim, height: dim }}
          >
            {initialsOf(entry.name)}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaderboardPage;
