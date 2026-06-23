import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

interface Ctx { params: Promise<{ id: string }> | { id: string } }

const adminEmails = (): string[] =>
  (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const isAdmin = (email?: string | null) => !!email && adminEmails().includes(email.toLowerCase());

export async function POST(req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = await Promise.resolve(ctx.params);
  const id = p?.id?.trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  let body: { message?: string; status?: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id }, include: { user: { select: { id: true, email: true } } },
    });
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

    const admin = isAdmin(session.user.email);
    const isOwner = ticket.user.email === session.user.email;
    if (!admin && !isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (body.message?.trim()) {
      await prisma.ticketMessage.create({
        data: {
          ticketId: id,
          authorEmail: session.user.email,
          isAdmin: admin,
          body: body.message.trim().slice(0, 2000),
        },
      });
      await prisma.supportTicket.update({
        where: { id }, data: { updatedAt: new Date(), status: admin && ticket.status === "OPEN" ? "IN_PROGRESS" : ticket.status },
      });
    }
    if (body.status && admin) {
      await prisma.supportTicket.update({ where: { id }, data: { status: body.status } });
    }

    const updated = await prisma.supportTicket.findUnique({
      where: { id }, include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    return NextResponse.json({ success: true, ticket: updated });
  } catch (err) {
    console.error("[POST /api/support/[id]] failed:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
