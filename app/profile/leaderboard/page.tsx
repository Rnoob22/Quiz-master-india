"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

interface CompetitionState {
  quizId: string;
  quizTitle: string;
  competitionEndTime: string | null;
  serverTime: string;
  isWithinCompetition: boolean;
  hasCompetitionEnded: boolean;
  winnersResolved: boolean;
  totalParticipants: number;
  minParticipantsThreshold: number;
  thresholdMet: boolean;
  topLeader: { name: string; image: string | null; score: number; timeTakenMs: number } | null;
  awaitingAdmin: boolean;
}

const pad = (n: number) => n.toString().padStart(2, "0");
const parts = (ms: number) => {
  if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0 };
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
};

const ProfileLeaderboardPage = () => {
  const { status } = useSession();
  const router = useRouter();
  const search = useSearchParams();
  const [quizId, setQuizId] = useState<string>(search?.get("quizId") ?? "");
  const [state, setState] = useState<CompetitionState | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { if (status === "unauthenticated") router.replace("/login"); }, [status, router]);

  useEffect(() => {
    if (quizId || status !== "authenticated") return;
    fetch("/api/quizzes/live").then((r) => r.json()).then((d) => {
      const list = Array.isArray(d) ? d : d?.quizzes ?? [];
      if (list[0]?.id) setQuizId(list[0].id);
    });
  }, [quizId, status]);

  useEffect(() => {
    if (!quizId || status !== "authenticated") return;
    const fetchOnce = () => fetch(`/api/quiz/${quizId}/competition`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null).then((d) => d && setState(d)).catch(() => undefined);
    fetchOnce();
    const t = setInterval(fetchOnce, 15000);
    return () => clearInterval(t);
  }, [quizId, status]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const endMs = state?.competitionEndTime ? new Date(state.competitionEndTime).getTime() : 0;
  const p = parts(endMs - now);

  if (!state) {
    return <div className="flex min-h-screen w-full items-center justify-center bg-[#0B0D19]"><span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" /></div>;
  }

  // ACTIVE COMPETITION VIEW: only top leader + countdown
  if (state.isWithinCompetition) {
    return (
      <div className="relative flex min-h-screen flex-col bg-[#0B0D19] px-5 pb-16 pt-6 text-white">
        <Link href="/profile" className="inline-block rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:bg-white/10">← Profile</Link>
        <h1 className="mt-4 text-xl font-extrabold leading-tight"><span className="bg-[linear-gradient(135deg,#2563EB,#F59E0B,#10B981)] bg-clip-text text-transparent">Live Competition</span></h1>
        <p className="mt-1 text-sm text-white/70">{state.quizTitle}</p>

        <section className="mt-6">
          <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/40">Closes in</p>
          <div className="rounded-3xl border border-white/10 bg-[#0F1224] p-5">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[{ l: "Days", v: p.d }, { l: "Hours", v: p.h }, { l: "Mins", v: p.m }, { l: "Secs", v: p.s }].map((u) => (
                <div key={u.l} className="rounded-2xl border border-white/10 bg-white/5 py-3">
                  <p className="font-mono text-3xl font-extrabold text-white">{pad(u.v)}</p>
                  <p className="mt-0.5 text-[9px] uppercase tracking-wider text-white/40">{u.l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {state.topLeader && (
          <section className="mt-6">
            <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/40">Current Leader</p>
            <div className="flex items-center gap-3 rounded-3xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-5">
              <span className="text-3xl">🥇</span>
              <div className="flex-1">
                <p className="text-base font-extrabold text-white">{state.topLeader.name}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/50">Holding the top spot</p>
              </div>
            </div>
          </section>
        )}

        <p className="mt-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-[11px] text-white/60">
          Full ranks and scores are sealed until the competition concludes.
        </p>
      </div>
    );
  }

  // POST-COMPETITION: redirect to public leaderboard
  if (state.winnersResolved) {
    return (
      <div className="relative flex min-h-screen flex-col bg-[#0B0D19] px-5 pb-16 pt-6 text-white">
        <Link href="/profile" className="inline-block rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:bg-white/10">← Profile</Link>
        <h1 className="mt-4 text-xl font-extrabold">Results are out</h1>
        <Link href={`/leaderboard?quizId=${state.quizId}`} className="mt-6 block w-full rounded-2xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB,#10B981)]">
          <span className="flex w-full items-center justify-center rounded-2xl bg-[#0B0D19] px-5 py-4 text-sm font-extrabold uppercase tracking-[0.25em] text-white hover:bg-[#11142A]">View Final Leaderboard →</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#0B0D19] px-5 pb-16 pt-6 text-white">
      <Link href="/profile" className="inline-block rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:bg-white/10">← Profile</Link>
      <h1 className="mt-4 text-xl font-extrabold">{state.quizTitle}</h1>
      <div className="mt-6 rounded-3xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-5 text-center">
        <p className="text-sm font-bold text-[#FCD34D]">Winner will be announced soon by the admin.</p>
        <p className="mt-1 text-[11px] text-white/60">Participation: {state.totalParticipants.toLocaleString("en-IN")} · Threshold: {state.minParticipantsThreshold.toLocaleString("en-IN")}</p>
      </div>
    </div>
  );
};

export default ProfileLeaderboardPage;
