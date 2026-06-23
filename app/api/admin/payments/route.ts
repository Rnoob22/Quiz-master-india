import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

interface AdminPaymentRow {
  id: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  baseAmount: number;
  taxAmount: number;
  totalPaid: number;
  createdAt: string;
  user: { id: string; name: string; email: string; image: string | null };
  quiz: { id: string; title: string };
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

export async function GET(
  req: NextRequest
): Promise<
  NextResponse<{ payments: AdminPaymentRow[]; total: number } | { error: string }>
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.toUpperCase();
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 200);

  const validStatuses = ["PENDING", "SUCCESS", "FAILED"] as const;
  const where =
    status && (validStatuses as readonly string[]).includes(status)
      ? { status: status as (typeof validStatuses)[number] }
      : {};

  try {
    const [rows, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          razorpayOrderId: true,
          razorpayPaymentId: true,
          baseAmount: true,
          taxAmount: true,
          totalPaid: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true, image: true } },
          quiz: { select: { id: true, title: true } },
        },
      }),
      prisma.payment.count({ where }),
    ]);

    const payments: AdminPaymentRow[] = rows.map((p) => ({
      id: p.id,
      status: p.status,
      razorpayOrderId: p.razorpayOrderId,
      razorpayPaymentId: p.razorpayPaymentId,
      baseAmount: p.baseAmount,
      taxAmount: p.taxAmount,
      totalPaid: p.totalPaid,
      createdAt: p.createdAt.toISOString(),
      user: {
        id: p.user.id,
        name: p.user.name,
        email: p.user.email,
        image: p.user.image ?? null,
      },
      quiz: { id: p.quiz.id, title: p.quiz.title },
    }));

    return NextResponse.json({ payments, total });
  } catch (err) {
    console.error("[GET /api/admin/payments] Failed:", err);
    return NextResponse.json(
      { error: "Failed to load payments." },
      { status: 500 }
    );
  }
}
