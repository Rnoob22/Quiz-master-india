import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import crypto from "node:crypto";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

interface VerifyPayload {
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  paymentId?: string;
  quizId?: string;
}

interface VerifySuccess {
  success: true;
  paymentId: string;
  quizId: string;
  status: "SUCCESS";
}

interface VerifyError {
  success: false;
  error: string;
}

/**
 * Constant-time string equality to defeat timing attacks on signature checks.
 */
const safeEqual = (a: string, b: string): boolean => {
  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
};

export async function POST(
  req: NextRequest
): Promise<NextResponse<VerifySuccess | VerifyError>> {
  // 1) AUTH GUARD
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 2) PAYLOAD PARSE
  let body: VerifyPayload;
  try {
    body = (await req.json()) as VerifyPayload;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
    paymentId,
  } = body;

  if (
    !razorpay_payment_id ||
    !razorpay_order_id ||
    !razorpay_signature ||
    !paymentId
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Missing required fields (razorpay_payment_id, razorpay_order_id, razorpay_signature, paymentId).",
      },
      { status: 400 }
    );
  }

  // 3) SECRET CHECK
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    console.error("[verify] RAZORPAY_KEY_SECRET is not configured.");
    return NextResponse.json(
      { success: false, error: "Payment gateway is not configured." },
      { status: 500 }
    );
  }

  // 4) HMAC-SHA256 SIGNATURE COMPUTATION
  const payloadString = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(payloadString)
    .digest("hex");

  if (!safeEqual(expectedSignature, razorpay_signature)) {
    // Best-effort: mark this payment as FAILED so it cannot be reused.
    try {
      await prisma.payment.updateMany({
        where: { id: paymentId, status: "PENDING" },
        data: { status: "FAILED" },
      });
    } catch (markErr) {
      console.error("[verify] Failed to mark payment as FAILED:", markErr);
    }

    return NextResponse.json(
      { success: false, error: "Signature verification failed." },
      { status: 400 }
    );
  }

  // 5) ATOMIC STATUS TRANSITION (PENDING -> SUCCESS) + ownership guard
  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found." },
        { status: 404 }
      );
    }

    // Conditional update: only flip if currently PENDING AND owned by this user
    // AND matches the order id we generated. This prevents replay / cross-user attacks.
    const result = await prisma.payment.updateMany({
      where: {
        id: paymentId,
        userId: user.id,
        razorpayOrderId: razorpay_order_id,
        status: "PENDING",
      },
      data: {
        status: "SUCCESS",
        razorpayPaymentId: razorpay_payment_id,
      },
    });

    if (result.count === 0) {
      // Either already processed, or record mismatch.
      const existing = await prisma.payment.findUnique({
        where: { id: paymentId },
        select: { status: true, quizId: true, userId: true },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, error: "Payment record not found." },
          { status: 404 }
        );
      }
      if (existing.userId !== user.id) {
        return NextResponse.json(
          { success: false, error: "Payment does not belong to this user." },
          { status: 403 }
        );
      }
      if (existing.status === "SUCCESS") {
        // Idempotent success path: treat repeated verify calls as OK.
        return NextResponse.json(
          {
            success: true,
            paymentId,
            quizId: existing.quizId,
            status: "SUCCESS",
          },
          { status: 200 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: `Payment cannot be confirmed (current status: ${existing.status}).`,
        },
        { status: 409 }
      );
    }

    const confirmed = await prisma.payment.findUnique({
      where: { id: paymentId },
      select: { quizId: true, totalPaid: true, user: { select: { id: true, email: true, name: true } }, quiz: { select: { title: true } } },
    });

    // Fire-and-forget receipt notification
    if (confirmed?.user?.email) {
      const { notifyByEmail } = await import("@/lib/notifications");
      notifyByEmail(
        confirmed.user.id,
        confirmed.user.email,
        "payment_receipt",
        `Payment receipt – ${confirmed.quiz.title}`,
        `Hi ${confirmed.user.name},\n\nWe've received your entry payment of ₹${confirmed.totalPaid.toLocaleString("en-IN")} for "${confirmed.quiz.title}".\n\nYour spot in the arena is locked in. Good luck!\n\n— QuizMasters India`
      ).catch(() => undefined);
    }

    return NextResponse.json(
      {
        success: true,
        paymentId,
        quizId: confirmed?.quizId ?? "",
        status: "SUCCESS",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[POST /api/payments/verify] Prisma update failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to finalize payment record." },
      { status: 500 }
    );
  }
}
