import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const adminEmails = (): string[] =>
  (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const isAdmin = (email?: string | null) => !!email && adminEmails().includes(email.toLowerCase());

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const claims = await prisma.prizeClaim.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, rank: true, grossAmount: true, tdsAmount: true, netAmount: true,
        status: true, payoutMethod: true, payoutRef: true, approvedAt: true, paidAt: true, createdAt: true,
        user: { select: { id: true, name: true, email: true, image: true, upiHandle: true, bankAccount: true, bankIfsc: true, kycStatus: true, panStatus: true } },
        quiz: { select: { id: true, title: true } },
      },
    });
    return NextResponse.json({ claims });
  } catch (err) {
    console.error("[GET /api/admin/claims] failed:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: { id?: string; action?: "approve" | "reject" | "mark_paid"; payoutRef?: string; reason?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.id || !body.action) {
    return NextResponse.json({ error: "id + action required" }, { status: 400 });
  }
  try {
    if (body.action === "approve") {
      const c = await prisma.prizeClaim.update({
        where: { id: body.id }, data: { status: "APPROVED", approvedAt: new Date() },
      });
      return NextResponse.json({ success: true, claim: c });
    }
    if (body.action === "reject") {
      const c = await prisma.prizeClaim.update({
        where: { id: body.id }, data: { status: "REJECTED" },
      });
      return NextResponse.json({ success: true, claim: c });
    }
    if (body.action === "mark_paid") {
      const c = await prisma.prizeClaim.update({
        where: { id: body.id }, data: { status: "PAID", paidAt: new Date(), payoutRef: body.payoutRef ?? null },
      });
      return NextResponse.json({ success: true, claim: c });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[PATCH /api/admin/claims] failed:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
