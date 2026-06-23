import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

interface QuizDeliveryQuestion {
  id: string;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  points: number;
}

interface QuizDeliveryPayload {
  quiz: {
    id: string;
    title: string;
    durationSeconds: number;
    startTime: string | null;
  };
  questions: QuizDeliveryQuestion[];
}

// Server-side gated questions delivery endpoint.
// IMPORTANT: This is the ONLY way the live quiz arena should obtain its
// questions. Returning a 4xx here MUST translate (client-side) into a hard
// block — the previous arena page used to fall back to hard-coded preview
// questions when this endpoint 404'd, which was the payment-bypass root
// cause. Do not relax these checks.
export async function GET(
  _req: Request,
  context: RouteContext
): Promise<NextResponse<QuizDeliveryPayload | { error: string; code?: string }>> {
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
        title: true,
        status: true,
        entryFee: true,
        durationSeconds: true,
        startTime: true,
        competitionEndTime: true,
        questions: {
          select: {
            id: true,
            text: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
            points: true,
            // NOTE: deliberately NOT selecting correctAnswer — answers are
            // scored authoritatively in /api/quiz/submit.
          },
        },
      },
    });

    if (!quiz) {
      return NextResponse.json(
        { error: "Quiz not found", code: "not_found" },
        { status: 404 }
      );
    }
    if (quiz.status !== "LIVE") {
      return NextResponse.json(
        { error: "This quiz is not currently live.", code: "quiz_not_live" },
        { status: 403 }
      );
    }

    const now = new Date();
    if (quiz.competitionEndTime && now >= quiz.competitionEndTime) {
      return NextResponse.json(
        { error: "Competition window has closed.", code: "competition_ended" },
        { status: 403 }
      );
    }

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
    const hasUnconsumedPayment =
      !!successPayment &&
      (!submission || successPayment.createdAt > submission.submittedAt);

    // === STRICT payment gate ===
    if (quiz.entryFee > 0 && !hasUnconsumedPayment) {
      return NextResponse.json(
        {
          error: "Entry fee required before joining this quiz.",
          code: "no_payment",
        },
        { status: 402 }
      );
    }

    if (hasSubmission && !hasUnconsumedPayment) {
      return NextResponse.json(
        {
          error:
            "You've already submitted this quiz. Pay again to retake it.",
          code: "already_submitted",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        durationSeconds: quiz.durationSeconds,
        startTime: quiz.startTime?.toISOString() ?? null,
      },
      questions: quiz.questions,
    });
  } catch (err) {
    console.error("[GET /api/quiz/[id]] failed:", err);
    return NextResponse.json(
      { error: "Failed to load quiz." },
      { status: 500 }
    );
  }
}
