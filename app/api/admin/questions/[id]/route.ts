import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

const adminEmails = (): string[] =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const isAdmin = (email?: string | null): boolean =>
  !!email && adminEmails().includes(email.toLowerCase());

export async function DELETE(
  _req: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = await Promise.resolve(context.params);
  const id = params?.id?.trim();
  if (!id) return NextResponse.json({ error: "question id required" }, { status: 400 });

  try {
    await prisma.question.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/admin/questions/[id]] Failed:", err);
    return NextResponse.json(
      { error: "Failed to delete question." },
      { status: 500 }
    );
  }
}
