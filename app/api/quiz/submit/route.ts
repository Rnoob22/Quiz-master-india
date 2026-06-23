import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

interface SubmitPayload {
  quizId?: string;
  score?: number;
  incorrectCount?: number;
  timeTakenMs?: number;
  cheated?: boolean;
  answers?: Record<string, "A" | "B" | "C" | "D">;
  reason?: "completed" | "timeout" | "cheated";
}

interface SubmitSuccess {
  success: true;
  submissionId: string;
  quizId: string;
  score: number;
  incorrectCount: number;
  timeTakenMs: number;
  cheated: boolean;
  duplicate?: boolean;
}

interface SubmitError {
  success: false;
  error: string;
}

const sanitizeInt = (v: unknown, fallback = 0, min = 0, max = 86_400_000): number => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
};

export async function POST(
  req: NextRequest
): Promise<NextResponse<SubmitSuccess | SubmitError>> {
  // 1) AUTH
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  // 2) PARSE
  let body: SubmitPayload;
  try {
    body = (await req.json()) as SubmitPayload;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  const quizId = body?.quizId?.trim();
  if (!quizId) {
    return NextResponse.json(
      { success: false, error: "quizId is required." },
      { status: 400 }
    );
  }

  const cheated = body?.cheated === true || body?.reason === "cheated";
  const rawScore = sanitizeInt(body?.score, 0, 0, 1_000_000);
  const rawIncorrect = sanitizeInt(body?.incorrectCount, 0, 0, 1_000_000);
  const timeTakenMs = sanitizeInt(body?.timeTakenMs, 0, 0, 24 * 60 * 60 * 1000);

  // Anti-cheat enforcement: zero the score if cheating flag is set
  const finalScore = cheated ? 0 : rawScore;
  const finalIncorrect = cheated ? Math.max(rawIncorrect, 0) : rawIncorrect;

  try {
    // 3) RESOLVE USER
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

    // 4) RESOLVE & VALIDATE QUIZ
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { id: true, status: true },
    });
    if (!quiz) {
      return NextResponse.json(
        { success: false, error: "Quiz not found." },
        { status: 404 }
      );
    }
    if (quiz.status === "DRAFT") {
      return NextResponse.json(
        {
          success: false,
          error: "This quiz is not open for submissions yet.",
        },
        { status: 400 }
      );
    }

    // 5) DUPLICATE GUARD
    const existing = await prisma.submission.findFirst({
      where: { userId: user.id, quizId: quiz.id },
      select: {
        id: true,
        score: true,
        incorrectCount: true,
        timeTakenMs: true,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: true,
          submissionId: existing.id,
          quizId: quiz.id,
          score: existing.score,
          incorrectCount: existing.incorrectCount,
          timeTakenMs: existing.timeTakenMs,
          cheated,
          duplicate: true,
        },
        { status: 200 }
      );
    }

    // 6) ATOMIC WRITE
    try {
      const submission = await prisma.submission.create({
        data: {
          userId: user.id,
          quizId: quiz.id,
          score: finalScore,
          incorrectCount: finalIncorrect,
          timeTakenMs,
        },
        select: {
          id: true,
          score: true,
          incorrectCount: true,
          timeTakenMs: true,
        },
      });

      return NextResponse.json(
        {
          success: true,
          submissionId: submission.id,
          quizId: quiz.id,
          score: submission.score,
          incorrectCount: submission.incorrectCount,
          timeTakenMs: submission.timeTakenMs,
          cheated,
        },
        { status: 201 }
      );
    } catch (writeErr) {
      // Gracefully absorb unique/duplicate-style conflicts (e.g. race conditions)
      if (
        writeErr instanceof Prisma.PrismaClientKnownRequestError &&
        (writeErr.code === "P2002" || writeErr.code === "P2003")
      ) {
        const fallback = await prisma.submission.findFirst({
          where: { userId: user.id, quizId: quiz.id },
          select: {
            id: true,
            score: true,
            incorrectCount: true,
            timeTakenMs: true,
          },
        });
        if (fallback) {
          return NextResponse.json(
            {
              success: true,
              submissionId: fallback.id,
              quizId: quiz.id,
              score: fallback.score,
              incorrectCount: fallback.incorrectCount,
              timeTakenMs: fallback.timeTakenMs,
              cheated,
              duplicate: true,
            },
            { status: 200 }
          );
        }
      }
      throw writeErr;
    }
  } catch (err) {
    console.error("[POST /api/quiz/submit] Failed:", err);
    return NextResponse.json(
      { success: false, error: "Failed to record quiz submission." },
      { status: 500 }
    );
  }
}
