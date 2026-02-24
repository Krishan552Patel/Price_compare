import { NextRequest, NextResponse } from "next/server";
import { getUserByEmail, createPasswordResetToken } from "@/lib/auth-queries";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const user = await getUserByEmail(email);

    // Always return success to prevent email enumeration
    if (user) {
      const rawToken = await createPasswordResetToken(user.id);
      await sendPasswordResetEmail(user.email, rawToken);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
