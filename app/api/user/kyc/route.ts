import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        mobile: true,
        gender: true,
        panNumber: true,
        panStatus: true,
        bankAccount: true,
        bankIfsc: true,
        bankHolderName: true,
        upiHandle: true,
        kycStatus: true,
        kycSubmittedAt: true,
        kycReviewedAt: true,
        kycRejectionReason: true,
      },
    });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(user);
  } catch (err) {
    console.error("[GET /api/user/kyc] failed:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, string | undefined>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pan = body.panNumber?.toString().trim().toUpperCase();
  const mobile = body.mobile?.toString().trim();
  const gender = body.gender?.toString().trim();
  const upi = body.upiHandle?.toString().trim();
  const bankAccount = body.bankAccount?.toString().trim();
  const bankIfsc = body.bankIfsc?.toString().trim().toUpperCase();
  const bankHolderName = body.bankHolderName?.toString().trim();

  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    return NextResponse.json({ error: "Invalid PAN format (ABCDE1234F)." }, { status: 400 });
  }
  if (mobile && !/^[6-9]\d{9}$/.test(mobile)) {
    return NextResponse.json({ error: "Invalid Indian mobile number." }, { status: 400 });
  }
  if (bankIfsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIfsc)) {
    return NextResponse.json({ error: "Invalid IFSC code." }, { status: 400 });
  }
  if (!pan && !upi && !(bankAccount && bankIfsc)) {
    return NextResponse.json(
      { error: "Provide at least PAN, UPI, or full bank details." },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        panNumber: pan ?? undefined,
        mobile: mobile ?? undefined,
        gender: gender ?? undefined,
        upiHandle: upi ?? undefined,
        bankAccount: bankAccount ?? undefined,
        bankIfsc: bankIfsc ?? undefined,
        bankHolderName: bankHolderName ?? undefined,
        kycStatus: "SUBMITTED",
        kycSubmittedAt: new Date(),
        kycRejectionReason: null,
      },
      select: { kycStatus: true },
    });
    return NextResponse.json({ success: true, kycStatus: updated.kycStatus });
  } catch (err) {
    console.error("[POST /api/user/kyc] failed:", err);
    return NextResponse.json({ error: "Failed to save KYC." }, { status: 500 });
  }
}
