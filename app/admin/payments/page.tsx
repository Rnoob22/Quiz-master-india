"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

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
  user: { id: string; name: string; email: string; image: string | null };
  quiz: { id: string; title: string };
}

const STATUS_STYLES: Record<PaymentStatus, string> = {
  SUCCESS: "border-[#10B981]/40 bg-[#10B981]/10 text-[#6EE7B7]",
  PENDING: "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FCD34D]",
  FAILED: "border-[#DC2626]/40 bg-[#DC2626]/10 text-[#FCA5A5]",
};

const FILTERS: { key: "" | PaymentStatus; label: string }[] = [
  { key: "", label: "All" },
  { key: "SUCCESS", label: "Success" },
  { key: "PENDING", label: "Pending" },
  { key: "FAILED", label: "Failed" },
];

const formatINR = (n: number): string =>
  `₹${(Math.round((n ?? 0) * 100) / 100).toLocaleString("en-IN")}`;

const AdminPaymentsPage = () => {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [filter, setFilter] = useState<"" | PaymentStatus>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (filter) qs.set("status", filter);
        const res = await fetch(`/api/admin/payments?${qs.toString()}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { payments: PaymentRow[] } = await res.json();
        if (active) setPayments(data.payments ?? []);
      } catch (err) {
        if (active) {
          console.error("[AdminPayments] load failed:", err);
          setError(err instanceof Error ? err.message : "Failed to load payments.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [filter]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-extrabold leading-tight">Payment Logs</h1>
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Razorpay ledger</p>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.label}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-xl border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                active
                  ? "border-white/10 bg-white/10 text-white"
                  : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-[#DC2626]/40 bg-[#DC2626]/10 px-3 py-2 text-xs text-[#FCA5A5]">
          {error}
        </div>
      )}

      {!loading && payments.length === 0 && !error && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-4xl">💳</p>
          <p className="mt-3 text-sm font-bold text-white">No payments found</p>
          <p className="mt-1 text-xs text-white/50">Transactions will appear here once players join paid quizzes.</p>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {payments.map((p) => (
          <li key={p.id} className="rounded-2xl border border-white/10 bg-[#0F1224] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="shrink-0 rounded-full p-[1.5px] bg-[linear-gradient(135deg,#2563EB,#10B981)]">
                  <div className="overflow-hidden rounded-full bg-[#0B0D19] p-[2px]">
                    {p.user.image ? (
                      <Image src={p.user.image} alt={p.user.name} width={32} height={32} className="h-8 w-8 rounded-full object-cover" unoptimized />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#11142A] text-xs font-bold text-white/80">
                        {p.user.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{p.user.name}</p>
                  <p className="truncate text-[10px] text-white/40">{p.user.email}</p>
                </div>
              </div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STATUS_STYLES[p.status]}`}>
                {p.status}
              </span>
            </div>

            <div className="mt-3 truncate text-[11px] font-semibold text-white/80">
              Quiz: <span className="text-white">{p.quiz.title}</span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              <Cell label="Base" value={formatINR(p.baseAmount)} />
              <Cell label="Tax" value={formatINR(p.taxAmount)} />
              <Cell label="Total" value={formatINR(p.totalPaid)} highlight />
            </div>

            <div className="mt-3 grid grid-cols-1 gap-1 text-[10px] text-white/40">
              <p className="truncate font-mono">Order: <span className="text-white/70">{p.razorpayOrderId}</span></p>
              {p.razorpayPaymentId && (
                <p className="truncate font-mono">Payment: <span className="text-white/70">{p.razorpayPaymentId}</span></p>
              )}
              <p className="text-white/40">{new Date(p.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

const Cell = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`rounded-lg border px-2 py-1.5 ${highlight ? "border-[#10B981]/40 bg-[#10B981]/10" : "border-white/5 bg-white/5"}`}>
    <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
    <p className={`text-xs font-bold ${highlight ? "text-[#6EE7B7]" : "text-white"}`}>{value}</p>
  </div>
);

export default AdminPaymentsPage;
