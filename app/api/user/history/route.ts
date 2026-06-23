import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

interface HistoryRow {
  submissionId: string;
  quizId: string;
  quizTitle: string;
  score: number;
  incorrectCount: number;
  timeTakenMs: number;
  submittedAt: string;
  rank: number;
  totalParticipants: number;
}

export async function GET(): Promise<
  NextResponse<{ history: HistoryRow[] } | { error: string }>
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const submissions = await prisma.submission.findMany({
      where: { userId: user.id },
      orderBy: { submittedAt: "desc" },
      take: 50,
      select: {
        id: true,
        score: true,
        incorrectCount: true,
        timeTakenMs: true,
        submittedAt: true,
        quizId: true,
        quiz: { select: { id: true, title: true } },
      },
    });

    if (submissions.length === 0) {
      return NextResponse.json({ history: [] });
    }

    const history: HistoryRow[] = await Promise.all(
      submissions.map(async (s) => {
        const [betterCount, totalParticipants] = await Promise.all([
          prisma.submission.count({
            where: {
              quizId: s.quizId,
              OR: [
                { score: { gt: s.score } },
                { score: s.score, timeTakenMs: { lt: s.timeTakenMs } },
                {
                  score: s.score,
                  timeTakenMs: s.timeTakenMs,
                  incorrectCount: { lt: s.incorrectCount },
                },
                {
                  score: s.score,
                  timeTakenMs: s.timeTakenMs,
                  incorrectCount: s.incorrectCount,
                  submittedAt: { lt: s.submittedAt },
                },
              ],
            },
          }),
          prisma.submission.count({ where: { quizId: s.quizId } }),
        ]);
        return {
          submissionId: s.id,
          quizId: s.quiz.id,
          quizTitle: s.quiz.title,
          score: s.score,
          incorrectCount: s.incorrectCount,
          timeTakenMs: s.timeTakenMs,
          submittedAt: s.submittedAt.toISOString(),
          rank: betterCount + 1,
          totalParticipants,
        };
      })
    );

    return NextResponse.json({ history });
  } catch (err) {
    console.error("[GET /api/user/history] Failed:", err);
    return NextResponse.json(
      { error: "Failed to load history." },
      { status: 500 }
    );
  }
}
