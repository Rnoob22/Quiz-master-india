"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

interface AdminStats {
  totals: {
    users: number;
    quizzes: number;
    quizzesLive: number;
    quizzesDraft: number;
    submissions: number;
    payments: number;
    paymentsSuccess: number;
    paymentsPending: number;
    paymentsFailed: number;
  };
  revenue: { totalCollected: number; totalTax: number };
}

const MOCK: AdminStats = {
  totals: {
    users: 0, quizzes: 0, quizzesLive: 0, quizzesDraft: 0,
    submissions: 0, payments: 0, paymentsSuccess: 0, paymentsPending: 0, paymentsFailed: 0,
  },
  revenue: { totalCollected: 0, totalTax: 0 },
};

const formatINR = (n: number): string =>
  `₹${(Math.round((n ?? 0) * 100) / 100).toLocaleString("en-IN")}`;

const AdminHomePage = () => {
  const { data: session } = useSession();
  const [stats, setStats] = useState<AdminStats>(MOCK);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        if (!active) return;
        if (res.ok) {
          const data: AdminStats = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("[AdminHome] stats failed:", err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {/* HEADER */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight">
            <span className="text-[#2563EB]">Admin</span>{" "}
            <span className="bg-[linear-gradient(135deg,#DC2626,#F59E0B,#10B981)] bg-clip-text text-transparent">Console</span>
          </h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/40">
            QuizMasters India · Operations
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className="text-[10px] uppercase tracking-wider text-white/40">Signed in as</p>
          <p className="truncate text-[11px] font-semibold text-white">{session?.user?.email}</p>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* QUICK ACTIONS */}
      <section>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/40">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <ActionTile href="/admin/quiz-create" title="Create Quiz" subtitle="Build a new live arena" gradient="from-[#2563EB] to-[#10B981]" icon="➕" />
          <ActionTile href="/admin/quizzes" title="Manage Quizzes" subtitle="Edit, launch, archive" gradient="from-[#F59E0B] to-[#DC2626]" icon="🎯" />
          <ActionTile href="/admin/users" title="Users" subtitle="Registered players" gradient="from-[#2563EB] to-[#F59E0B]" icon="👥" />
          <ActionTile href="/admin/payments" title="Payments" subtitle="Razorpay ledger" gradient="from-[#10B981] to-[#2563EB]" icon="💳" />
        </div>
      </section>

      {/* KPI GRID */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/40">Platform Stats</h2>
          {loading && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" />}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Players" value={stats.totals.users.toString()} accent="#2563EB" icon="👤" />
          <KpiCard label="Quizzes" value={stats.totals.quizzes.toString()} sub={`${stats.totals.quizzesLive} live · ${stats.totals.quizzesDraft} draft`} accent="#F59E0B" icon="🎨" />
          <KpiCard label="Submissions" value={stats.totals.submissions.toString()} accent="#10B981" icon="✅" />
          <KpiCard label="Payments" value={stats.totals.payments.toString()} sub={`${stats.totals.paymentsSuccess} ok · ${stats.totals.paymentsPending} pending`} accent="#DC2626" icon="💰" />
        </div>
      </section>

      {/* REVENUE */}
      <section className="rounded-3xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB,#10B981)]">
        <div className="rounded-3xl bg-[#0F1224] p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/40">Revenue (Successful Orders)</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40">Total Collected</p>
              <p className="mt-1 bg-[linear-gradient(135deg,#2563EB,#F59E0B,#10B981)] bg-clip-text text-3xl font-black text-transparent">
                {formatINR(stats.revenue.totalCollected)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-white/40">GST Component</p>
              <p className="mt-1 text-base font-bold text-[#FCD34D]">{formatINR(stats.revenue.totalTax)}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

interface ActionTileProps {
  href: string;
  title: string;
  subtitle: string;
  gradient: string;
  icon: string;
}

const ActionTile = ({ href, title, subtitle, gradient, icon }: ActionTileProps) => (
  <Link
    href={href}
    className="group relative overflow-hidden rounded-2xl p-[1.5px] transition-transform duration-150 active:scale-[0.98]"
  >
    <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${gradient} opacity-60 group-hover:opacity-100`} />
    <div className="flex h-full flex-col gap-1 rounded-2xl bg-[#0F1224] p-4">
      <div className="flex items-center justify-between">
        <span className="text-lg">{icon}</span>
        <span className="text-white/30">→</span>
      </div>
      <p className="mt-1 text-sm font-extrabold text-white">{title}</p>
      <p className="text-[10px] uppercase tracking-wider text-white/40">{subtitle}</p>
    </div>
  </Link>
);

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent: string;
  icon: string;
}

const KpiCard = ({ label, value, sub, accent, icon }: KpiCardProps) => (
  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#11142A]/80 p-4 backdrop-blur">
    <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-25 blur-2xl" style={{ backgroundColor: accent }} />
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</span>
      <span className="text-base">{icon}</span>
    </div>
    <div className="mt-3 text-2xl font-extrabold tracking-tight text-white">{value}</div>
    {sub && <p className="mt-1 text-[10px] uppercase tracking-wider text-white/40">{sub}</p>}
    <div aria-hidden className="mt-3 h-[3px] w-10 rounded-full" style={{ backgroundColor: accent }} />
  </div>
);

export default AdminHomePage;
