"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getOrCreateDeviceFingerprint,
  persistDeviceFingerprintCookie,
} from "@/lib/deviceFingerprint";

/* ------------------------------------------------------------------ */
/*  CONTENT — Civil Services Exam Prep Positioning                     */
/* ------------------------------------------------------------------ */

interface StatTile {
  value: string;
  label: string;
}

const STAT_TILES: StatTile[] = [
  { value: "50,000+", label: "Aspirants Onboard" },
  { value: "25,000+", label: "Exam-Pattern MCQs" },
  { value: "₹10 L+", label: "Scholarships Paid" },
  { value: "4.8 / 5", label: "Aspirant Rating" },
];

const EXAM_PILLS: string[] = [
  "UPSC CSE",
  "KPSC KAS",
  "Karnataka PSC",
  "SSC CGL",
  "RBI Grade B",
  "IBPS / SBI PO",
  "PDO / PSI",
  "FDA / SDA",
];

interface ValueProp {
  title: string;
  body: string;
  Icon: () => React.ReactElement;
}

const VALUE_PROPS: ValueProp[] = [
  {
    title: "Syllabus-Aligned Question Bank",
    body:
      "Every MCQ is mapped to the official UPSC, KPSC and Karnataka PSC syllabus — covering Polity, History, Geography, Economy, Environment, CSAT and Karnataka GK.",
    Icon: () => <BookIcon />,
  },
  {
    title: "All-India & Karnataka Leaderboards",
    body:
      "Benchmark yourself against serious aspirants across India and in your home state. Real exam-style rankings, not gimmicks.",
    Icon: () => <TrophyIcon />,
  },
  {
    title: "Daily Current Affairs Quizzes",
    body:
      "Curated from PIB, The Hindu and Yojana every morning, with detailed explanations and source citations.",
    Icon: () => <NewspaperIcon />,
  },
  {
    title: "Strictly Proctored Quizzes",
    body:
      "Tab-switch and copy-paste are disabled during a live quiz. Fair competition for those who put in the work.",
    Icon: () => <ShieldCheckIcon />,
  },
];

const TODAY_QUIZ = {
  title: "Indian Polity & Constitution — Weekly Mock",
  schedule: "Today · 8:00 PM IST",
  duration: "60 minutes",
  questions: "100 MCQs",
  scholarship: "₹10,000",
  tag: "UPSC CSE Prelims · KPSC KAS",
};

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

const LoginInner = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState<boolean>(false);
  const [fpReady, setFpReady] = useState<boolean>(false);

  const errorCode = params?.get("error") ?? "";

  // Compute device fingerprint and persist it into a cookie *before* the
  // user clicks "Sign in with Google". This cookie is then read by the
  // NextAuth signIn callback to enforce the "One Device, One Account" lock.
  useEffect(() => {
    try {
      const fp = getOrCreateDeviceFingerprint();
      if (fp) persistDeviceFingerprintCookie(fp);
    } catch (err) {
      console.warn("[Login] device fingerprint setup failed:", err);
    } finally {
      setFpReady(true);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  const handleGoogleSignIn = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const fp = getOrCreateDeviceFingerprint();
      if (fp) persistDeviceFingerprintCookie(fp);
    } catch {
      /* ignore */
    }
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch (err) {
      console.error("[Login] signIn failed:", err);
      setLoading(false);
    }
  };

  const isMultiDeviceError = errorCode === "MULTIPLE_DEVICE_LOGIN";
  const isGenericError =
    !!errorCode && !isMultiDeviceError && errorCode !== "AccessDenied";

  return (
    <div className="relative flex w-full flex-col px-5 pb-10">
      {/* ============================================================
          Subtle backdrop accents — muted, exam-prep tone (not gamey).
          ============================================================ */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#1E3A8A] opacity-30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 -right-24 h-72 w-72 rounded-full bg-[#F59E0B] opacity-[0.08] blur-3xl"
      />

      {/* =============== Top Trust Strip =============== */}
      <div className="mt-4 flex items-center justify-center gap-2 rounded-full border border-[#10B981]/25 bg-[#10B981]/[0.07] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6EE7B7]">
        <ShieldCheckIcon />
        <span>KYC Verified · Razorpay Secured · Trusted Platform</span>
      </div>

      {/* =============== Brand Block =============== */}
      <div className="mt-8 flex flex-col items-center text-center">
        <div className="relative">
          <div
            className="
              flex h-20 w-20 items-center justify-center rounded-2xl
              bg-[linear-gradient(135deg,#1E3A8A_0%,#3B82F6_50%,#F59E0B_100%)]
              shadow-[0_15px_50px_-15px_rgba(59,130,246,0.6)]
              ring-1 ring-white/10
            "
          >
            <span className="text-3xl font-black tracking-tight text-white drop-shadow">
              Q
            </span>
          </div>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-2xl bg-white/5 blur-2xl"
          />
        </div>

        <h1 className="mt-5 bg-[linear-gradient(135deg,#FFFFFF_0%,#FFFFFF_55%,#F59E0B_100%)] bg-clip-text text-[26px] font-extrabold leading-tight tracking-tight text-transparent">
          QuizMasters India
        </h1>

        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.34em] text-white/55">
          UPSC <span className="text-[#F59E0B]">·</span> KPSC{" "}
          <span className="text-[#F59E0B]">·</span> STATE PSC
        </p>

        <p className="mt-5 max-w-[20rem] text-[15px] font-semibold leading-snug text-white">
          A serious quiz platform for India&apos;s civil services aspirants.
        </p>
        <p className="mt-2 max-w-[22rem] text-[13px] leading-relaxed text-white/60">
          Practice exam-pattern MCQs, benchmark on the all-India leaderboard,
          and earn merit-based cash scholarships — built for KPSC, UPSC and
          state PSC preparation.
        </p>
      </div>

      {/* =============== Stat Grid =============== */}
      <div className="mt-7 grid grid-cols-2 gap-3">
        {STAT_TILES.map((s) => (
          <StatCard key={s.label} value={s.value} label={s.label} />
        ))}
      </div>

      {/* =============== Exam Coverage Pills =============== */}
      <section className="mt-8">
        <SectionLabel>Designed for these exams</SectionLabel>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAM_PILLS.map((p) => (
            <span
              key={p}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold tracking-wide text-white/80"
            >
              {p}
            </span>
          ))}
        </div>
      </section>

      {/* =============== Today's Featured Live Quiz =============== */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <SectionLabel>Today&apos;s Featured Quiz</SectionLabel>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#FCA5A5]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#DC2626] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#DC2626]" />
            </span>
            Live Today
          </span>
        </div>

        <div className="mt-3 rounded-2xl p-[1px] bg-[linear-gradient(135deg,#1E3A8A_0%,#3B82F6_45%,#F59E0B_100%)] shadow-[0_15px_45px_-20px_rgba(59,130,246,0.45)]">
          <div className="rounded-2xl bg-[#0F1224] p-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#FCD34D]">
              {TODAY_QUIZ.tag}
            </p>
            <h3 className="mt-1.5 text-[15px] font-extrabold leading-snug text-white">
              {TODAY_QUIZ.title}
            </h3>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <FactCell label="Starts" value={TODAY_QUIZ.schedule} />
              <FactCell label="Duration" value={TODAY_QUIZ.duration} />
              <FactCell label="Questions" value={TODAY_QUIZ.questions} />
            </div>

            <div className="mt-3 flex items-center justify-between rounded-xl border border-[#F59E0B]/25 bg-[#F59E0B]/[0.08] px-3 py-2.5">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#FCD34D]">
                  Top Scholarship
                </p>
                <p className="mt-0.5 text-lg font-extrabold text-white">
                  {TODAY_QUIZ.scholarship}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-white/40">
                  Sign in to
                </p>
                <p className="text-[11px] font-semibold text-white">
                  Register Free
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =============== Why Aspirants Choose Us =============== */}
      <section className="mt-8">
        <SectionLabel>Why serious aspirants choose us</SectionLabel>
        <div className="mt-3 flex flex-col gap-2.5">
          {VALUE_PROPS.map((vp) => (
            <ValuePropRow
              key={vp.title}
              title={vp.title}
              body={vp.body}
              Icon={vp.Icon}
            />
          ))}
        </div>
      </section>

      {/* =============== Aspirant Quote =============== */}
      <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1E3A8A] text-sm font-bold text-white">
            AR
          </div>
          <div className="min-w-0">
            <p className="text-[13px] leading-relaxed text-white/85">
              &ldquo;The Karnataka GK section helped me cover KPSC-specific
              topics that I couldn&apos;t find on any other platform. The
              ranked mocks gave me a clear sense of where I stand.&rdquo;
            </p>
            <p className="mt-2 text-[11px] font-semibold text-white/60">
              Anita R. ·{" "}
              <span className="text-white/40">KAS Aspirant, Bengaluru</span>
            </p>
          </div>
        </div>
      </section>

      {/* =============== Trust Strip =============== */}
      <section className="mt-7 grid grid-cols-3 gap-2">
        <TrustCell label="Razorpay" sub="Secure Payments" />
        <TrustCell label="256-bit" sub="SSL Encrypted" />
        <TrustCell label="PAN India" sub="KYC Compliant" />
      </section>

      {/* =============== Error Banners =============== */}
      {isMultiDeviceError && (
        <div
          role="alert"
          className="mt-7 rounded-2xl border border-[#DC2626]/40 bg-[#DC2626]/10 px-4 py-3"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#DC2626]/20 text-[#FCA5A5]">
              <ShieldIcon />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#FCA5A5]">
                Sign-in blocked: new device detected
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/70">
                For your security, this account is locked to its original
                device. Please sign in from the device you first registered
                with, or contact{" "}
                <Link
                  href="/support"
                  className="text-white underline underline-offset-2"
                >
                  support
                </Link>{" "}
                to reset your device lock.
              </p>
              <p className="mt-2 text-[10px] uppercase tracking-widest text-white/40">
                Error&nbsp;code:&nbsp;MULTIPLE_DEVICE_LOGIN
              </p>
            </div>
          </div>
        </div>
      )}

      {isGenericError && (
        <div
          role="alert"
          className="mt-7 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
        >
          <p className="text-sm font-semibold text-white/90">
            We couldn&apos;t complete your sign-in.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-white/60">
            Please try again. If the problem persists, contact{" "}
            <Link
              href="/support"
              className="text-white underline underline-offset-2"
            >
              support
            </Link>
            .
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-widest text-white/40">
            Error&nbsp;code:&nbsp;{errorCode}
          </p>
        </div>
      )}

      {/* =============== CTA Block =============== */}
      <div className="mt-8">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading || status === "loading" || !fpReady}
          className="
            group relative w-full overflow-hidden rounded-2xl p-[1.5px]
            bg-[linear-gradient(135deg,#1E3A8A_0%,#3B82F6_50%,#F59E0B_100%)]
            shadow-[0_10px_40px_-10px_rgba(59,130,246,0.5)]
            transition-transform duration-150 active:scale-[0.98]
            disabled:cursor-not-allowed disabled:opacity-70
          "
        >
          <span
            className="
              flex w-full items-center justify-center gap-3 rounded-2xl
              bg-[#0B0D19] px-5 py-4
              text-base font-semibold text-white
              transition-colors duration-150 group-hover:bg-[#11142A]
            "
          >
            {loading ? (
              <>
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <span>Connecting securely…</span>
              </>
            ) : (
              <>
                <GoogleIcon />
                <span>Sign in with Google to begin</span>
              </>
            )}
          </span>
        </button>

        <p className="mt-3 text-center text-[11px] text-white/50">
          Free to register · No credit card · Pay only for paid mocks
        </p>

        <p className="mt-3 text-center text-[10px] leading-relaxed text-white/40">
          By continuing, you agree to our{" "}
          <Link
            href="/legal/terms"
            className="text-white/70 underline-offset-2 hover:underline"
          >
            Terms of Service
          </Link>
          ,{" "}
          <Link
            href="/legal/privacy"
            className="text-white/70 underline-offset-2 hover:underline"
          >
            Privacy Policy
          </Link>{" "}
          &amp;{" "}
          <Link
            href="/legal/refund"
            className="text-white/70 underline-offset-2 hover:underline"
          >
            Refund Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
};

const LoginPage = () => {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
};

/* ------------------------------------------------------------------ */
/*  Subcomponents                                                      */
/* ------------------------------------------------------------------ */

const SectionLabel = ({ children }: { children: React.ReactNode }) => {
  return (
    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
      {children}
    </p>
  );
};

const StatCard = ({ value, label }: StatTile) => {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xl font-extrabold leading-tight text-white">{value}</p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-white/50">
        {label}
      </p>
    </div>
  );
};

const FactCell = ({ label, value }: { label: string; value: string }) => {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-left">
      <p className="text-[8px] font-bold uppercase tracking-widest text-white/40">
        {label}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold leading-tight text-white">
        {value}
      </p>
    </div>
  );
};

interface ValuePropRowProps {
  title: string;
  body: string;
  Icon: () => React.ReactElement;
}

const ValuePropRow = ({ title, body, Icon }: ValuePropRowProps) => {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1E3A8A]/40 text-[#93C5FD] ring-1 ring-[#3B82F6]/30">
        <Icon />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-bold leading-tight text-white">
          {title}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-white/60">{body}</p>
      </div>
    </div>
  );
};

const TrustCell = ({ label, sub }: { label: string; sub: string }) => {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-center">
      <p className="text-[11px] font-bold uppercase tracking-wider text-white">
        {label}
      </p>
      <p className="mt-0.5 text-[9px] uppercase tracking-widest text-white/45">
        {sub}
      </p>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

const GoogleIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      className="h-5 w-5"
      aria-hidden
    >
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
};

const ShieldIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
};

const ShieldCheckIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
};

const BookIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
};

const TrophyIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
};

const NewspaperIcon = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" />
      <path d="M15 18h-5" />
      <path d="M10 6h8v4h-8V6Z" />
    </svg>
  );
};

export default LoginPage;
