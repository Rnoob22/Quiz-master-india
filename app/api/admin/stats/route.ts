import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

interface AdminStatsResponse {
  totals: {
    users: number;
    quizzes: number;
    quizzesLive: number;
    quizzesDraft: number;
    submissions: number;
    payments: number;
    paymentsSuccess: number;
    paymentsPending: number;
    paymentsFailed: number;
  };
  revenue: {
    totalCollected: number;
    totalTax: number;
  };
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

export async function GET(): Promise<
  NextResponse<AdminStatsResponse | { error: string }>
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [
      users,
      quizzes,
      quizzesLive,
      quizzesDraft,
      submissions,
      payments,
      paymentsSuccess,
      paymentsPending,
      paymentsFailed,
      revenueAgg,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.quiz.count(),
      prisma.quiz.count({ where: { status: "LIVE" } }),
      prisma.quiz.count({ where: { status: "DRAFT" } }),
      prisma.submission.count(),
      prisma.payment.count(),
      prisma.payment.count({ where: { status: "SUCCESS" } }),
      prisma.payment.count({ where: { status: "PENDING" } }),
      prisma.payment.count({ where: { status: "FAILED" } }),
      prisma.payment.aggregate({
        _sum: { totalPaid: true, taxAmount: true },
        where: { status: "SUCCESS" },
      }),
    ]);

    return NextResponse.json({
      totals: {
        users,
        quizzes,
        quizzesLive,
        quizzesDraft,
        submissions,
        payments,
        paymentsSuccess,
        paymentsPending,
        paymentsFailed,
      },
      revenue: {
        totalCollected: Number(revenueAgg._sum.totalPaid ?? 0),
        totalTax: Number(revenueAgg._sum.taxAmount ?? 0),
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/stats] Failed:", err);
    return NextResponse.json(
      { error: "Failed to load admin stats." },
      { status: 500 }
    );
  }
}
