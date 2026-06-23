// Shared client-side device fingerprint utility.
// Used by the login page (to set the pre-OAuth cookie) and by the
// useDeviceFingerprint hook (to persist into the user's DB record).
//
// NOTE: This is a lightweight, non-cryptographic fingerprint intended for the
// "One Device, One Account" enforcement layer. It MUST stay deterministic for
// a given browser/device so the NextAuth signIn callback can compare it
// reliably across OAuth redirects.

export const DEVICE_FP_COOKIE = "qm_device_fp";
export const DEVICE_FP_LOCAL_KEY = "qm_fp_v1";

export const computeDeviceFingerprint = (): string => {
  if (typeof window === "undefined") return "";
  const nav = window.navigator;
  const scr = window.screen;
  const parts: string[] = [
    nav.userAgent ?? "",
    nav.language ?? "",
    `${scr.width}x${scr.height}x${scr.colorDepth}`,
    new Date().getTimezoneOffset().toString(),
    (nav.hardwareConcurrency ?? 0).toString(),
  ];

  // Canvas fingerprint (lightweight)
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px 'Arial'";
      ctx.fillStyle = "#069";
      ctx.fillText("QuizMasters\u00A0\u00ae", 2, 2);
      ctx.strokeStyle = "#cc3";
      ctx.strokeRect(10, 20, 100, 18);
      parts.push(canvas.toDataURL().slice(-64));
    }
  } catch {
    /* ignore */
  }

  const joined = parts.join("|");
  let hash = 5381;
  for (let i = 0; i < joined.length; i += 1) {
    hash = (hash * 33) ^ joined.charCodeAt(i);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `qm_${hex}_${parts[2]}`;
};

// Reads cached fingerprint from localStorage if available, otherwise computes
// and caches it. Returns "" when called server-side.
export const getOrCreateDeviceFingerprint = (): string => {
  if (typeof window === "undefined") return "";
  let fp = "";
  try {
    fp = window.localStorage.getItem(DEVICE_FP_LOCAL_KEY) ?? "";
  } catch {
    /* ignore */
  }
  if (!fp) {
    fp = computeDeviceFingerprint();
    try {
      window.localStorage.setItem(DEVICE_FP_LOCAL_KEY, fp);
    } catch {
      /* ignore */
    }
  }
  return fp;
};

// Stores the fingerprint in a cookie so it survives the Google OAuth redirect
// and is readable by the NextAuth signIn callback.
export const persistDeviceFingerprintCookie = (fp: string): void => {
  if (typeof document === "undefined" || !fp) return;
  // 1 hour expiry is more than enough for an OAuth round-trip.
  const maxAge = 60 * 60;
  // SameSite=Lax ensures the cookie is sent on top-level navigations
  // triggered by Google's OAuth redirect back to our domain.
  document.cookie = `${DEVICE_FP_COOKIE}=${encodeURIComponent(
    fp
  )}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
};
