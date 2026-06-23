import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

interface DevicePayload {
  fingerprint?: string;
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<{ success: true } | { error: string }>> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: DevicePayload;
  try {
    body = (await req.json()) as DevicePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fp = body?.fingerprint?.toString().slice(0, 256).trim();
  if (!fp) {
    return NextResponse.json(
      { error: "fingerprint required" },
      { status: 400 }
    );
  }

  try {
    await prisma.user.update({
      where: { email: session.user.email },
      data: { deviceFingerprint: fp },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/user/device] Failed:", err);
    return NextResponse.json(
      { error: "Failed to save device fingerprint." },
      { status: 500 }
    );
  }
}
