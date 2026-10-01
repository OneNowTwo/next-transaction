import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Auth gate when AUTH_EMAIL + AUTH_PASSWORD are configured.
 * Local/dev without those env vars stays open for the temporary preview.
 */
export function middleware(request: NextRequest) {
  const authRequired = Boolean(
    process.env.AUTH_EMAIL?.trim() && process.env.AUTH_PASSWORD?.trim()
  );
  if (!authRequired) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const session = request.cookies.get("nt_session")?.value;
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
