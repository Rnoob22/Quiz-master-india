"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

interface UserRow {
  id: string;
  email: string;
  name: string;
  image: string | null;
  state: string | null;
  city: string | null;
  preferredLanguage: string;
  createdAt: string;
  submissions: number;
  successfulPayments: number;
}

const AdminUsersPage = () => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState<string>("");

  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (q.trim()) qs.set("q", q.trim());
        const res = await fetch(`/api/admin/users?${qs.toString()}`, {
          cache: "no-store",
          signal: ctl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { users: UserRow[] } = await res.json();
        setUsers(data.users ?? []);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("[AdminUsers] load failed:", err);
        setError(err instanceof Error ? err.message : "Failed to load users.");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      ctl.abort();
      clearTimeout(t);
    };
  }, [q]);

  const summary = useMemo(
    () => ({
      total: users.length,
      withSubmissions: users.filter((u) => u.submissions > 0).length,
    }),
    [users]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold leading-tight">Registered Users</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            {summary.total} shown · {summary.withSubmissions} active
          </p>
        </div>
      </div>

      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, email, state, city…"
        className="w-full rounded-xl border border-white/10 bg-[#0F1224] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/40"
      />

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

      {!loading && users.length === 0 && !error && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <p className="text-4xl">👥</p>
          <p className="mt-3 text-sm font-bold text-white">No users yet</p>
          <p className="mt-1 text-xs text-white/50">Players will appear here once they sign in.</p>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {users.map((u) => (
          <li key={u.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0F1224] px-3 py-3">
            <div className="shrink-0 rounded-full p-[1.5px] bg-[linear-gradient(135deg,#2563EB,#10B981)]">
              <div className="overflow-hidden rounded-full bg-[#0B0D19] p-[2px]">
                {u.image ? (
                  <Image src={u.image} alt={u.name} width={36} height={36} className="h-9 w-9 rounded-full object-cover" unoptimized />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#11142A] text-xs font-bold text-white/80">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{u.name}</p>
              <p className="truncate text-[11px] text-white/50">{u.email}</p>
              <p className="truncate text-[10px] uppercase tracking-wider text-white/40">
                {u.state ?? "—"}{u.city ? ` · ${u.city}` : ""} · {u.preferredLanguage}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Plays</p>
              <p className="text-sm font-bold text-white">{u.submissions}</p>
              {u.successfulPayments > 0 && (
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-[#6EE7B7]">
                  {u.successfulPayments} paid
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminUsersPage;
