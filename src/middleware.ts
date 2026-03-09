<<<<<<< HEAD
import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

const publicRoutes = ["/login", "/auth/callback"];

export async function middleware(request: NextRequest) {
=======
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicRoutes = ["/login"];

export function middleware(request: NextRequest) {
>>>>>>> origin/main
  if (publicRoutes.some((route) => request.nextUrl.pathname.startsWith(route))) {
    return NextResponse.next();
  }

<<<<<<< HEAD
  const response = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res: response });
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session && request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
=======
  const email = request.headers.get("x-user-email");
  if (!email && request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  if (!email) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
>>>>>>> origin/main
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
