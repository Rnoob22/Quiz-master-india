import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export interface EntryCheckResponse {
  quizId: string;
  canPlay: boolean;
  reason:
    | "ok"
    | "already_submitted"
    | "no_payment"
    | "quiz_not_live"
    | "competition_ended"
    | "not_found";
  paymentRequired: boolean;
  hasUnconsumedPayment: boolean;
  hasSubmission: boolean;
  submissionId: string | null;
  message: string;
}

export async function GET(
  _req: Request,
  context: RouteContext
): Promise<NextResponse<EntryCheckResponse | { error: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = await Promise.resolve(context.params);
  const quizId = params?.id?.trim();
  if (!quizId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: {
        id: true,
        status: true,
        entryFee: true,
        competitionEndTime: true,
      },
    });
    if (!quiz) {
      return NextResponse.json(
        {
          quizId,
          canPlay: false,
          reason: "not_found",
          paymentRequired: false,
          hasUnconsumedPayment: false,
          hasSubmission: false,
          submissionId: null,
          message: "Quiz not found.",
        },
        { status: 404 }
      );
    }

    // Pull this user's submission + most-recent SUCCESS payment in parallel
    const [submission, successPayment] = await Promise.all([
      prisma.submission.findFirst({
        where: { userId: user.id, quizId },
        select: { id: true, submittedAt: true },
      }),
      prisma.payment.findFirst({
        where: { userId: user.id, quizId, status: "SUCCESS" },
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true },
      }),
    ]);

    const hasSubmission = !!submission;
    // "Unconsumed" payment = a SUCCESS payment made *after* the last submission (if any)
    const hasUnconsumedPayment =
      !!successPayment &&
      (!submission || successPayment.createdAt > submission.submittedAt);

    // Competition-ended check (you can still START a play any time the quiz is LIVE
    // and within the competition window; if the window is over, block fresh starts)
    const now = new Date();
    const competitionEnded =
      quiz.competitionEndTime && now >= quiz.competitionEndTime;

    if (quiz.status !== "LIVE") {
      return NextResponse.json({
        quizId,
        canPlay: false,
        reason: "quiz_not_live",
        paymentRequired: false,
        hasUnconsumedPayment,
        hasSubmission,
        submissionId: submission?.id ?? null,
        message: "This quiz is not currently live.",
      });
    }

    if (competitionEnded && !hasUnconsumedPayment) {
      return NextResponse.json({
        quizId,
        canPlay: false,
        reason: "competition_ended",
        paymentRequired: false,
        hasUnconsumedPayment,
        hasSubmission,
        submissionId: submission?.id ?? null,
        message: "The competition window has closed.",
      });
    }

    // Already-submitted gate
    if (hasSubmission && !hasUnconsumedPayment) {
      return NextResponse.json({
        quizId,
        canPlay: false,
        reason: "already_submitted",
        paymentRequired: quiz.entryFee > 0,
        hasUnconsumedPayment: false,
        hasSubmission: true,
        submissionId: submission!.id,
        message:
          "You've already submitted this quiz. Pay the entry fee again to retake it.",
      });
    }

    // Payment gate (skip when quiz is free)
    if (quiz.entryFee > 0 && !hasUnconsumedPayment) {
      return NextResponse.json({
        quizId,
        canPlay: false,
        reason: "no_payment",
        paymentRequired: true,
        hasUnconsumedPayment: false,
        hasSubmission,
        submissionId: submission?.id ?? null,
        message: "Entry fee required before joining this quiz.",
      });
    }

    // All gates passed → user may play
    return NextResponse.json({
      quizId,
      canPlay: true,
      reason: "ok",
      paymentRequired: false,
      hasUnconsumedPayment,
      hasSubmission,
      submissionId: submission?.id ?? null,
      message: "Entry granted.",
    });
  } catch (err) {
    console.error("[GET /api/quiz/[id]/entry-check] failed:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
