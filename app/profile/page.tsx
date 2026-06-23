"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

interface UserProfile {
  id: string;
  email: string;
  name: string;
  image: string | null;
  preferredLanguage: string;
  dob: string | null;
  state: string | null;
  city: string | null;
  createdAt: string;
}

interface UserStats {
  totalPlayed: number;
  totalWins: number;
  accuracy: number;
  avgResponseMs: number;
}

interface HistoryRow {
  submissionId: string;
  quizId: string;
  quizTitle: string;
  score: number;
  incorrectCount: number;
  timeTakenMs: number;
  submittedAt: string;
  rank: number;
  totalParticipants: number;
}

const formatTime = (ms: number): string => {
  const t = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

const ProfilePage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats>({
    totalPlayed: 0,
    totalWins: 0,
    accuracy: 0,
    avgResponseMs: 0,
  });
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [meRes, statsRes, histRes] = await Promise.allSettled([
          fetch("/api/user/me", { cache: "no-store" }),
          fetch("/api/user/stats", { cache: "no-store" }),
          fetch("/api/user/history", { cache: "no-store" }),
        ]);
        if (!active) return;
        if (meRes.status === "fulfilled" && meRes.value.ok)
          setProfile(await meRes.value.json());
        if (statsRes.status === "fulfilled" && statsRes.value.ok)
          setStats(await statsRes.value.json());
        if (histRes.status === "fulfilled" && histRes.value.ok) {
          const data: { history: HistoryRow[] } = await histRes.value.json();
          setHistory(data.history ?? []);
        }
      } catch (err) {
        console.error("[Profile] load failed:", err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [status]);

  const highestRank = useMemo<number | null>(() => {
    if (history.length === 0) return null;
    return Math.min(...history.map((h) => h.rank));
  }, [history]);

  const achievements = useMemo(() => {
    return [
      { key: "first-play", label: "First Quiz", icon: "🎯", color: "#2563EB", unlocked: stats.totalPlayed >= 1 },
      { key: "first-win", label: "First Win", icon: "🏆", color: "#F59E0B", unlocked: stats.totalWins >= 1 },
      { key: "ten-quizzes", label: "10 Quizzes", icon: "⚡", color: "#10B981", unlocked: stats.totalPlayed >= 10 },
      { key: "sharpshooter", label: "90% Accuracy", icon: "🔥", color: "#DC2626", unlocked: stats.accuracy >= 90 },
      { key: "podium", label: "Podium Finish", icon: "🥇", color: "#F59E0B", unlocked: (highestRank ?? 999) <= 3 },
      { key: "champion", label: "Champion", icon: "👑", color: "#10B981", unlocked: (highestRank ?? 999) === 1 },
    ];
  }, [stats, highestRank]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#0B0D19]">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#0B0D19] pb-24 text-white">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[#2563EB] opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-1/3 -left-16 h-56 w-56 rounded-full bg-[#10B981] opacity-15 blur-3xl" />

      {/* IDENTITY */}
      <section className="relative z-10 px-5 pt-6">
        <div className="rounded-3xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB_0%,#DC2626_33%,#F59E0B_66%,#10B981_100%)] shadow-[0_20px_60px_-20px_rgba(37,99,235,0.4)]">
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-[#0F1224] p-6 text-center">
            <div className="rounded-full p-[2px] bg-[linear-gradient(135deg,#2563EB,#F59E0B,#10B981)]">
              <div className="overflow-hidden rounded-full bg-[#0B0D19] p-[3px]">
                {profile?.image || session?.user?.image ? (
                  <Image
                    src={(profile?.image || session?.user?.image) as string}
                    alt={profile?.name ?? "User"}
                    width={80}
                    height={80}
                    className="h-20 w-20 rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#11142A] text-2xl font-bold text-white/80">
                    {(profile?.name ?? session?.user?.name ?? "U").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <h1 className="text-lg font-extrabold leading-tight text-white">
              {profile?.name ?? session?.user?.name ?? "Player"}
            </h1>
            <p className="text-xs text-white/50">{profile?.email ?? session?.user?.email}</p>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <Badge>🌐 {profile?.preferredLanguage ?? "English"}</Badge>
              {profile?.state && (
                <Badge>
                  📍 {profile.state}
                  {profile.city ? ` · ${profile.city}` : ""}
                </Badge>
              )}
              {profile?.id && (
                <Badge mono>
                  ID: {profile.id.slice(0, 6)}…{profile.id.slice(-4)}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="relative z-10 mt-6 px-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/40">Stats</h2>
          {loading && (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Quizzes" value={String(stats.totalPlayed)} accent="#2563EB" icon="🎯" />
          <StatCard label="Wins" value={String(stats.totalWins)} accent="#10B981" icon="🏆" />
          <StatCard label="Accuracy" value={`${Math.round(stats.accuracy)}%`} accent="#F59E0B" icon="✅" />
          <StatCard label="Best Rank" value={highestRank ? `#${highestRank}` : "—"} accent="#DC2626" icon="🥇" />
        </div>
      </section>

      {/* ACHIEVEMENTS */}
      <section className="relative z-10 mt-6 px-5">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/40">
          Achievements
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {achievements.map((a) => (
            <div
              key={a.key}
              className={`flex flex-col items-center gap-1 rounded-2xl border p-3 text-center transition-opacity ${
                a.unlocked
                  ? "border-white/10 bg-white/5 opacity-100"
                  : "border-white/5 bg-white/[0.02] opacity-40"
              }`}
            >
              <span className="text-2xl" style={{ filter: a.unlocked ? "none" : "grayscale(1)" }}>
                {a.icon}
              </span>
              <span
                className="text-[9px] font-bold uppercase tracking-wider"
                style={{ color: a.unlocked ? a.color : "#FFFFFF" }}
              >
                {a.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* HISTORY */}
      <section className="relative z-10 mt-6 px-5">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/40">
          Participation History
        </h2>
        {history.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-xs text-white/50">
            You haven&apos;t played any quizzes yet. Join a live arena to start your journey!
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((h) => (
              <li key={h.submissionId} className="rounded-2xl border border-white/10 bg-[#0F1224] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{h.quizTitle}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/40">
                      {new Date(h.submittedAt).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <Link
                    href={`/quiz/${h.quizId}/result`}
                    className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/80 hover:bg-white/10"
                  >
                    View
                  </Link>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <Stat label="Score" value={`${h.score}`} />
                  <Stat label="Time" value={formatTime(h.timeTakenMs)} />
                  <Stat label="Rank" value={`#${h.rank}/${h.totalParticipants}`} highlight={h.rank <= 3} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="relative z-10 mt-6 px-5">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full rounded-2xl border border-[#DC2626]/30 bg-[#DC2626]/10 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#FCA5A5] hover:bg-[#DC2626]/20"
        >
          Sign Out
        </button>
        <Link
          href="/dashboard"
          className="mt-3 block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/70 hover:bg-white/10"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};

const Badge = ({ children, mono }: { children: React.ReactNode; mono?: boolean }) => (
  <span
    className={`rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] ${
      mono ? "font-mono" : "font-medium"
    } text-white/70`}
  >
    {children}
  </span>
);

const StatCard = ({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: string;
  icon: string;
}) => (
  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#11142A]/80 p-4 backdrop-blur">
    <div
      aria-hidden
      className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-25 blur-2xl"
      style={{ backgroundColor: accent }}
    />
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</span>
      <span className="text-base">{icon}</span>
    </div>
    <div className="mt-3 text-2xl font-extrabold tracking-tight text-white">{value}</div>
    <div aria-hidden className="mt-3 h-[3px] w-10 rounded-full" style={{ backgroundColor: accent }} />
  </div>
);

const Stat = ({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) => (
  <div
    className={`rounded-lg border px-2 py-1.5 ${
      highlight ? "border-[#F59E0B]/40 bg-[#F59E0B]/10" : "border-white/5 bg-white/5"
    }`}
  >
    <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
    <p className={`text-xs font-bold ${highlight ? "text-[#FCD34D]" : "text-white"}`}>{value}</p>
  </div>
);

export default ProfilePage;
