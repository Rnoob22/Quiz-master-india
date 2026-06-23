"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface ClaimRow {
  id: string; rank: number; grossAmount: number; tdsAmount: number; netAmount: number;
  status: string; payoutMethod: string | null; payoutRef: string | null;
  approvedAt: string | null; paidAt: string | null; createdAt: string;
  user: { id: string; name: string; email: string; image: string | null; upiHandle: string | null; bankAccount: string | null; bankIfsc: string | null; kycStatus: string; panStatus: string };
  quiz: { id: string; title: string };
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FCD34D]",
  APPROVED: "border-[#2563EB]/40 bg-[#2563EB]/10 text-[#93C5FD]",
  PAID: "border-[#10B981]/40 bg-[#10B981]/10 text-[#6EE7B7]",
  REJECTED: "border-[#DC2626]/40 bg-[#DC2626]/10 text-[#FCA5A5]",
};

const formatINR = (n: number) => `₹${(Math.round((n ?? 0) * 100) / 100).toLocaleString("en-IN")}`;

const AdminClaimsPage = () => {
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/admin/claims", { cache: "no-store" });
    if (r.ok) { const d = await r.json(); setClaims(d.claims ?? []); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const act = async (id: string, action: "approve" | "reject" | "mark_paid") => {
    setBusy(id);
    const payoutRef = action === "mark_paid" ? prompt("Razorpay payout reference / UTR:") : undefined;
    if (action === "mark_paid" && !payoutRef) { setBusy(null); return; }
    await fetch("/api/admin/claims", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, payoutRef }) });
    await load();
    setBusy(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-extrabold">Prize Claims</h1>
      {loading ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" /> :
        claims.length === 0 ? <p className="text-xs text-white/50">No claims yet.</p> : (
        <ul className="flex flex-col gap-3">
          {claims.map((c) => (
            <li key={c.id} className="rounded-2xl border border-white/10 bg-[#0F1224] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="shrink-0 rounded-full p-[1.5px] bg-[linear-gradient(135deg,#2563EB,#10B981)]">
                    <div className="overflow-hidden rounded-full bg-[#0B0D19] p-[2px]">
                      {c.user.image ? <Image src={c.user.image} alt={c.user.name} width={32} height={32} className="h-8 w-8 rounded-full object-cover" unoptimized /> :
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#11142A] text-xs font-bold text-white/80">{c.user.name.charAt(0).toUpperCase()}</div>}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{c.user.name}</p>
                    <p className="truncate text-[10px] text-white/50">{c.user.email}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STATUS_COLOR[c.status] ?? ""}`}>{c.status}</span>
              </div>
              <p className="mt-2 text-[11px] text-white/70">Quiz: <span className="font-bold text-white">{c.quiz.title}</span> · Rank #{c.rank}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <Cell label="Gross" value={formatINR(c.grossAmount)} />
                <Cell label="TDS" value={formatINR(c.tdsAmount)} />
                <Cell label="Net" value={formatINR(c.netAmount)} highlight />
              </div>
              <p className="mt-2 text-[10px] text-white/40">KYC: {c.user.kycStatus} · PAN: {c.user.panStatus} · UPI: {c.user.upiHandle ?? "—"}</p>
              {c.payoutRef && <p className="mt-1 font-mono text-[10px] text-white/60">Ref: {c.payoutRef}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {c.status === "PENDING" && <Btn onClick={() => act(c.id, "approve")} color="#10B981" disabled={busy === c.id}>Approve</Btn>}
                {c.status === "APPROVED" && <Btn onClick={() => act(c.id, "mark_paid")} color="#2563EB" disabled={busy === c.id}>Mark Paid</Btn>}
                {c.status !== "PAID" && c.status !== "REJECTED" && <Btn onClick={() => act(c.id, "reject")} color="#DC2626" disabled={busy === c.id}>Reject</Btn>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Cell = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className={`rounded-lg border px-2 py-1.5 ${highlight ? "border-[#10B981]/40 bg-[#10B981]/10" : "border-white/5 bg-white/5"}`}>
    <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
    <p className={`text-xs font-bold ${highlight ? "text-[#6EE7B7]" : "text-white"}`}>{value}</p>
  </div>
);

const Btn = ({ onClick, color, disabled, children }: { onClick: () => void; color: string; disabled?: boolean; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} disabled={disabled}
    className="rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    style={{ backgroundColor: `${color}22`, borderColor: `${color}55`, color }}>{children}</button>
);

export default AdminClaimsPage;
