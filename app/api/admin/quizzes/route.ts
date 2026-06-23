import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  TYPES                                                              */
/* ------------------------------------------------------------------ */

type QuizStatus = "DRAFT" | "LIVE" | "COMPLETED";
type OptionKey = "A" | "B" | "C" | "D";

interface QuestionInput {
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: OptionKey | string;
  points?: number;
  explanation?: string | null;
}

interface CreateQuizPayload {
  title?: string;
  startTime?: string;
  durationSeconds?: number;
  entryFee?: number;
  totalPrizePool?: number;
  maxParticipants?: number;
  collectGst?: boolean;
  status?: QuizStatus;
  questions?: QuestionInput[];
  competitionStartTime?: string | null;
  competitionEndTime?: string | null;
  minParticipantsThreshold?: number;
}

interface QuizSummary {
  id: string;
  title: string;
  status: QuizStatus;
  startTime: string;
  durationSeconds: number;
  entryFee: number;
  totalPrizePool: number;
  maxParticipants: number;
  collectGst: boolean;
  questionCount: number;
}

interface ErrorResponse {
  error: string;
}

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

const ALLOWED_OPTIONS: OptionKey[] = ["A", "B", "C", "D"];

const adminEmails = (): string[] =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const isAdmin = (email: string | null | undefined): boolean => {
  if (!email) return false;
  const list = adminEmails();
  if (list.length === 0) return false;
  return list.includes(email.toLowerCase());
};

const sanitizeInt = (v: unknown, fallback = 0): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const sanitizeFloat = (v: unknown, fallback = 0): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

/* ------------------------------------------------------------------ */
/*  GET — list quizzes (admin)                                         */
/* ------------------------------------------------------------------ */

export async function GET(): Promise<
  NextResponse<{ quizzes: QuizSummary[] } | ErrorResponse>
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const quizzes = await prisma.quiz.findMany({
      orderBy: { startTime: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        startTime: true,
        durationSeconds: true,
        entryFee: true,
        totalPrizePool: true,
        maxParticipants: true,
        collectGst: true,
        _count: { select: { questions: true } },
      },
    });

    return NextResponse.json({
      quizzes: quizzes.map<QuizSummary>((q) => ({
        id: q.id,
        title: q.title,
        status: q.status as QuizStatus,
        startTime: q.startTime.toISOString(),
        durationSeconds: q.durationSeconds,
        entryFee: q.entryFee,
        totalPrizePool: q.totalPrizePool,
        maxParticipants: q.maxParticipants,
        collectGst: q.collectGst,
        questionCount: q._count.questions,
      })),
    });
  } catch (err) {
    console.error("[GET /api/admin/quizzes] Failed:", err);
    return NextResponse.json(
      { error: "Failed to load quizzes." },
      { status: 500 }
    );
  }
}

/* ------------------------------------------------------------------ */
/*  POST — create quiz + questions in a single transaction             */
/* ------------------------------------------------------------------ */

export async function POST(
  req: NextRequest
): Promise<NextResponse<QuizSummary | ErrorResponse>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: CreateQuizPayload;
  try {
    payload = (await req.json()) as CreateQuizPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400 }
    );
  }

  /* --------------- VALIDATION --------------- */
  const title = payload.title?.trim();
  const startTimeRaw = payload.startTime?.trim();
  if (!title || title.length < 3) {
    return NextResponse.json(
      { error: "Title must be at least 3 characters." },
      { status: 400 }
    );
  }
  if (!startTimeRaw) {
    return NextResponse.json(
      { error: "startTime is required." },
      { status: 400 }
    );
  }
  const startTime = new Date(startTimeRaw);
  if (Number.isNaN(startTime.getTime())) {
    return NextResponse.json(
      { error: "Invalid startTime format." },
      { status: 400 }
    );
  }

  const durationSeconds = sanitizeInt(payload.durationSeconds, 0);
  const entryFee = sanitizeFloat(payload.entryFee, 0);
  const totalPrizePool = sanitizeFloat(payload.totalPrizePool, 0);
  const maxParticipants = sanitizeInt(payload.maxParticipants, 0);
  const collectGst = payload.collectGst === true;
  const competitionStartTime = payload.competitionStartTime ? new Date(payload.competitionStartTime) : null;
  const competitionEndTime = payload.competitionEndTime ? new Date(payload.competitionEndTime) : null;
  const minParticipantsThreshold = Math.max(1, Number(payload.minParticipantsThreshold ?? 1000) || 1000);
  const status: QuizStatus =
    payload.status === "LIVE" || payload.status === "COMPLETED"
      ? payload.status
      : "DRAFT";

  if (durationSeconds < 10 || durationSeconds > 60 * 60 * 4) {
    return NextResponse.json(
      { error: "durationSeconds must be between 10s and 4h." },
      { status: 400 }
    );
  }
  if (entryFee < 0 || totalPrizePool < 0 || maxParticipants < 1) {
    return NextResponse.json(
      {
        error:
          "entryFee/totalPrizePool must be ≥ 0 and maxParticipants must be ≥ 1.",
      },
      { status: 400 }
    );
  }

  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  if (questions.length === 0) {
    return NextResponse.json(
      { error: "At least one question is required." },
      { status: 400 }
    );
  }

  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    if (
      !q?.text?.trim() ||
      !q?.optionA?.trim() ||
      !q?.optionB?.trim() ||
      !q?.optionC?.trim() ||
      !q?.optionD?.trim()
    ) {
      return NextResponse.json(
        { error: `Question ${i + 1} is missing text or options.` },
        { status: 400 }
      );
    }
    const correct = String(q.correctAnswer ?? "").toUpperCase() as OptionKey;
    if (!ALLOWED_OPTIONS.includes(correct)) {
      return NextResponse.json(
        { error: `Question ${i + 1} has invalid correctAnswer.` },
        { status: 400 }
      );
    }
  }

  /* --------------- TRANSACTIONAL WRITE --------------- */
  try {
    const result = await prisma.$transaction(async (tx) => {
      const quiz = await tx.quiz.create({
        data: {
          title,
          startTime,
          durationSeconds,
          entryFee,
          totalPrizePool,
          maxParticipants,
          collectGst,
          status,
        },
        select: {
          id: true,
          title: true,
          status: true,
          startTime: true,
          durationSeconds: true,
          entryFee: true,
          totalPrizePool: true,
          maxParticipants: true,
          collectGst: true,
        },
      });

      const created = await tx.question.createMany({
        data: questions.map((q) => ({
          quizId: quiz.id,
          text: q.text.trim(),
          optionA: q.optionA.trim(),
          optionB: q.optionB.trim(),
          optionC: q.optionC.trim(),
          optionD: q.optionD.trim(),
          correctAnswer: String(q.correctAnswer).toUpperCase(),
          points: Math.max(1, sanitizeInt(q.points, 1)),
          explanation: q.explanation?.trim() || null,
        })),
      });

      return { quiz, questionCount: created.count };
    });

    const summary: QuizSummary = {
      id: result.quiz.id,
      title: result.quiz.title,
      status: result.quiz.status as QuizStatus,
      startTime: result.quiz.startTime.toISOString(),
      durationSeconds: result.quiz.durationSeconds,
      entryFee: result.quiz.entryFee,
      totalPrizePool: result.quiz.totalPrizePool,
      maxParticipants: result.quiz.maxParticipants,
      collectGst: result.quiz.collectGst,
      questionCount: result.questionCount,
    };

    return NextResponse.json(summary, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/quizzes] Failed:", err);
    return NextResponse.json(
      { error: "Failed to create quiz." },
      { status: 500 }
    );
  }
}
