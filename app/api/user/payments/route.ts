import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

interface PaymentRow {
  id: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  razorpayOrderId: string;
  razorpayPaymentId: string | null;
  baseAmount: number;
  taxAmount: number;
  totalPaid: number;
  createdAt: string;
  quiz: { id: string; title: string };
}

export async function GET(): Promise<
  NextResponse<{ payments: PaymentRow[] } | { error: string }>
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const rows = await prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        razorpayOrderId: true,
        razorpayPaymentId: true,
        baseAmount: true,
        taxAmount: true,
        totalPaid: true,
        createdAt: true,
        quiz: { select: { id: true, title: true } },
      },
    });

    const payments: PaymentRow[] = rows.map((p) => ({
      id: p.id,
      status: p.status,
      razorpayOrderId: p.razorpayOrderId,
      razorpayPaymentId: p.razorpayPaymentId,
      baseAmount: p.baseAmount,
      taxAmount: p.taxAmount,
      totalPaid: p.totalPaid,
      createdAt: p.createdAt.toISOString(),
      quiz: { id: p.quiz.id, title: p.quiz.title },
    }));

    return NextResponse.json({ payments });
  } catch (err) {
    console.error("[GET /api/user/payments] Failed:", err);
    return NextResponse.json(
      { error: "Failed to load payments." },
      { status: 500 }
    );
  }
}
