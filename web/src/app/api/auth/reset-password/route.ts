import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { verifyAndConsumeResetToken, updateUserPassword } from "@/lib/auth-queries";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) {
      return NextResponse.json({ error: "Token and new password are required." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    const userId = await verifyAndConsumeResetToken(token);
    if (!userId) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Please request a new one." },
        { status: 400 }
      );
    }

    const password_hash = await bcrypt.hash(password, 12);
    await updateUserPassword(userId, password_hash);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
