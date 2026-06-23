import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

interface UserStatsResponse {
  totalPlayed: number;
  totalWins: number;
  accuracy: number;
  avgResponseMs: number;
}

interface AggregateRow {
  total_played: bigint | number | null;
  avg_time_ms: number | null;
  accuracy: number | null;
}

interface WinsRow {
  wins: bigint | number | null;
}

const toNumber = (v: bigint | number | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  return typeof v === "bigint" ? Number(v) : v;
};

export async function GET(): Promise<NextResponse<UserStatsResponse | { error: string }>> {
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
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = user.id;

    // Aggregate base metrics: totalPlayed, avgResponseMs, accuracy
    const aggregate = await prisma.$queryRaw<AggregateRow[]>`
      SELECT
        COUNT(*)::bigint AS total_played,
        COALESCE(AVG("timeTakenMs"), 0)::float AS avg_time_ms,
        COALESCE(
          AVG(
            CASE
              WHEN ("score" + "incorrectCount") > 0
              THEN ("score"::float / ("score" + "incorrectCount")::float) * 100.0
              ELSE 0
            END
          ),
          0
        )::float AS accuracy
      FROM "Submission"
      WHERE "userId" = ${userId}
    `;

    const totalPlayed = toNumber(aggregate?.[0]?.total_played ?? 0);
    const avgResponseMs = totalPlayed > 0 ? toNumber(aggregate?.[0]?.avg_time_ms ?? 0) : 0;
    const accuracy = totalPlayed > 0 ? toNumber(aggregate?.[0]?.accuracy ?? 0) : 0;

    // Wins: submissions where the user is the top-ranked entry for that quiz
    // Ranking order: score DESC, timeTakenMs ASC, incorrectCount ASC, submittedAt ASC
    let totalWins = 0;
    if (totalPlayed > 0) {
      const winsRow = await prisma.$queryRaw<WinsRow[]>`
        SELECT COUNT(*)::bigint AS wins
        FROM "Submission" s
        WHERE s."userId" = ${userId}
          AND NOT EXISTS (
            SELECT 1
            FROM "Submission" s2
            WHERE s2."quizId" = s."quizId"
              AND (
                s2."score" > s."score"
                OR (s2."score" = s."score" AND s2."timeTakenMs" < s."timeTakenMs")
                OR (s2."score" = s."score" AND s2."timeTakenMs" = s."timeTakenMs" AND s2."incorrectCount" < s."incorrectCount")
                OR (s2."score" = s."score" AND s2."timeTakenMs" = s."timeTakenMs" AND s2."incorrectCount" = s."incorrectCount" AND s2."submittedAt" < s."submittedAt")
              )
          )
      `;
      totalWins = toNumber(winsRow?.[0]?.wins ?? 0);
    }

    const payload: UserStatsResponse = {
      totalPlayed,
      totalWins,
      accuracy: Math.round(accuracy * 100) / 100,
      avgResponseMs: Math.round(avgResponseMs),
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[GET /api/user/stats] Failed:", err);
    return NextResponse.json(
      { error: "Failed to compute user statistics." },
      { status: 500 }
    );
  }
}
