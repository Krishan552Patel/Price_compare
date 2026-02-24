import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Explicit named export so Next.js can statically verify the function shape.
export const middleware = NextAuth(authConfig).auth;

export const config = {
  matcher: ["/account/:path*"],
};
