import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

interface ResultStatsResponse {
  quizId: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  incorrectCount: number;
  timeTakenMs: number;
  submittedAt: string;
  rank: number;
  totalParticipants: number;
  prizeWon: number | null;
}

interface ErrorResponse {
  error: string;
}

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function GET(
  _req: NextRequest,
  context: RouteContext
): Promise<NextResponse<ResultStatsResponse | ErrorResponse>> {
  // 1) AUTH
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) RESOLVE PARAMS (Next 15: params is a Promise; support both for safety)
  const rawParams = await Promise.resolve(context.params);
  const quizId = rawParams?.id?.trim();
  if (!quizId) {
    return NextResponse.json(
      { error: "Quiz id is required." },
      { status: 400 }
    );
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

    // 4) RESOLVE QUIZ
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { id: true, title: true, totalPrizePool: true },
    });
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
    }

    // 5) USER SUBMISSION
    const submission = await prisma.submission.findFirst({
      where: { userId: user.id, quizId: quiz.id },
      select: {
        id: true,
        score: true,
        timeTakenMs: true,
        incorrectCount: true,
        submittedAt: true,
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "No submission found for this quiz." },
        { status: 404 }
      );
    }

    // 6) TOTAL QUESTIONS
    const totalQuestions = await prisma.question.count({
      where: { quizId: quiz.id },
    });

    // 7) 4-TIER TIE-BREAK RANK (count of submissions ranked strictly better)
    const betterCount = await prisma.submission.count({
      where: {
        quizId: quiz.id,
        OR: [
          { score: { gt: submission.score } },
          {
            score: submission.score,
            timeTakenMs: { lt: submission.timeTakenMs },
          },
          {
            score: submission.score,
            timeTakenMs: submission.timeTakenMs,
            incorrectCount: { lt: submission.incorrectCount },
          },
          {
            score: submission.score,
            timeTakenMs: submission.timeTakenMs,
            incorrectCount: submission.incorrectCount,
            submittedAt: { lt: submission.submittedAt },
          },
        ],
      },
    });

    const rank = betterCount + 1;

    // 8) TOTAL PARTICIPANTS
    const totalParticipants = await prisma.submission.count({
      where: { quizId: quiz.id },
    });

    // 9) PRIZE PAYOUT (simple top-3 split for MVP)
    let prizeWon: number | null = null;
    if (quiz.totalPrizePool > 0) {
      if (rank === 1) prizeWon = Math.round(quiz.totalPrizePool * 0.5);
      else if (rank === 2) prizeWon = Math.round(quiz.totalPrizePool * 0.3);
      else if (rank === 3) prizeWon = Math.round(quiz.totalPrizePool * 0.2);
    }

    const payload: ResultStatsResponse = {
      quizId: quiz.id,
      quizTitle: quiz.title,
      score: submission.score,
      totalQuestions,
      incorrectCount: submission.incorrectCount,
      timeTakenMs: submission.timeTakenMs,
      submittedAt: submission.submittedAt.toISOString(),
      rank,
      totalParticipants,
      prizeWon,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("[GET /api/quiz/[id]/result] Failed:", err);
    return NextResponse.json(
      { error: "Failed to compute quiz result." },
      { status: 500 }
    );
  }
}
