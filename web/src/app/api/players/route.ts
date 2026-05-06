import { NextResponse } from "next/server";
import { getPublicUsers } from "@/lib/auth-queries";

export async function GET() {
  const users = await getPublicUsers();
  return NextResponse.json(users);
}
