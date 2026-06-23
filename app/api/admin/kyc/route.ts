import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const adminEmails = (): string[] =>
  (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const isAdmin = (email?: string | null) => !!email && adminEmails().includes(email.toLowerCase());

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: { userId?: string; action?: "approve" | "reject"; reason?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.userId || !body.action) return NextResponse.json({ error: "userId + action required" }, { status: 400 });
  try {
    const u = await prisma.user.update({
      where: { id: body.userId },
      data: body.action === "approve"
        ? { kycStatus: "APPROVED", panStatus: "APPROVED", kycReviewedAt: new Date(), kycRejectionReason: null }
        : { kycStatus: "REJECTED", panStatus: "REJECTED", kycReviewedAt: new Date(), kycRejectionReason: body.reason ?? "Not specified" },
      select: { id: true, kycStatus: true },
    });
    return NextResponse.json({ success: true, user: u });
  } catch (err) {
    console.error("[PATCH /api/admin/kyc] failed:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(session.user.email)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const users = await prisma.user.findMany({
      where: { kycStatus: { in: ["SUBMITTED", "APPROVED", "REJECTED"] } },
      orderBy: { kycSubmittedAt: "desc" },
      take: 100,
      select: {
        id: true, name: true, email: true, image: true, mobile: true,
        panNumber: true, panStatus: true, upiHandle: true, bankAccount: true,
        bankIfsc: true, bankHolderName: true, kycStatus: true, kycSubmittedAt: true,
        kycReviewedAt: true, kycRejectionReason: true,
      },
    });
    return NextResponse.json({ users });
  } catch (err) {
    console.error("[GET /api/admin/kyc] failed:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
