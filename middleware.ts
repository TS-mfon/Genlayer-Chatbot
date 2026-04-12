import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminPath = pathname.startsWith("/admin");
  const isAdminApiPath = pathname.startsWith("/api/admin");
  const isLoginPath = pathname === "/admin/login";

  if (!isAdminPath && !isAdminApiPath) {
    return NextResponse.next();
  }

  if (isLoginPath) {
    return NextResponse.next();
  }

  const token = await getToken({ req });
  if (token?.role === "admin") {
    return NextResponse.next();
  }

  if (isAdminApiPath) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/admin/login", req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
