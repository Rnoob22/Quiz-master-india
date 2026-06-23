"use client";

import { useEffect } from "react";

const computeFingerprint = (): string => {
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

  // Hash via djb2 (fast, collision-resistant enough for fingerprint id)
  const joined = parts.join("|");
  let hash = 5381;
  for (let i = 0; i < joined.length; i += 1) {
    hash = (hash * 33) ^ joined.charCodeAt(i);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `qm_${hex}_${parts[2]}`;
};

export const useDeviceFingerprint = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const key = "qm_fp_v1";
    let fp = "";
    try {
      fp = window.localStorage.getItem(key) ?? "";
    } catch {
      /* ignore */
    }
    if (!fp) {
      fp = computeFingerprint();
      try {
        window.localStorage.setItem(key, fp);
      } catch {
        /* ignore */
      }
    }
    if (!fp) return;

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
