import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

interface DevicePayload {
  fingerprint?: string;
}

type DeviceResponse =
  | { success: true; locked: boolean }
  | { error: string; code?: string };

export async function POST(
  req: NextRequest
): Promise<NextResponse<DeviceResponse>> {
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
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, deviceFingerprint: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Second-line defense for the "One Device, One Account" rule:
    // if a fingerprint is already stored, reject any attempt to change it.
    if (user.deviceFingerprint && user.deviceFingerprint !== fp) {
      console.warn(
        `[POST /api/user/device] BLOCKED fingerprint change for ` +
          `${session.user.email} (stored=${user.deviceFingerprint.slice(
            0,
            16
          )}..., incoming=${fp.slice(0, 16)}...)`
      );
      return NextResponse.json(
        {
          error:
            "This account is locked to its original device. Contact support to reset your device lock.",
          code: "MULTIPLE_DEVICE_LOGIN",
        },
        { status: 403 }
      );
    }

    // Already locked to this same fingerprint — nothing to do.
    if (user.deviceFingerprint === fp) {
      return NextResponse.json({ success: true, locked: true });
    }

    // First-time lock-in (legacy accounts or signups that lost the
    // signIn-callback cookie path for any reason).
    await prisma.user.update({
      where: { email: session.user.email },
      data: { deviceFingerprint: fp },
    });
    return NextResponse.json({ success: true, locked: true });
  } catch (err) {
    console.error("[POST /api/user/device] Failed:", err);
    return NextResponse.json(
      { error: "Failed to save device fingerprint." },
      { status: 500 }
    );
  }
}
