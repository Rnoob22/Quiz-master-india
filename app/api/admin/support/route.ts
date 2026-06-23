import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const adminEmails = (): string[] =>
  (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const isAdmin = (email?: string | null) => !!email && adminEmails().includes(email.toLowerCase());

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  try {
    const tickets = await prisma.supportTicket.findMany({
      where: status ? { status: status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    return NextResponse.json({ tickets });
  } catch (err) {
    console.error("[GET /api/admin/support] failed:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
