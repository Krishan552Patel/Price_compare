// Edge-runtime-safe auth config — no Node.js imports (no DB, no bcrypt, no crypto).
// Used by middleware.ts; full provider config lives in auth.ts.
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
  providers: [], // Credentials provider added in auth.ts (Node runtime only)
  session: { strategy: "jwt" },
};
