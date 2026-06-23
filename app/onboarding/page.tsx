"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const INDIAN_STATES: string[] = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

interface FormState {
  dob: string;
  state: string;
  city: string;
}

const OnboardingPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [checkingProfile, setCheckingProfile] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    dob: "",
    state: "",
    city: "",
  });

  // Auth guard
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  // Profile completeness guard
  useEffect(() => {
    const fetchProfile = async () => {
      if (status !== "authenticated") return;
      try {
        const res = await fetch("/api/user/me", { cache: "no-store" });
        if (!res.ok) {
          setCheckingProfile(false);
          return;
        }
        const data: {
          dob?: string | null;
          state?: string | null;
          city?: string | null;
        } = await res.json();

        if (data?.dob && data?.state && data?.city) {
          router.replace("/dashboard");
          return;
        }
        // Pre-fill any existing partial data
        setForm((prev) => ({
          dob: data?.dob ? data.dob.substring(0, 10) : prev.dob,
          state: data?.state ?? prev.state,
          city: data?.city ?? prev.city,
        }));
        setCheckingProfile(false);
      } catch (err) {
        console.error("[Onboarding] Profile fetch failed:", err);
        setCheckingProfile(false);
      }
    };
    fetchProfile();
  }, [status, router]);

  const isValid = useMemo<boolean>(() => {
    return Boolean(form.dob && form.state && form.city.trim().length >= 2);
  }, [form]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dob: form.dob,
          state: form.state,
          city: form.city.trim(),
        }),
      });
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to save profile.");
      }
      router.replace("/dashboard");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setSubmitting(false);
    }
  };

  if (status === "loading" || checkingProfile) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full flex-col px-6 py-10">
      {/* Ambient glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[#2563EB] opacity-20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[#F59E0B] opacity-15 blur-3xl"
      />

      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">
          Step 1 of 1
        </p>
        <h1 className="mt-2 bg-[linear-gradient(135deg,#2563EB,#F59E0B_55%,#10B981)] bg-clip-text text-2xl font-extrabold leading-tight tracking-tight text-transparent">
          Complete your profile
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          We need a few details before you can enter live quizzes and claim
          prizes.
        </p>
      </div>

      {/* Form Card */}
      <form
        onSubmit={handleSubmit}
        className="
          relative flex-1 rounded-3xl p-[1.5px]
          bg-[linear-gradient(135deg,#2563EB_0%,#DC2626_33%,#F59E0B_66%,#10B981_100%)]
          shadow-[0_20px_60px_-20px_rgba(37,99,235,0.4)]
        "
      >
        <div className="flex h-full flex-col gap-5 rounded-3xl bg-[#0F1224] p-6">
          {/* DOB */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="dob"
              className="text-xs font-semibold uppercase tracking-wider text-white/70"
            >
              Date of Birth
            </label>
            <input
              id="dob"
              name="dob"
              type="date"
              required
              value={form.dob}
              onChange={(e) => setForm({ ...form, dob: e.target.value })}
              max={new Date().toISOString().substring(0, 10)}
              className="
                w-full rounded-xl border border-white/10 bg-[#0B0D19]
                px-4 py-3 text-sm text-white outline-none
                placeholder:text-white/30
                focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/40
                [color-scheme:dark]
              "
            />
          </div>

          {/* State */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="state"
              className="text-xs font-semibold uppercase tracking-wider text-white/70"
            >
              State
            </label>
            <select
              id="state"
              name="state"
              required
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="
                w-full rounded-xl border border-white/10 bg-[#0B0D19]
                px-4 py-3 text-sm text-white outline-none
                focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/40
              "
            >
              <option value="" disabled>
                Select your state
              </option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s} className="bg-[#0B0D19]">
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* City */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="city"
              className="text-xs font-semibold uppercase tracking-wider text-white/70"
            >
              City
            </label>
            <input
              id="city"
              name="city"
              type="text"
              required
              autoComplete="address-level2"
              placeholder="e.g. Mumbai"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="
                w-full rounded-xl border border-white/10 bg-[#0B0D19]
                px-4 py-3 text-sm text-white outline-none
                placeholder:text-white/30
                focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/40
              "
            />
          </div>

          {error && (
            <div className="rounded-xl border border-[#DC2626]/40 bg-[#DC2626]/10 px-4 py-3 text-xs font-medium text-[#FCA5A5]">
              {error}
            </div>
          )}

          <div className="mt-auto pt-4">
            <button
              type="submit"
              disabled={!isValid || submitting}
              className="
                group relative w-full overflow-hidden rounded-2xl p-[1.5px]
                bg-[linear-gradient(135deg,#2563EB_0%,#DC2626_33%,#F59E0B_66%,#10B981_100%)]
                shadow-[0_10px_40px_-10px_rgba(16,185,129,0.5)]
                transition-transform duration-150 active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-50
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
                {submitting ? (
                  <>
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Continue to Dashboard</span>
                )}
              </span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default OnboardingPage;
