"use client";

import { useEffect, useState } from "react";

interface KycRow {
  id: string; name: string; email: string; mobile: string | null; panNumber: string | null;
  upiHandle: string | null; bankAccount: string | null; bankIfsc: string | null; bankHolderName: string | null;
  kycStatus: string; kycRejectionReason: string | null; kycSubmittedAt: string | null;
}

const STATUS: Record<string, string> = {
  SUBMITTED: "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FCD34D]",
  APPROVED: "border-[#10B981]/40 bg-[#10B981]/10 text-[#6EE7B7]",
  REJECTED: "border-[#DC2626]/40 bg-[#DC2626]/10 text-[#FCA5A5]",
};

const AdminKycPage = () => {
  const [rows, setRows] = useState<KycRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/admin/kyc", { cache: "no-store" });
    if (r.ok) { const d = await r.json(); setRows(d.users ?? []); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const act = async (userId: string, action: "approve" | "reject") => {
    setBusy(userId);
    const reason = action === "reject" ? (prompt("Reason for rejection?") ?? "") : undefined;
    await fetch("/api/admin/kyc", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, action, reason }) });
    await load();
    setBusy(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-extrabold">KYC Review</h1>
      {loading ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" /> :
        rows.length === 0 ? <p className="text-xs text-white/50">No KYC submissions yet.</p> : (
        <ul className="flex flex-col gap-3">
          {rows.map((u) => (
            <li key={u.id} className="rounded-2xl border border-white/10 bg-[#0F1224] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{u.name}</p>
                  <p className="truncate text-[10px] text-white/50">{u.email}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STATUS[u.kycStatus] ?? ""}`}>{u.kycStatus}</span>
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-1.5 text-[11px]">
                <Cell label="Mobile" value={u.mobile ?? "—"} />
                <Cell label="PAN" value={u.panNumber ?? "—"} />
                <Cell label="UPI" value={u.upiHandle ?? "—"} />
                <Cell label="Bank" value={u.bankAccount ? `${u.bankAccount} / ${u.bankIfsc}` : "—"} />
              </ul>
              {u.kycRejectionReason && <p className="mt-2 text-[10px] text-[#FCA5A5]">Reason: {u.kycRejectionReason}</p>}
              <div className="mt-3 flex gap-2">
                {u.kycStatus === "SUBMITTED" && <Btn onClick={() => act(u.id, "approve")} color="#10B981" disabled={busy === u.id}>Approve</Btn>}
                {u.kycStatus === "SUBMITTED" && <Btn onClick={() => act(u.id, "reject")} color="#DC2626" disabled={busy === u.id}>Reject</Btn>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Cell = ({ label, value }: { label: string; value: string }) => (
  <li className="rounded-lg border border-white/5 bg-white/5 px-2 py-1.5">
    <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
    <p className="truncate text-xs font-semibold text-white">{value}</p>
  </li>
);
const Btn = ({ onClick, color, disabled, children }: { onClick: () => void; color: string; disabled?: boolean; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} disabled={disabled} className="rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider disabled:opacity-50" style={{ backgroundColor: `${color}22`, borderColor: `${color}55`, color }}>{children}</button>
);

export default AdminKycPage;
