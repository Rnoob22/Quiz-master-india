"use client";

import { useEffect } from "react";
import {
  getOrCreateDeviceFingerprint,
  persistDeviceFingerprintCookie,
} from "@/lib/deviceFingerprint";

// Called from authenticated layouts after sign-in to ensure the user's
// fingerprint is locked into their account in the DB. Server-side
// /api/user/device only stores it if it's currently empty, and rejects any
// mismatched device with a 403 + MULTIPLE_DEVICE_LOGIN code.
export const useDeviceFingerprint = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const fp = getOrCreateDeviceFingerprint();
    if (!fp) return;

    // Keep the cookie fresh for any subsequent re-auth flow.
    persistDeviceFingerprintCookie(fp);

    const ctl = new AbortController();
    fetch("/api/user/device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint: fp }),
      signal: ctl.signal,
    }).catch((err) => {
      if ((err as Error).name !== "AbortError") {
        console.warn("[fp] post failed:", err);
      }
    });

    return () => ctl.abort();
  }, [enabled]);
};

export default useDeviceFingerprint;
