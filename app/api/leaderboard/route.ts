import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

interface LeaderboardEntry {
  rank: number;
  submissionId: string;
  userId: string;
  name: string;
  image: string | null;
  state: string | null;
  city: string | null;
  score: number;
  timeTakenMs: number;
  incorrectCount: number;
  submittedAt: string;
  isCurrentUser: boolean;
}

interface LeaderboardResponse {
  quizId: string;
  quizTitle: string | null;
  scope: { state: string | null };
  total: number;
  entries: LeaderboardEntry[];
}

interface ErrorResponse {
  error: string;
}

export async function GET(
  req: NextRequest
): Promise<NextResponse<LeaderboardResponse | ErrorResponse>> {
  // 1) AUTH
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) PARAMS
  const url = new URL(req.url);
  const quizId = url.searchParams.get("quizId")?.trim() || "";
  const stateFilter = url.searchParams.get("state")?.trim() || "";

  if (!quizId) {
    return NextResponse.json(
      { error: "quizId query parameter is required." },
      { status: 400 }
    );
  }

  try {
    // 3) Quiz validation
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: { id: true, title: true },
    });
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
    }

    // 4) Current user (to mark "you" in board)
    const me = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    // 5) Query top 50 submissions for this quiz with optional state scope
    const submissions = await prisma.submission.findMany({
      where: {
        quizId: quiz.id,
        ...(stateFilter
          ? { user: { is: { state: stateFilter } } }
          : {}),
      },
      orderBy: [
        { score: "desc" },
        { timeTakenMs: "asc" },
        { incorrectCount: "asc" },
        { submittedAt: "asc" },
      ],
      take: 50,
      select: {
        id: true,
        userId: true,
        score: true,
        timeTakenMs: true,
        incorrectCount: true,
        submittedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            state: true,
            city: true,
          },
        },
      },
    });

    const total = await prisma.submission.count({
      where: {
        quizId: quiz.id,
        ...(stateFilter ? { user: { is: { state: stateFilter } } } : {}),
      },
    });

    const entries: LeaderboardEntry[] = submissions.map((s, idx) => ({
      rank: idx + 1,
      submissionId: s.id,
      userId: s.user.id,
      name: s.user.name ?? "Player",
      image: s.user.image ?? null,
      state: s.user.state ?? null,
      city: s.user.city ?? null,
      score: s.score,
      timeTakenMs: s.timeTakenMs,
      incorrectCount: s.incorrectCount,
      submittedAt: s.submittedAt.toISOString(),
      isCurrentUser: !!me && me.id === s.userId,
    }));

    const payload: LeaderboardResponse = {
      quizId: quiz.id,
      quizTitle: quiz.title,
      scope: { state: stateFilter || null },
      total,
      entries,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("[GET /api/leaderboard] Failed:", err);
    return NextResponse.json(
      { error: "Failed to load leaderboard." },
      { status: 500 }
    );
  }
}
