"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

interface AdminNavItem {
  href: string;
  label: string;
  short: string;
  icon: ReactNode;
}

const NAV: AdminNavItem[] = [
  {
    href: "/admin",
    label: "Dashboard",
    short: "Home",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    href: "/admin/quizzes",
    label: "Quizzes",
    short: "Quizzes",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d="M4 6h16M4 12h16M4 18h10" />
      </svg>
    ),
  },
  {
    href: "/admin/quiz-create",
    label: "Create Quiz",
    short: "Create",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d="M12 5v14M5 12h14" />
      </svg>
    ),
  },
  {
    href: "/admin/users",
    label: "Users",
    short: "Users",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <circle cx="9" cy="8" r="4" />
        <path d="M2 21a7 7 0 0 1 14 0" />
        <path d="M16 3a4 4 0 0 1 0 8" />
        <path d="M22 21a7 7 0 0 0-5-6.7" />
      </svg>
    ),
  },
  {
    href: "/admin/payments",
    label: "Payments",
    short: "Payments",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <path d="M2 10h20M6 15h3" />
      </svg>
    ),
  },
];

export const AdminNav = () => {
  const pathname = usePathname() ?? "";

  const isActive = (href: string): boolean => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <nav className="sticky top-0 z-30 -mx-5 mb-5 border-b border-white/10 bg-[#0B0D19]/95 px-5 pb-3 pt-2 backdrop-blur-xl">
      <div className="scrollbar-hide flex gap-2 overflow-x-auto">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                active
                  ? "border-white/10 bg-white/5 text-white"
                  : "border-transparent text-white/50 hover:bg-white/5 hover:text-white/80"
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-0 -z-10 rounded-xl bg-[linear-gradient(135deg,rgba(37,99,235,0.25),rgba(16,185,129,0.18))] ring-1 ring-white/10"
                />
              )}
              {item.icon}
              <span>{item.short}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default AdminNav;
