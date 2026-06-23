"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

interface OrderManifest {
  orderId: string;
  amount: number; // paisa
  currency: "INR";
  keyId: string;
  baseAmount: number;
  taxAmount: number;
  totalPaid: number;
  collectGst: boolean;
  quiz: { id: string; title: string; entryFee: number };
  paymentId: string;
}

interface RazorpayPaymentSuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  image?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string; backdrop_color?: string };
  handler: (response: RazorpayPaymentSuccess) => void;
  modal?: { ondismiss?: () => void; escape?: boolean; backdropclose?: boolean };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
}

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

/* ------------------------------------------------------------------ */
/*  SCRIPT LOADER                                                      */
/* ------------------------------------------------------------------ */

const RAZORPAY_SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

const loadRazorpayScript = (): Promise<boolean> =>
  new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${RAZORPAY_SCRIPT_SRC}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      // If already loaded but flag missed, re-check shortly.
      if (window.Razorpay) resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

/* ------------------------------------------------------------------ */
/*  HOOK                                                               */
/* ------------------------------------------------------------------ */

interface UseRazorpayCheckoutReturn {
  handleJoinQuiz: (quizId: string) => Promise<void>;
  loading: boolean;
  loadingQuizId: string | null;
  error: string | null;
  clearError: () => void;
}

export const useRazorpayCheckout = (): UseRazorpayCheckoutReturn => {
  const { data: session } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState<boolean>(false);
  const [loadingQuizId, setLoadingQuizId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef<boolean>(false);

  const clearError = useCallback(() => setError(null), []);

  const reset = useCallback(() => {
    inFlight.current = false;
    setLoading(false);
    setLoadingQuizId(null);
  }, []);

  const handleJoinQuiz = useCallback(
    async (quizId: string): Promise<void> => {
      if (!quizId) {
        setError("Missing quiz reference.");
        return;
      }
      if (inFlight.current) return;

      inFlight.current = true;
      setLoading(true);
      setLoadingQuizId(quizId);
      setError(null);

      try {
        // 1) Ensure SDK is on the page
        const ok = await loadRazorpayScript();
        if (!ok || !window.Razorpay) {
          throw new Error(
            "Unable to load secure payment gateway. Please check your network."
          );
        }

        // 2) Create order on backend
        const orderRes = await fetch("/api/payments/razorpay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quizId }),
        });

        if (!orderRes.ok) {
          const errBody: { error?: string } = await orderRes
            .json()
            .catch(() => ({}));
          throw new Error(
            errBody?.error ??
              `Order creation failed (HTTP ${orderRes.status}).`
          );
        }

        const manifest: OrderManifest = await orderRes.json();
        const { orderId, amount, keyId, quiz } = manifest;
        if (!orderId || !amount || !keyId) {
          throw new Error("Invalid order manifest received from server.");
        }

        // 3) Open Razorpay modal
        const options: RazorpayOptions = {
          key: keyId,
          amount,
          currency: "INR",
          name: "QuizMasters India",
          description: `Entry: ${quiz.title}`,
          order_id: orderId,
          image: "/logo.png",
          prefill: {
            name: session?.user?.name ?? undefined,
            email: session?.user?.email ?? undefined,
          },
          notes: {
            quizId: quiz.id,
            paymentId: manifest.paymentId,
          },
          theme: {
            color: "#0B0D19",
            backdrop_color: "#0B0D19",
          },
          modal: {
            escape: true,
            backdropclose: false,
            ondismiss: () => {
              reset();
            },
          },
          handler: async (response: RazorpayPaymentSuccess) => {
            try {
              const verifyRes = await fetch("/api/payments/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  quizId: quiz.id,
                  paymentId: manifest.paymentId,
                }),
              });

              if (!verifyRes.ok) {
                const errBody: { error?: string } = await verifyRes
                  .json()
                  .catch(() => ({}));
                throw new Error(
                  errBody?.error ??
                    `Payment verification failed (HTTP ${verifyRes.status}).`
                );
              }

              // Success — push user into the live quiz arena
              router.push(`/quiz/${quiz.id}`);
              router.refresh();
            } catch (verifyErr) {
              const msg =
                verifyErr instanceof Error
                  ? verifyErr.message
                  : "Payment verification failed.";
              setError(msg);
              if (typeof window !== "undefined") {
                window.alert(msg);
              }
            } finally {
              reset();
            }
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (...args: unknown[]) => {
          const evt = args[0] as { error?: { description?: string } } | undefined;
          const msg =
            evt?.error?.description ?? "Payment failed. Please try again.";
          setError(msg);
          if (typeof window !== "undefined") window.alert(msg);
          reset();
        });
        rzp.open();
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Unexpected error initiating payment.";
        setError(msg);
        if (typeof window !== "undefined") window.alert(msg);
        reset();
      }
    },
    [router, session, reset]
  );

  return { handleJoinQuiz, loading, loadingQuizId, error, clearError };
};

export default useRazorpayCheckout;
