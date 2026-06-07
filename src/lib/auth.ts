import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { db } from "@/lib/db";
import { checkRateLimit, getRequestIp } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const requestIp = getRequestIp(request);
        const ipLimit = await checkRateLimit({
          scope: "login-ip",
          identifier: requestIp,
          limit: 50,
          windowSeconds: 15 * 60,
        });
        const loginLimit = await checkRateLimit({
          scope: "login",
          identifier: `${requestIp}:${parsed.data.email.toLowerCase()}`,
          limit: 10,
          windowSeconds: 15 * 60,
        });

        if (!ipLimit.allowed || !loginLimit.allowed) {
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
        });

        if (!user) {
          return null;
        }

        const isValid = await bcrypt.compare(
          parsed.data.password,
          user.hashedPassword,
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.tenantId = user.tenantId;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = typeof token.role === "string" ? token.role : "CLIENT";
        session.user.tenantId =
          typeof token.tenantId === "string" ? token.tenantId : null;
      }

      return session;
    },
  },
});
