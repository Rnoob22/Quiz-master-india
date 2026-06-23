import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

type QuizStatus = "DRAFT" | "LIVE" | "COMPLETED";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

const adminEmails = (): string[] =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const isAdmin = (email?: string | null): boolean => {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
};

async function requireAdmin(): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!isAdmin(session.user.email)) {
    return {
      ok: false,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true };
}

export async function PATCH(
  req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const params = await Promise.resolve(context.params);
  const id = params?.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "Quiz id required." }, { status: 400 });
  }

  let body: {
    status?: QuizStatus;
    title?: string;
    startTime?: string;
    durationSeconds?: number;
    entryFee?: number;
    totalPrizePool?: number;
    maxParticipants?: number;
    collectGst?: boolean;
    competitionStartTime?: string | null;
    competitionEndTime?: string | null;
    minParticipantsThreshold?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  // Build update payload — only include keys the caller actually sent
  const allowed: QuizStatus[] = ["DRAFT", "LIVE", "COMPLETED"];
  const data: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!allowed.includes(body.status)) {
      return NextResponse.json(
        { error: "status must be DRAFT, LIVE, or COMPLETED." },
        { status: 400 }
      );
    }
    data.status = body.status;
  }
  if (body.title !== undefined) {
    const t = body.title.trim();
    if (t.length < 3) return NextResponse.json({ error: "Title too short." }, { status: 400 });
    data.title = t;
  }
  if (body.startTime !== undefined) {
    const d = new Date(body.startTime);
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid startTime." }, { status: 400 });
    data.startTime = d;
  }
  if (body.durationSeconds !== undefined) {
    const n = Math.trunc(Number(body.durationSeconds));
    if (!Number.isFinite(n) || n < 10 || n > 60 * 60 * 4)
      return NextResponse.json({ error: "durationSeconds must be 10s\u20134h." }, { status: 400 });
    data.durationSeconds = n;
  }
  if (body.entryFee !== undefined) {
    const n = Number(body.entryFee);
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "entryFee must be \u2265 0." }, { status: 400 });
    data.entryFee = n;
  }
  if (body.totalPrizePool !== undefined) {
    const n = Number(body.totalPrizePool);
    if (!Number.isFinite(n) || n < 0) return NextResponse.json({ error: "totalPrizePool must be \u2265 0." }, { status: 400 });
    data.totalPrizePool = n;
  }
  if (body.maxParticipants !== undefined) {
    const n = Math.trunc(Number(body.maxParticipants));
    if (!Number.isFinite(n) || n < 1) return NextResponse.json({ error: "maxParticipants must be \u2265 1." }, { status: 400 });
    data.maxParticipants = n;
  }
  if (body.collectGst !== undefined) data.collectGst = body.collectGst === true;
  if (body.competitionStartTime !== undefined) {
    if (body.competitionStartTime === null || body.competitionStartTime === "") {
      data.competitionStartTime = null;
    } else {
      const d = new Date(body.competitionStartTime);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid competitionStartTime." }, { status: 400 });
      data.competitionStartTime = d;
    }
  }
  if (body.competitionEndTime !== undefined) {
    if (body.competitionEndTime === null || body.competitionEndTime === "") {
      data.competitionEndTime = null;
    } else {
      const d = new Date(body.competitionEndTime);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid competitionEndTime." }, { status: 400 });
      data.competitionEndTime = d;
    }
  }
  if (body.minParticipantsThreshold !== undefined) {
    const n = Math.trunc(Number(body.minParticipantsThreshold));
    if (!Number.isFinite(n) || n < 1) return NextResponse.json({ error: "minParticipantsThreshold must be \u2265 1." }, { status: 400 });
    data.minParticipantsThreshold = n;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  // Hard rule: only DRAFT quizzes can have fees / prizes / window mutated.
  // Status transitions are always allowed.
  if (Object.keys(data).some((k) => k !== "status")) {
    const existing = await prisma.quiz.findUnique({
      where: { id },
      select: { status: true, _count: { select: { submissions: true, payments: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: `Quiz fields can only be edited while status is DRAFT (currently ${existing.status}).` },
        { status: 409 }
      );
    }
    if (existing._count.submissions > 0 || existing._count.payments > 0) {
      return NextResponse.json(
        { error: "Cannot edit a quiz that already has submissions or payments." },
        { status: 409 }
      );
    }
  }

  try {
    const updated = await prisma.quiz.update({
      where: { id },
      data,
      select: {
        id: true, status: true, title: true, startTime: true, durationSeconds: true,
        entryFee: true, totalPrizePool: true, maxParticipants: true, collectGst: true,
        competitionStartTime: true, competitionEndTime: true, minParticipantsThreshold: true,
      },
    });
    return NextResponse.json({ success: true, quiz: updated });
  } catch (err) {
    console.error("[PATCH /api/admin/quizzes/[id]] Failed:", err);
    return NextResponse.json(
      { error: "Failed to update quiz status." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const params = await Promise.resolve(context.params);
  const id = params?.id?.trim();
  if (!id) {
    return NextResponse.json({ error: "Quiz id required." }, { status: 400 });
  }

  try {
    await prisma.quiz.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/admin/quizzes/[id]] Failed:", err);
    return NextResponse.json({ error: "Failed to delete quiz." }, { status: 500 });
  }
}
