import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import prisma from "@/lib/db";

interface OnboardingPayload {
  dob?: string;
  state?: string;
  city?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: OnboardingPayload;
  try {
    payload = (await req.json()) as OnboardingPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { dob, state, city } = payload;
  if (!dob || !state || !city || city.trim().length < 2) {
    return NextResponse.json(
      { error: "Date of birth, state, and city are required." },
      { status: 400 }
    );
  }

  const dobDate = new Date(dob);
  if (Number.isNaN(dobDate.getTime())) {
    return NextResponse.json(
      { error: "Invalid date of birth." },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        dob: dobDate,
        state: state.trim(),
        city: city.trim(),
      },
      select: { id: true, dob: true, state: true, city: true },
    });
    return NextResponse.json({ success: true, user: updated });
  } catch (err) {
    console.error("[POST /api/user/onboarding] Failed:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
