"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getOrCreateDeviceFingerprint,
  persistDeviceFingerprintCookie,
} from "@/lib/deviceFingerprint";

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
      if (fp) {
        persistDeviceFingerprintCookie(fp);
      }
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
    // Re-persist the cookie right before redirect, in case it was cleared
    // by an extension or expired between mount and click.
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
    <div className="relative flex min-h-screen w-full flex-col items-center justify-between overflow-hidden px-6 py-12">
      {/* Background brand glow accents */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#2563EB] opacity-20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-20 h-72 w-72 rounded-full bg-[#10B981] opacity-15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-20 h-72 w-72 rounded-full bg-[#DC2626] opacity-15 blur-3xl"
      />

      {/* Top spacer */}
      <div className="h-8 w-full" />

      {/* Brand block */}
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="relative mb-6">
          <div
            className="
              flex h-24 w-24 items-center justify-center rounded-3xl
              bg-[linear-gradient(135deg,#2563EB_0%,#DC2626_33%,#F59E0B_66%,#10B981_100%)]
              shadow-[0_10px_50px_-10px_rgba(37,99,235,0.6)]
            "
          >
            <span className="text-4xl font-black tracking-tight text-white drop-shadow">
              Q
            </span>
          </div>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 rounded-3xl bg-white/5 blur-2xl"
          />
        </div>

        <h1 className="bg-[linear-gradient(135deg,#2563EB,#F59E0B_55%,#10B981)] bg-clip-text text-3xl font-extrabold leading-tight tracking-tight text-transparent">
          QuizMasters India
        </h1>

        <p className="mt-3 text-sm font-medium uppercase tracking-[0.35em] text-white/60">
          Learn <span className="text-[#F59E0B]">|</span> Compete{" "}
          <span className="text-[#DC2626]">|</span> Win
        </p>

        <p className="mt-6 max-w-xs text-sm leading-relaxed text-white/50">
          Join India&apos;s premier real-money quiz arena. Test your knowledge,
          climb the leaderboard, and win exciting cash rewards.
        </p>

        {/* Security error banners */}
        {isMultiDeviceError && (
          <div
            role="alert"
            className="mt-6 w-full max-w-sm rounded-2xl border border-[#DC2626]/40 bg-[#DC2626]/10 px-4 py-3 text-left"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#DC2626]/20 text-[#FCA5A5]">
                <ShieldIcon />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#FCA5A5]">
                  Sign-in blocked: New device detected
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
            className="mt-6 w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left"
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
      </div>

      {/* CTA block */}
      <div className="w-full">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading || status === "loading" || !fpReady}
          className="
            group relative w-full overflow-hidden rounded-2xl p-[1.5px]
            bg-[linear-gradient(135deg,#2563EB_0%,#DC2626_33%,#F59E0B_66%,#10B981_100%)]
            shadow-[0_10px_40px_-10px_rgba(37,99,235,0.6)]
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
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <GoogleIcon />
                <span>Continue with Google</span>
              </>
            )}
          </span>
        </button>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-white/40">
          By continuing, you agree to our{" "}
          <Link href="/legal/terms" className="text-white/70 underline-offset-2 hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/legal/privacy" className="text-white/70 underline-offset-2 hover:underline">
            Privacy Policy
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

export default LoginPage;
