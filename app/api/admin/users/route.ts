import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  image: string | null;
  state: string | null;
  city: string | null;
  preferredLanguage: string;
  createdAt: string;
  submissions: number;
  successfulPayments: number;
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
): Promise<NextResponse<{ users: AdminUserRow[]; total: number } | { error: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 200);

  try {
    const where = q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
            { state: { contains: q, mode: "insensitive" as const } },
            { city: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          state: true,
          city: true,
          preferredLanguage: true,
          createdAt: true,
          _count: {
            select: {
              submissions: true,
              payments: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const users: AdminUserRow[] = rows.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      image: u.image ?? null,
      state: u.state ?? null,
      city: u.city ?? null,
      preferredLanguage: u.preferredLanguage,
      createdAt: u.createdAt.toISOString(),
      submissions: u._count.submissions,
      successfulPayments: u._count.payments,
    }));

    return NextResponse.json({ users, total });
  } catch (err) {
    console.error("[GET /api/admin/users] Failed:", err);
    return NextResponse.json({ error: "Failed to load users." }, { status: 500 });
  }
}
