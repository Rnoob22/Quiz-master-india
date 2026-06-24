import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

type OptionKey = "A" | "B" | "C" | "D";
const ALLOWED: OptionKey[] = ["A", "B", "C", "D"];

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

interface QuestionInput {
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  points?: number;
  explanation?: string | null;
}

const adminEmails = (): string[] =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const isAdmin = (email?: string | null): boolean =>
  !!email && adminEmails().includes(email.toLowerCase());

async function requireAdmin(): Promise<
  { ok: true } | { ok: false; res: NextResponse }
> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  if (!isAdmin(session.user.email)) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return { ok: true };
}

/* -------------------- GET: list questions of a quiz ------------------- */

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const { id } = await params;

  if (!id?.trim()) {
    return NextResponse.json(
      { error: "quiz id required" },
      { status: 400 }
    );
  }

  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: id.trim() },
      select: {
        id: true,
        title: true,
      },
    });

    if (!quiz) {
      return NextResponse.json(
        { error: "Quiz not found" },
        { status: 404 }
      );
    }

    const questions = await prisma.question.findMany({
      where: { quizId: id.trim() },
      orderBy: { id: "asc" },
      select: {
        id: true,
        text: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        correctAnswer: true,
        points: true,
        explanation: true,
      },
    });

    return NextResponse.json({
      quiz,
      questions,
    });
  } catch (err) {
    console.error(
      "[GET /api/admin/quizzes/[id]/questions] Failed:",
      err
    );

    return NextResponse.json(
      { error: "Failed to load questions." },
      { status: 500 }
    );
  }
}

/* -------------------- POST: append questions (bulk) ------------------- */

export async function POST(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const { id } = await params;

  if (!id?.trim()) {
    return NextResponse.json(
      { error: "quiz id required" },
      { status: 400 }
    );
  }

  let body: {
    questions?: QuestionInput[];
    mode?: "append" | "replace";
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const questions = Array.isArray(body.questions)
    ? body.questions
    : [];

  if (questions.length === 0) {
    return NextResponse.json(
      {
        error:
          "questions array is required and non-empty.",
      },
      { status: 400 }
    );
  }

  if (questions.length > 1000) {
    return NextResponse.json(
      {
        error: "Maximum 1000 questions per upload.",
      },
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
        {
          error: `Question ${
            i + 1
          } is missing text or options.`,
        },
        { status: 400 }
      );
    }

    const ans = String(
      q.correctAnswer ?? ""
    ).toUpperCase() as OptionKey;

    if (!ALLOWED.includes(ans)) {
      return NextResponse.json(
        {
          error: `Question ${
            i + 1
          } has invalid correctAnswer (expected A/B/C/D).`,
        },
        { status: 400 }
      );
    }
  }

  try {
    const quiz = await prisma.quiz.findUnique({
      where: { id: id.trim() },
      select: { id: true },
    });

    if (!quiz) {
      return NextResponse.json(
        { error: "Quiz not found" },
        { status: 404 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        if (body.mode === "replace") {
          await tx.question.deleteMany({
            where: { quizId: id.trim() },
          });
        }

        const created = await tx.question.createMany({
          data: questions.map((q) => ({
            quizId: id.trim(),
            text: q.text.trim(),
            optionA: q.optionA.trim(),
            optionB: q.optionB.trim(),
            optionC: q.optionC.trim(),
            optionD: q.optionD.trim(),
            correctAnswer: String(
              q.correctAnswer
            ).toUpperCase(),
            points:
              Math.max(
                1,
                Math.trunc(Number(q.points ?? 1))
              ) || 1,
            explanation:
              q.explanation?.toString().trim() ||
              null,
          })),
        });

        const total = await tx.question.count({
          where: { quizId: id.trim() },
        });

        return {
          added: created.count,
          total,
        };
      }
    );

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error(
      "[POST /api/admin/quizzes/[id]/questions] Failed:",
      err
    );

    return NextResponse.json(
      { error: "Failed to add questions." },
      { status: 500 }
    );
  }
}
