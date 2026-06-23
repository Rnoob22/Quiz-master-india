import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export interface CompetitionStateResponse {
  quizId: string;
  quizTitle: string;
  status: "DRAFT" | "LIVE" | "COMPLETED";
  competitionStartTime: string | null;
  competitionEndTime: string | null;
  serverTime: string;
  isWithinCompetition: boolean;
  hasCompetitionEnded: boolean;
  winnersResolved: boolean;
  manualOverride: boolean;
  totalParticipants: number;
  minParticipantsThreshold: number;
  thresholdMet: boolean;
  totalPrizePool: number;
  topLeader: { name: string; image: string | null; score: number; timeTakenMs: number } | null;
  awaitingAdmin: boolean;
}

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function GET(
  _req: Request,
  context: RouteContext
): Promise<NextResponse<CompetitionStateResponse | { error: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = await Promise.resolve(context.params);
  const id = params?.id?.trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        competitionStartTime: true,
        competitionEndTime: true,
        winnersResolved: true,
        manualOverride: true,
        minParticipantsThreshold: true,
        totalPrizePool: true,
      },
    });
    if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });

    const totalParticipants = await prisma.submission.count({ where: { quizId: id } });
    const now = new Date();
    const start = quiz.competitionStartTime;
    const end = quiz.competitionEndTime;
    const isWithinCompetition = !!start && !!end && now >= start && now < end;
    const hasCompetitionEnded = !!end && now >= end;
    const thresholdMet = totalParticipants >= quiz.minParticipantsThreshold;
    const awaitingAdmin = hasCompetitionEnded && !thresholdMet && !quiz.winnersResolved && !quiz.manualOverride;

    let topLeader: CompetitionStateResponse["topLeader"] = null;
    if (totalParticipants > 0) {
      const top = await prisma.submission.findFirst({
        where: { quizId: id },
        orderBy: [
          { score: "desc" },
          { timeTakenMs: "asc" },
          { incorrectCount: "asc" },
          { submittedAt: "asc" },
        ],
        select: {
          score: true,
          timeTakenMs: true,
          user: { select: { name: true, image: true } },
        },
      });
      if (top) {
        topLeader = {
          name: top.user.name,
          image: top.user.image ?? null,
          score: top.score,
          timeTakenMs: top.timeTakenMs,
        };
      }
    }

    return NextResponse.json({
      quizId: quiz.id,
      quizTitle: quiz.title,
      status: quiz.status,
      competitionStartTime: start ? start.toISOString() : null,
      competitionEndTime: end ? end.toISOString() : null,
      serverTime: now.toISOString(),
      isWithinCompetition,
      hasCompetitionEnded,
      winnersResolved: quiz.winnersResolved,
      manualOverride: quiz.manualOverride,
      totalParticipants,
      minParticipantsThreshold: quiz.minParticipantsThreshold,
      thresholdMet,
      totalPrizePool: quiz.totalPrizePool,
      topLeader,
      awaitingAdmin,
    });
  } catch (err) {
    console.error("[GET /api/quiz/[id]/competition] failed:", err);
    return NextResponse.json({ error: "Failed to compute competition state." }, { status: 500 });
  }
}
