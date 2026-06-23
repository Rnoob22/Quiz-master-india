"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface TicketMessage { id: string; isAdmin: boolean; body: string; createdAt: string; authorEmail: string }
interface Ticket { id: string; subject: string; category: string; status: string; createdAt: string; updatedAt: string; messages: TicketMessage[] }

const SupportPage = () => {
  const { status } = useSession();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ subject: "", category: "general", message: "" });
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (status === "unauthenticated") router.replace("/login"); }, [status, router]);

  const load = async () => {
    setLoading(true);
    const r = await fetch("/api/support", { cache: "no-store" });
    const d = await r.json();
    setTickets(d.tickets ?? []);
    setLoading(false);
  };
  useEffect(() => { if (status === "authenticated") load(); }, [status]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.subject.trim() || !draft.message.trim()) return;
    setBusy(true);
    await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) });
    setDraft({ subject: "", category: "general", message: "" });
    await load();
    setBusy(false);
  };

  const sendReply = async (id: string) => {
    if (!reply.trim()) return;
    setBusy(true);
    await fetch(`/api/support/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: reply }) });
    setReply("");
    await load();
    setBusy(false);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[#0B0D19] px-5 pb-16 pt-6 text-white">
      <div className="flex items-center justify-between">
        <Link href="/profile" className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:bg-white/10">← Profile</Link>
        <h1 className="text-base font-extrabold">Support</h1>
      </div>

      <form onSubmit={create} className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0F1224] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Raise a ticket</p>
        <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="Subject" className="rounded-xl border border-white/10 bg-[#0B0D19] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#2563EB]" />
        <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} className="rounded-xl border border-white/10 bg-[#0B0D19] px-3 py-2 text-sm text-white">
          <option value="general" className="bg-[#0B0D19]">General</option>
          <option value="payment" className="bg-[#0B0D19]">Payment / Refund</option>
          <option value="technical" className="bg-[#0B0D19]">Technical</option>
          <option value="prize" className="bg-[#0B0D19]">Prize / Payout</option>
        </select>
        <textarea rows={3} value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} placeholder="Describe your issue…" className="rounded-xl border border-white/10 bg-[#0B0D19] px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#2563EB]" />
        <button type="submit" disabled={busy} className="self-start rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-[11px] font-bold uppercase tracking-wider hover:bg-white/20 disabled:opacity-50">Create ticket</button>
      </form>

      <h2 className="mt-6 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/40">Your tickets</h2>
      {loading ? <p className="mt-4 text-white/50">Loading…</p> : tickets.length === 0 ? (
        <p className="mt-4 text-xs text-white/50">No tickets yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {tickets.map((t) => (
            <li key={t.id} className="rounded-2xl border border-white/10 bg-[#0F1224]">
              <button type="button" onClick={() => setOpenId(openId === t.id ? null : t.id)} className="flex w-full items-center justify-between gap-2 p-3 text-left">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{t.subject}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/40">{t.category} · {t.status} · {new Date(t.updatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
                <span className="text-white/40">{openId === t.id ? "−" : "+"}</span>
              </button>
              {openId === t.id && (
                <div className="border-t border-white/10 p-3">
                  <ul className="flex flex-col gap-2">
                    {t.messages.map((m) => (
                      <li key={m.id} className={`rounded-xl px-3 py-2 text-[12px] ${m.isAdmin ? "border border-[#10B981]/30 bg-[#10B981]/10" : "border border-white/10 bg-white/5"}`}>
                        <p className="text-[9px] uppercase tracking-wider text-white/40">{m.isAdmin ? "Support team" : "You"} · {new Date(m.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</p>
                        <p className="mt-1 whitespace-pre-wrap text-white/90">{m.body}</p>
                      </li>
                    ))}
                  </ul>
                  {t.status !== "CLOSED" && (
                    <div className="mt-3 flex gap-2">
                      <input value={openId === t.id ? reply : ""} onChange={(e) => setReply(e.target.value)} placeholder="Reply…" className="flex-1 rounded-xl border border-white/10 bg-[#0B0D19] px-3 py-2 text-sm text-white" />
                      <button type="button" onClick={() => sendReply(t.id)} disabled={busy} className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider hover:bg-white/20 disabled:opacity-50">Send</button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SupportPage;
