"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, LineChart, CartesianGrid,
} from "recharts";

interface AnalyticsResponse {
  dau: number; mau: number;
  daily: { day: string; users: number }[];
  revenueByDay: { day: string; revenue: number }[];
  stateParticipation: { state: string; players: number }[];
  revenue: { totalCollected: number; totalTax: number };
}

const formatINR = (n: number) => `₹${(Math.round((n ?? 0) * 100) / 100).toLocaleString("en-IN")}`;

const AdminAnalyticsPage = () => {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics", { cache: "no-store" }).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json(); setData(j);
    }).catch((err) => setError(err instanceof Error ? err.message : "Failed"))
    .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex h-64 items-center justify-center"><span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" /></div>;
  if (error || !data) return <div className="rounded-xl border border-[#DC2626]/40 bg-[#DC2626]/10 p-4 text-xs text-[#FCA5A5]">{error ?? "No data"}</div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold">Analytics</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Last 30 days</p>
        </div>
        <Link href="/admin" className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:bg-white/10">← Admin</Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="DAU" value={String(data.dau)} accent="#2563EB" icon="📊" />
        <KpiCard label="MAU" value={String(data.mau)} accent="#10B981" icon="📈" />
        <KpiCard label="Revenue" value={formatINR(data.revenue.totalCollected)} accent="#F59E0B" icon="💰" />
        <KpiCard label="GST Collected" value={formatINR(data.revenue.totalTax)} accent="#DC2626" icon="🧾" />
      </div>

      <ChartCard title="Daily Active Users">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data.daily}>
            <CartesianGrid stroke="#1f2347" strokeDasharray="3 3" />
            <XAxis dataKey="day" stroke="#7c83b1" fontSize={10} />
            <YAxis stroke="#7c83b1" fontSize={10} />
            <Tooltip contentStyle={{ background: "#0F1224", border: "1px solid #1f2347", color: "#fff" }} />
            <Line type="monotone" dataKey="users" stroke="#2563EB" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Daily Revenue">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data.revenueByDay}>
            <CartesianGrid stroke="#1f2347" strokeDasharray="3 3" />
            <XAxis dataKey="day" stroke="#7c83b1" fontSize={10} />
            <YAxis stroke="#7c83b1" fontSize={10} />
            <Tooltip contentStyle={{ background: "#0F1224", border: "1px solid #1f2347", color: "#fff" }} formatter={(v: number) => formatINR(v)} />
            <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="State-wise Participation (Top 15)">
        <ResponsiveContainer width="100%" height={Math.max(220, data.stateParticipation.length * 20)}>
          <BarChart data={data.stateParticipation} layout="vertical" margin={{ left: 80 }}>
            <XAxis type="number" stroke="#7c83b1" fontSize={10} />
            <YAxis dataKey="state" type="category" stroke="#7c83b1" fontSize={10} width={80} />
            <Tooltip contentStyle={{ background: "#0F1224", border: "1px solid #1f2347", color: "#fff" }} />
            <Bar dataKey="players" fill="#F59E0B" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};

const KpiCard = ({ label, value, accent, icon }: { label: string; value: string; accent: string; icon: string }) => (
  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#11142A]/80 p-4">
    <div aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-25 blur-2xl" style={{ backgroundColor: accent }} />
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</span>
      <span className="text-base">{icon}</span>
    </div>
    <div className="mt-3 text-2xl font-extrabold tracking-tight text-white">{value}</div>
  </div>
);

const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-white/10 bg-[#0F1224] p-4">
    <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/40">{title}</p>
    {children}
  </section>
);

export default AdminAnalyticsPage;
