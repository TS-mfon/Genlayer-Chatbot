import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function isAdminAuthorized() {
  const session = await getServerSession(authOptions);
  return (session?.user as { role?: string } | undefined)?.role === "admin";
}
