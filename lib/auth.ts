import bcrypt from "bcryptjs";
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Admin",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        if (credentials.email !== env.ADMIN_EMAIL) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          env.ADMIN_PASSWORD_HASH,
        );
        if (!isValid) return null;

        return { id: "admin", email: env.ADMIN_EMAIL, role: "admin" } as const;
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/login" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.role = "admin";
      return token;
    },
    async session({ session, token }) {
      if (token?.role) {
        session.user = { ...session.user, role: token.role as string };
      }
      return session;
    },
  },
};

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    redirect("/admin/login");
  }
  return session;
}
