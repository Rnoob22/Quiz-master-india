"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
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
  totalPrizePool: number;
  topLeader: { name: string; image: string | null; score: number; timeTakenMs: number } | null;
  awaitingAdmin: boolean;
}

const pad = (n: number) => n.toString().padStart(2, "0");

const diffParts = (ms: number) => {
  if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0 };
  const s = Math.floor(ms / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
};

const ResultPage = () => {
  const params = useParams<{ id: string }>();
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const quizId = (params?.id as string) ?? "";

  const [state, setState] = useState<CompetitionState | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [loading, setLoading] = useState<boolean>(true);
  const [triggering, setTriggering] = useState<boolean>(false);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.replace("/login");
  }, [authStatus, router]);

  useEffect(() => {
    if (!quizId || authStatus !== "authenticated") return;
    let active = true;
    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/quiz/${quizId}/competition`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: CompetitionState = await res.json();
        if (active) setState(data);
      } catch (err) {
        console.error("[Result] fetch failed:", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchOnce();
    const t = setInterval(fetchOnce, 15000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [quizId, authStatus]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!state) return;
    if (state.hasCompetitionEnded && !state.winnersResolved && state.thresholdMet && !triggering) {
      setTriggering(true);
      fetch(`/api/quiz/${quizId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
        .then((r) => r.json())
        .catch((err) => console.warn("[auto-resolve] failed:", err))
        .finally(() => setTriggering(false));
    }
  }, [state, quizId, triggering]);

  const endMs = state?.competitionEndTime ? new Date(state.competitionEndTime).getTime() : 0;
  const remaining = endMs - now;
  const parts = diffParts(remaining);

  if (loading || !state) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#0B0D19]">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#0B0D19] px-5 pb-10 pt-6 text-white">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[#2563EB] opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-32 -right-10 h-56 w-56 rounded-full bg-[#10B981] opacity-15 blur-3xl" />

      <header className="relative z-10">
        <h1 className="text-xl font-extrabold leading-tight">
          <span className="text-[#2563EB]">Quiz</span>
          <span className="text-[#F59E0B]">Master</span>{" "}
          <span className="bg-[linear-gradient(135deg,#DC2626,#F59E0B,#10B981)] bg-clip-text text-transparent">INDIA</span>
        </h1>
        <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/40">Session Status</p>
      </header>

      {/* Generic confirmation — score/rank/prize are intentionally hidden until announced */}
      <section className="relative z-10 mt-8">
        <div className="rounded-3xl p-[1.5px] bg-[linear-gradient(135deg,#10B981,#2563EB)]">
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-[#0F1224] p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#10B981]/15 text-3xl">
              ✓
            </div>
            <h2 className="text-lg font-extrabold text-white">Test Completed Successfully</h2>
            <p className="max-w-xs text-xs leading-relaxed text-white/60">
              Thank you for participating in <span className="font-semibold text-white">{state.quizTitle}</span>.
              Your submission has been recorded and is now sealed for the duration of this competition.
              Results, rank and prize details will be revealed once the competition concludes.
            </p>
          </div>
        </div>
      </section>

      {/* Live countdown until competition ends */}
      {state.competitionEndTime && !state.hasCompetitionEnded && (
        <section className="relative z-10 mt-6">
          <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/40">Competition ends in</p>
          <div className="rounded-3xl border border-white/10 bg-[#0F1224] p-5">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { lbl: "Days", v: parts.d },
                { lbl: "Hours", v: parts.h },
                { lbl: "Mins", v: parts.m },
                { lbl: "Secs", v: parts.s },
              ].map((u) => (
                <div key={u.lbl} className="rounded-2xl border border-white/10 bg-white/5 py-3">
                  <p className="font-mono text-2xl font-extrabold text-white">{pad(u.v)}</p>
                  <p className="mt-0.5 text-[9px] uppercase tracking-wider text-white/40">{u.lbl}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-white/60">
              <span>{state.totalParticipants.toLocaleString("en-IN")} participants</span>
              <span>Threshold: {state.minParticipantsThreshold.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </section>
      )}

      {/* Top leader (during competition) - shows only #1, no other ranks */}
      {state.isWithinCompetition && state.topLeader && (
        <section className="relative z-10 mt-6">
          <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/40">Current Leader</p>
          <div className="flex items-center gap-3 rounded-3xl border border-[#F59E0B]/30 bg-[#F59E0B]/5 p-4">
            <span className="text-2xl">🥇</span>
            <div className="shrink-0 rounded-full p-[1.5px] bg-[linear-gradient(135deg,#F59E0B,#10B981)]">
              <div className="overflow-hidden rounded-full bg-[#0B0D19] p-[2px]">
                {state.topLeader.image ? (
                  <Image src={state.topLeader.image} alt={state.topLeader.name} width={36} height={36} className="h-9 w-9 rounded-full object-cover" unoptimized />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#11142A] text-xs font-bold text-white/80">
                    {state.topLeader.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <p className="flex-1 text-sm font-bold text-white">{state.topLeader.name}</p>
          </div>
        </section>
      )}

      {/* Ended states */}
      {state.hasCompetitionEnded && !state.winnersResolved && !state.thresholdMet && (
        <section className="relative z-10 mt-6 rounded-3xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-5 text-center">
          <p className="text-sm font-bold text-[#FCD34D]">Winner will be announced soon by the admin.</p>
          <p className="mt-1 text-[11px] text-white/60">
            Participation ({state.totalParticipants.toLocaleString("en-IN")}) is below the auto-resolution threshold.
          </p>
        </section>
      )}

      {state.winnersResolved && (
        <section className="relative z-10 mt-6">
          <Link
            href={`/leaderboard?quizId=${state.quizId}`}
            className="block w-full rounded-2xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB,#10B981)]"
          >
            <span className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B0D19] px-5 py-3.5 text-sm font-extrabold uppercase tracking-[0.2em] text-white hover:bg-[#11142A]">
              View Final Leaderboard →
            </span>
          </Link>
        </section>
      )}

      <div className="relative z-10 mt-auto pt-8">
        <Link href="/dashboard" className="block w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/80 hover:bg-white/10">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default ResultPage;
