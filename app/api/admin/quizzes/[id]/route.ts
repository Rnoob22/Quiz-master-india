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

  let body: { status?: QuizStatus };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const allowed: QuizStatus[] = ["DRAFT", "LIVE", "COMPLETED"];
  if (!body.status || !allowed.includes(body.status)) {
    return NextResponse.json(
      { error: "status must be DRAFT, LIVE, or COMPLETED." },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.quiz.update({
      where: { id },
      data: { status: body.status },
      select: { id: true, status: true, title: true },
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
