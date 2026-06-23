import Link from "next/link";
import { ReactNode } from "react";

interface LegalLayoutProps {
  title: string;
  updated: string;
  children: ReactNode;
}

export const LegalShell = ({ title, updated, children }: LegalLayoutProps) => {
  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#0B0D19] pb-10 text-white">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[#2563EB] opacity-20 blur-3xl" />
      <header className="relative z-10 px-5 pt-6">
        <Link
          href="/login"
          className="inline-block rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70 hover:bg-white/10"
        >
          ← Back
        </Link>
        <h1 className="mt-4 text-2xl font-extrabold leading-tight">
          <span className="bg-[linear-gradient(135deg,#2563EB,#F59E0B,#10B981)] bg-clip-text text-transparent">{title}</span>
        </h1>
        <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/40">Last updated: {updated}</p>
      </header>
      <article className="relative z-10 mt-6 flex flex-col gap-4 px-5 text-sm leading-relaxed text-white/80">
        {children}
      </article>
    </div>
  );
};

export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section>
    <h2 className="text-xs font-semibold uppercase tracking-[0.25em] text-[#FCD34D]">{title}</h2>
    <div className="mt-2 space-y-2 text-[13px] text-white/70">{children}</div>
  </section>
);
