"use client";

import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import AdminNav from "@/components/admin/AdminNav";

interface AdminLayoutProps {
  children: ReactNode;
}

type AccessState = "checking" | "ok" | "unauth" | "forbidden";

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const [access, setAccess] = useState<AccessState>("checking");

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      setAccess("unauth");
      router.replace("/login");
      return;
    }
    if (authStatus !== "authenticated") return;

    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/stats", { cache: "no-store" });
        if (!active) return;
        if (res.ok) {
          setAccess("ok");
        } else if (res.status === 403) {
          setAccess("forbidden");
        } else if (res.status === 401) {
          setAccess("unauth");
          router.replace("/login");
        } else {
          setAccess("forbidden");
        }
      } catch (err) {
        console.error("[AdminLayout] gate check failed:", err);
        if (active) setAccess("forbidden");
      }
    })();
    return () => {
      active = false;
    };
  }, [authStatus, router]);

  if (authStatus === "loading" || access === "checking") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-[#0B0D19]">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  if (access === "forbidden") {
    return (
      <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#0B0D19] px-6 text-center">
        <div className="rounded-3xl border border-[#DC2626]/40 bg-[#DC2626]/10 p-8">
          <p className="text-5xl">🚫</p>
          <h1 className="mt-4 text-lg font-extrabold text-white">Admin Access Required</h1>
          <p className="mt-2 max-w-xs text-xs text-white/60">
            Your account is not on the admin whitelist. Contact the platform owner to be added
            to <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/80">ADMIN_EMAILS</code>.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-block rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white/80 hover:bg-white/10"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-[#0B0D19] px-5 pb-10 pt-5 text-white">
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 h-64 w-64 rounded-full bg-[#2563EB] opacity-20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-0 -left-16 h-56 w-56 rounded-full bg-[#10B981] opacity-15 blur-3xl" />

      <AdminNav />

      <div className="relative z-10 flex-1">{children}</div>
    </div>
  );
};

export default AdminLayout;
