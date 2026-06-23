"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface KycForm {
  mobile: string; gender: string; panNumber: string; upiHandle: string;
  bankAccount: string; bankIfsc: string; bankHolderName: string;
}
interface ServerKyc extends KycForm { kycStatus: string; kycRejectionReason: string | null }

const InputStyle = "w-full rounded-xl border border-white/10 bg-[#0B0D19] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/40";

const KycPage = () => {
  const { status } = useSession();
  const router = useRouter();
  const [form, setForm] = useState<KycForm>({ mobile: "", gender: "", panNumber: "", upiHandle: "", bankAccount: "", bankIfsc: "", bankHolderName: "" });
  const [server, setServer] = useState<ServerKyc | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { if (status === "unauthenticated") router.replace("/login"); }, [status, router]);
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/user/kyc").then((r) => r.ok ? r.json() : null).then((d) => {
      if (d) {
        setServer(d);
        setForm({ mobile: d.mobile ?? "", gender: d.gender ?? "", panNumber: d.panNumber ?? "", upiHandle: d.upiHandle ?? "", bankAccount: d.bankAccount ?? "", bankIfsc: d.bankIfsc ?? "", bankHolderName: d.bankHolderName ?? "" });
      }
      setLoading(false);
    });
  }, [status]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/user/kyc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setMsg({ ok: true, text: "✅ KYC details submitted. Awaiting admin review." });
      setServer((s) => s ? { ...s, kycStatus: data.kycStatus } : s);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Failed." });
    } finally { setBusy(false); }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#0B0D19]"><span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" /></div>;

  return (
    <div className="relative flex min-h-screen flex-col bg-[#0B0D19] px-5 pb-16 pt-6 text-white">
      <Link href="/profile" className="inline-block rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:bg-white/10">← Profile</Link>
      <h1 className="mt-4 text-xl font-extrabold leading-tight"><span className="bg-[linear-gradient(135deg,#2563EB,#F59E0B,#10B981)] bg-clip-text text-transparent">KYC &amp; Prize Claim</span></h1>
      <p className="mt-1 text-[11px] text-white/50">Required to claim cash prizes. 30% TDS is deducted on winnings (Section 194B).</p>

      {server && (
        <div className={`mt-4 rounded-xl border px-3 py-2 text-[11px] font-medium ${server.kycStatus === "APPROVED" ? "border-[#10B981]/40 bg-[#10B981]/10 text-[#6EE7B7]" : server.kycStatus === "REJECTED" ? "border-[#DC2626]/40 bg-[#DC2626]/10 text-[#FCA5A5]" : server.kycStatus === "SUBMITTED" ? "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FCD34D]" : "border-white/10 bg-white/5 text-white/70"}`}>
          Status: <strong>{server.kycStatus}</strong>{server.kycRejectionReason ? ` · ${server.kycRejectionReason}` : ""}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
        <Field label="Mobile (10 digits)"><input className={InputStyle} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="9XXXXXXXXX" /></Field>
        <Field label="Gender (optional)">
          <select className={InputStyle} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="" className="bg-[#0B0D19]">Prefer not to say</option>
            <option value="Male" className="bg-[#0B0D19]">Male</option>
            <option value="Female" className="bg-[#0B0D19]">Female</option>
            <option value="Other" className="bg-[#0B0D19]">Other</option>
          </select>
        </Field>
        <Field label="PAN Number (ABCDE1234F)"><input className={InputStyle} value={form.panNumber} onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" maxLength={10} /></Field>
        <Field label="UPI Handle"><input className={InputStyle} value={form.upiHandle} onChange={(e) => setForm({ ...form, upiHandle: e.target.value })} placeholder="name@upi" /></Field>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-white/40">Bank (alternative to UPI)</p>
          <div className="flex flex-col gap-2">
            <input className={InputStyle} value={form.bankHolderName} onChange={(e) => setForm({ ...form, bankHolderName: e.target.value })} placeholder="Account holder name" />
            <input className={InputStyle} value={form.bankAccount} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} placeholder="Account number" />
            <input className={InputStyle} value={form.bankIfsc} onChange={(e) => setForm({ ...form, bankIfsc: e.target.value.toUpperCase() })} placeholder="IFSC code" maxLength={11} />
          </div>
        </div>

        {msg && <div className={`rounded-xl border px-3 py-2 text-xs ${msg.ok ? "border-[#10B981]/40 bg-[#10B981]/10 text-[#6EE7B7]" : "border-[#DC2626]/40 bg-[#DC2626]/10 text-[#FCA5A5]"}`}>{msg.text}</div>}

        <button type="submit" disabled={busy} className="rounded-2xl p-[1.5px] bg-[linear-gradient(135deg,#2563EB_0%,#DC2626_33%,#F59E0B_66%,#10B981_100%)] disabled:opacity-50">
          <span className="flex w-full items-center justify-center rounded-2xl bg-[#0B0D19] px-5 py-4 text-sm font-extrabold uppercase tracking-[0.25em] text-white hover:bg-[#11142A]">{busy ? "Submitting…" : "Submit for review"}</span>
        </button>
      </form>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">{label}</span>
    {children}
  </label>
);

export default KycPage;
