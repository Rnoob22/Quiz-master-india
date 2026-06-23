import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import Razorpay from "razorpay";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

interface CreateOrderPayload {
  quizId?: string;
}

interface RazorpayOrderResponse {
  orderId: string;
  amount: number; // in paisa
  currency: "INR";
  keyId: string;
  baseAmount: number;
  taxAmount: number;
  totalPaid: number;
  collectGst: boolean;
  quiz: {
    id: string;
    title: string;
    entryFee: number;
  };
  paymentId: string;
}

interface ErrorResponse {
  error: string;
}

const GST_RATE = 0.18;

const toPaisa = (rupees: number): number => Math.round(rupees * 100);

const round2 = (n: number): number => Math.round(n * 100) / 100;

let cachedClient: Razorpay | null = null;
const getRazorpayClient = (): Razorpay => {
  if (cachedClient) return cachedClient;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    throw new Error("Razorpay credentials are not configured.");
  }
  cachedClient = new Razorpay({ key_id, key_secret });
  return cachedClient;
};

export async function POST(
  req: NextRequest
): Promise<NextResponse<RazorpayOrderResponse | ErrorResponse>> {
  // 1) AUTH
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) PAYLOAD
  let payload: CreateOrderPayload;
  try {
    payload = (await req.json()) as CreateOrderPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const quizId = payload?.quizId?.trim();
  if (!quizId) {
    return NextResponse.json({ error: "quizId is required." }, { status: 400 });
  }

  try {
    // 3) RESOLVE USER
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // 4) RESOLVE & VALIDATE QUIZ
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: {
        id: true,
        title: true,
        entryFee: true,
        collectGst: true,
        status: true,
        maxParticipants: true,
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found." }, { status: 400 });
    }
    if (quiz.status !== "LIVE") {
      return NextResponse.json(
        { error: "This quiz is not currently open for entries." },
        { status: 400 }
      );
    }
    if (quiz.entryFee <= 0) {
      return NextResponse.json(
        { error: "This quiz does not require a paid entry." },
        { status: 400 }
      );
    }

    // 5) GST / AMOUNT MATH
    const baseAmount = round2(quiz.entryFee);
    const taxAmount = quiz.collectGst ? round2(baseAmount * GST_RATE) : 0.0;
    const totalPaid = round2(baseAmount + taxAmount);
    const amountInPaisa = toPaisa(totalPaid);

    if (!Number.isFinite(amountInPaisa) || amountInPaisa < 100) {
      return NextResponse.json(
        { error: "Computed order amount is invalid." },
        { status: 400 }
      );
    }

    // 6) RAZORPAY ORDER (receipt max length is 40 chars per Razorpay spec)
    const razorpay = getRazorpayClient();
    const receipt = `qm_${quiz.id.slice(0, 8)}_${Date.now().toString(36)}`.slice(0, 40);

    const order = await razorpay.orders.create({
      amount: amountInPaisa,
      currency: "INR",
      receipt,
      notes: {
        quizId: quiz.id,
        userId: user.id,
        collectGst: quiz.collectGst ? "true" : "false",
      },
    });

    if (!order?.id) {
      return NextResponse.json(
        { error: "Failed to create Razorpay order." },
        { status: 502 }
      );
    }

    // 7) PERSIST PENDING PAYMENT LOCK
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        quizId: quiz.id,
        razorpayOrderId: order.id,
        status: "PENDING",
        baseAmount,
        taxAmount,
        totalPaid,
      },
      select: { id: true },
    });

    const responseBody: RazorpayOrderResponse = {
      orderId: order.id,
      amount: amountInPaisa,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID as string,
      baseAmount,
      taxAmount,
      totalPaid,
      collectGst: quiz.collectGst,
      quiz: {
        id: quiz.id,
        title: quiz.title,
        entryFee: quiz.entryFee,
      },
      paymentId: payment.id,
    };

    return NextResponse.json(responseBody, { status: 201 });
  } catch (err) {
    console.error("[POST /api/payments/razorpay] Failed:", err);
    const message =
      err instanceof Error ? err.message : "Failed to create payment order.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
