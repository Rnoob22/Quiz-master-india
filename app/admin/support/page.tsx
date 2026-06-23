"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface TMsg { id: string; isAdmin: boolean; body: string; createdAt: string; authorEmail: string }
interface T { id: string; subject: string; category: string; status: string; createdAt: string; updatedAt: string; messages: TMsg[]; user: { id: string; name: string; email: string; image: string | null } }

const STATUS: Record<string, string> = {
  OPEN: "border-[#F59E0B]/40 bg-[#F59E0B]/10 text-[#FCD34D]",
  IN_PROGRESS: "border-[#2563EB]/40 bg-[#2563EB]/10 text-[#93C5FD]",
  RESOLVED: "border-[#10B981]/40 bg-[#10B981]/10 text-[#6EE7B7]",
  CLOSED: "border-white/10 bg-white/5 text-white/60",
};

const AdminSupportPage = () => {
  const [tickets, setTickets] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const r = await fetch(`/api/admin/support${filter ? `?status=${filter}` : ""}`, { cache: "no-store" });
    if (r.ok) { const d = await r.json(); setTickets(d.tickets ?? []); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [filter]);

  const sendReply = async (id: string) => {
    if (!reply.trim()) return;
    setBusy(true);
    await fetch(`/api/support/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: reply }) });
    setReply("");
    await load();
    setBusy(false);
  };

  const setStatus = async (id: string, status: string) => {
    setBusy(true);
    await fetch(`/api/support/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    await load();
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-extrabold">Support Tickets</h1>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {["", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => (
          <button key={s || "all"} type="button" onClick={() => setFilter(s)} className={`shrink-0 rounded-xl border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${filter === s ? "border-white/10 bg-white/10" : "border-white/10 bg-white/5 text-white/60"}`}>{s || "All"}</button>
        ))}
      </div>
      {loading ? <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" /> : (
        <ul className="flex flex-col gap-2">
          {tickets.map((t) => (
            <li key={t.id} className="rounded-2xl border border-white/10 bg-[#0F1224]">
              <button type="button" onClick={() => setOpenId(openId === t.id ? null : t.id)} className="flex w-full items-center gap-3 p-3 text-left">
                <div className="shrink-0 rounded-full p-[1.5px] bg-[linear-gradient(135deg,#2563EB,#10B981)]">
                  <div className="overflow-hidden rounded-full bg-[#0B0D19] p-[2px]">
                    {t.user.image ? <Image src={t.user.image} alt={t.user.name} width={28} height={28} className="h-7 w-7 rounded-full object-cover" unoptimized /> :
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#11142A] text-[10px] font-bold text-white/80">{t.user.name.charAt(0).toUpperCase()}</div>}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{t.subject}</p>
                  <p className="truncate text-[10px] text-white/40">{t.user.name} · {t.category}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STATUS[t.status]}`}>{t.status}</span>
              </button>
              {openId === t.id && (
                <div className="border-t border-white/10 p-3">
                  <ul className="flex flex-col gap-2">
                    {t.messages.map((m) => (
                      <li key={m.id} className={`rounded-xl px-3 py-2 text-[12px] ${m.isAdmin ? "border border-[#10B981]/30 bg-[#10B981]/10" : "border border-white/10 bg-white/5"}`}>
                        <p className="text-[9px] uppercase tracking-wider text-white/40">{m.isAdmin ? "Admin" : m.authorEmail} · {new Date(m.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</p>
                        <p className="mt-1 whitespace-pre-wrap text-white/90">{m.body}</p>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply…" className="flex-1 rounded-xl border border-white/10 bg-[#0B0D19] px-3 py-2 text-sm text-white" />
                    <button type="button" onClick={() => sendReply(t.id)} disabled={busy} className="rounded-xl bg-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider hover:bg-white/20 disabled:opacity-50">Reply</button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((s) => (
                      <button key={s} type="button" onClick={() => setStatus(t.id, s)} disabled={busy || t.status === s} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:bg-white/10 disabled:opacity-40">{s}</button>
                    ))}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminSupportPage;
