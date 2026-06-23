import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

interface RouteContext { params: Promise<{ id: string }> | { id: string } }

const adminEmails = (): string[] =>
  (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const isAdmin = (email?: string | null): boolean =>
  !!email && adminEmails().includes(email.toLowerCase());

const TDS_RATE = 0.30; // 30% TDS on prize winnings per Section 194B
const PAYOUT_SPLITS: Record<number, number> = { 1: 0.5, 2: 0.3, 3: 0.2 };

/**
 * Resolve winners for a quiz:
 *  - Auto: called by anyone authenticated only if competition window ended AND threshold met.
 *  - Manual: called by admin to override threshold gate.
 * Locks the leaderboard, creates PrizeClaim rows for top 3, marks winnersResolved.
 */
export async function POST(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await Promise.resolve(context.params);
  const id = params?.id?.trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const isManualRequest: boolean = body?.manual === true;
  const adminCaller = isAdmin(session.user.email);

  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        competitionEndTime: true,
        winnersResolved: true,
        minParticipantsThreshold: true,
        totalPrizePool: true,
      },
    });
    if (!quiz) return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    if (quiz.winnersResolved) {
      return NextResponse.json({ success: true, alreadyResolved: true });
    }

    const now = new Date();
    const ended = quiz.competitionEndTime ? now >= quiz.competitionEndTime : false;
    if (!ended && !isManualRequest) {
      return NextResponse.json(
        { error: "Competition window has not ended yet." },
        { status: 400 }
      );
    }
    if (isManualRequest && !adminCaller) {
      return NextResponse.json({ error: "Admin override requires admin account." }, { status: 403 });
    }

    const totalParticipants = await prisma.submission.count({ where: { quizId: id } });
    const thresholdMet = totalParticipants >= quiz.minParticipantsThreshold;

    if (!thresholdMet && !isManualRequest) {
      return NextResponse.json({
        success: false,
        awaitingAdmin: true,
        totalParticipants,
        threshold: quiz.minParticipantsThreshold,
        message: "Winner will be announced soon by the admin.",
      });
    }

    // Pull top 3 using composite tie-break ordering
    const top = await prisma.submission.findMany({
      where: { quizId: id },
      orderBy: [
        { score: "desc" },
        { timeTakenMs: "asc" },
        { incorrectCount: "asc" },
        { submittedAt: "asc" },
      ],
      take: 3,
      select: { id: true, userId: true, score: true },
    });

    const pool = quiz.totalPrizePool;
    const claims = await prisma.$transaction(async (tx) => {
      const created: { rank: number; userId: string; gross: number; tds: number; net: number }[] = [];
      for (let i = 0; i < top.length; i += 1) {
        const rank = i + 1;
        const split = PAYOUT_SPLITS[rank] ?? 0;
        const gross = Math.round(pool * split);
        const tds = Math.round(gross * TDS_RATE);
        const net = gross - tds;
        await tx.prizeClaim.upsert({
          where: { userId_quizId: { userId: top[i].userId, quizId: id } },
          update: { rank, grossAmount: gross, tdsAmount: tds, netAmount: net, status: "PENDING" },
          create: {
            userId: top[i].userId,
            quizId: id,
            rank,
            grossAmount: gross,
            tdsAmount: tds,
            netAmount: net,
            status: "PENDING",
          },
        });
        created.push({ rank, userId: top[i].userId, gross, tds, net });
      }
      await tx.quiz.update({
        where: { id },
        data: {
          winnersResolved: true,
          winnersResolvedAt: new Date(),
          manualOverride: isManualRequest,
          status: "COMPLETED",
        },
      });
      return created;
    });

    return NextResponse.json({
      success: true,
      totalParticipants,
      thresholdMet,
      manualOverride: isManualRequest,
      claims,
    });
  } catch (err) {
    console.error("[POST /api/quiz/[id]/resolve] failed:", err);
    return NextResponse.json({ error: "Failed to resolve winners." }, { status: 500 });
  }
}
