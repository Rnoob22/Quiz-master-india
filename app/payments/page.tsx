"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED";

interface PaymentRow {
  id: string;
  status: PaymentStatus;
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  baseAmount: number;
  taxAmount: number;
  totalPaid: number;
  createdAt: string;
  quiz: { id: string; title: string };
}

const STATUS_STYLES: Record<PaymentStatus, string> = {
  SUCCESS: "border-[#10B981]/40 bg-[#10B981]/10 text-[#6EE7B7]",
  PENDING: "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FCD34D]",
  FAILED: "border-[#DC2626]/40 bg-[#DC2626]/10 text-[#FCA5A5]",
};

const formatINR = (n: number): string =>
  `₹${(Math.round((n ?? 0) * 100) / 100).toLocaleString("en-IN")}`;

const PaymentsPage = () => {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === "unauthenticated") router.replace("/login");
  }, [authStatus, router]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;
    let active = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch("/api/user/payments", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { payments: PaymentRow[] } = await res.json();
        if (active) setPayments(data.payments ?? []);
      } catch (err) {
        if (active) {
          console.error("[Payments] load failed:", err);
          setError(err instanceof Error ? err.message : "Failed to load payments.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [authStatus]);

  const summary = useMemo(() => {
    let collected = 0;
    let tax = 0;
    for (const p of payments) {
      if (p.status === "SUCCESS") {
        collected += p.totalPaid;
        tax += p.taxAmount;
      }
    }
    return { collected, tax, count: payments.filter((p) => p.status === "SUCCESS").length };
  }, [payments]);

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#0B0D19] pb-24 text-white">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[#2563EB] opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-32 -right-10 h-56 w-56 rounded-full bg-[#F59E0B] opacity-15 blur-3xl" />

      <header className="relative z-10 px-5 pt-6">
        <h1 className="text-xl font-extrabold leading-tight tracking-tight">
          <span className="text-[#2563EB]">My </span>
          <span className="bg-[linear-gradient(135deg,#DC2626,#F59E0B,#10B981)] bg-clip-text text-transparent">Payments</span>
        </h1>
        <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/40">Razorpay transaction history</p>
      </header>

      <section className="relative z-10 mt-6 px-5">
        <div className="rounded-3xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB,#10B981)]">
          <div className="flex items-end justify-between gap-3 rounded-3xl bg-[#0F1224] p-5">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/40">Total Spent</p>
              <p className="mt-1 bg-[linear-gradient(135deg,#2563EB,#F59E0B,#10B981)] bg-clip-text text-3xl font-black text-transparent">
                {formatINR(summary.collected)}
              </p>
              <p className="mt-1 text-[10px] text-white/50">across {summary.count} successful order(s)</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-white/40">GST Paid</p>
              <p className="mt-1 text-base font-bold text-[#FCD34D]">{formatINR(summary.tax)}</p>
            </div>
          </div>
        </div>
      </section>

      {loading && (
        <div className="relative z-10 flex items-center justify-center py-10">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}

      {error && (
        <div className="relative z-10 mx-5 mt-4 rounded-xl border border-[#DC2626]/40 bg-[#DC2626]/10 px-3 py-2 text-xs text-[#FCA5A5]">
          {error}
        </div>
      )}

      {!loading && payments.length === 0 && !error && (
        <div className="relative z-10 mx-5 mt-6 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-4xl">💳</p>
          <p className="mt-3 text-sm font-bold text-white">No transactions yet</p>
          <p className="mt-1 text-xs text-white/50">Your payment history will appear here once you join a paid quiz.</p>
        </div>
      )}

      <ul className="relative z-10 mt-6 flex flex-col gap-2 px-5">
        {payments.map((p) => (
          <li key={p.id} className="rounded-2xl border border-white/10 bg-[#0F1224] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{p.quiz.title}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/40">
                  {new Date(p.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STATUS_STYLES[p.status]}`}>
                {p.status}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <Cell label="Base" value={formatINR(p.baseAmount)} />
              <Cell label="GST" value={formatINR(p.taxAmount)} />
              <Cell label="Total" value={formatINR(p.totalPaid)} highlight />
            </div>
            <div className="mt-3 truncate font-mono text-[10px] text-white/40">
              Order: <span className="text-white/70">{p.razorpayOrderId}</span>
            </div>
            {p.razorpayPaymentId && (
              <div className="truncate font-mono text-[10px] text-white/40">
                Payment: <span className="text-white/70">{p.razorpayPaymentId}</span>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="relative z-10 mt-auto px-5 pt-8">
        <Link
          href="/dashboard"
          className="block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/80 hover:bg-white/10"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};

const Cell = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`rounded-lg border px-2 py-1.5 ${highlight ? "border-[#10B981]/40 bg-[#10B981]/10" : "border-white/5 bg-white/5"}`}>
    <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
    <p className={`text-xs font-bold ${highlight ? "text-[#6EE7B7]" : "text-white"}`}>{value}</p>
  </div>
);

export default PaymentsPage;
