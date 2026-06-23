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
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    const last30 = new Date(now.getTime() - 30 * day);
    const dau = new Date(now.getTime() - day);

    const [dauCount, mauCount, daily, revenueByDay, statePart, payTotals] = await Promise.all([
      prisma.submission.findMany({
        where: { submittedAt: { gte: dau } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.submission.findMany({
        where: { submittedAt: { gte: last30 } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      prisma.$queryRaw<{ day: string; users: bigint }[]>`
        SELECT to_char(date_trunc('day', "submittedAt"), 'YYYY-MM-DD') AS day,
               COUNT(DISTINCT "userId")::bigint AS users
        FROM "Submission"
        WHERE "submittedAt" >= ${last30}
        GROUP BY 1 ORDER BY 1 ASC
      `,
      prisma.$queryRaw<{ day: string; revenue: number }[]>`
        SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
               COALESCE(SUM("totalPaid"),0)::float AS revenue
        FROM "Payment"
        WHERE "status" = 'SUCCESS' AND "createdAt" >= ${last30}
        GROUP BY 1 ORDER BY 1 ASC
      `,
      prisma.$queryRaw<{ state: string; players: bigint }[]>`
        SELECT COALESCE("state", 'Unknown') AS state, COUNT(*)::bigint AS players
        FROM "User"
        GROUP BY 1
        ORDER BY players DESC
        LIMIT 15
      `,
      prisma.payment.aggregate({ _sum: { totalPaid: true, taxAmount: true }, where: { status: "SUCCESS" } }),
    ]);

    return NextResponse.json({
      dau: dauCount.length,
      mau: mauCount.length,
      daily: daily.map((r) => ({ day: r.day, users: Number(r.users) })),
      revenueByDay: revenueByDay.map((r) => ({ day: r.day, revenue: r.revenue })),
      stateParticipation: statePart.map((r) => ({ state: r.state, players: Number(r.players) })),
      revenue: {
        totalCollected: Number(payTotals._sum.totalPaid ?? 0),
        totalTax: Number(payTotals._sum.taxAmount ?? 0),
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/analytics] failed:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
