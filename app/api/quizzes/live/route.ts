import { NextResponse } from "next/server";
import prisma from "@/lib/db";

interface LiveQuizDTO {
  id: string;
  title: string;
  startTime: string;
  durationSeconds: number;
  entryFee: number;
  totalPrizePool: number;
  maxParticipants: number;
  collectGst: boolean;
  status: "DRAFT" | "LIVE" | "COMPLETED";
}

export async function GET(): Promise<NextResponse<LiveQuizDTO[] | { error: string }>> {
  try {
    const quiz = await prisma.quiz.findFirst({
      where: { status: "LIVE" },
      orderBy: { startTime: "asc" },
      select: {
        id: true,
        title: true,
        startTime: true,
        durationSeconds: true,
        entryFee: true,
        totalPrizePool: true,
        maxParticipants: true,
        collectGst: true,
        status: true,
      },
    });

    if (!quiz) {
      return NextResponse.json([], { status: 200 });
    }

    const dto: LiveQuizDTO = {
      id: quiz.id,
      title: quiz.title,
      startTime: quiz.startTime.toISOString(),
      durationSeconds: quiz.durationSeconds,
      entryFee: quiz.entryFee,
      totalPrizePool: quiz.totalPrizePool,
      maxParticipants: quiz.maxParticipants,
      collectGst: quiz.collectGst,
      status: quiz.status,
    };

    return NextResponse.json([dto], { status: 200 });
  } catch (err) {
    console.error("[GET /api/quizzes/live] Failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch live quizzes." },
      { status: 500 }
    );
  }
}
