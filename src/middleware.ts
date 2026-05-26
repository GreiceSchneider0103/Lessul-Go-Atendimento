import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/ssr";

const publicRoutes = ["/", "/login", "/auth/callback", "/api/health", "/indisponivel"];
const AUTH_TIMEOUT_MS = Number(process.env.AUTH_TIMEOUT_MS ?? 8000);

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function isPublicRoute(pathname: string) {
  return publicRoutes.some((route) => {
    if (route === "/") return pathname === "/";
    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error("AUTH_TIMEOUT")), ms);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hasEnv = hasSupabaseEnv();
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.includes("auth-token"));

  if (isPublicRoute(pathname)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-route-access", "public");

    return NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });
  }

  if (!hasEnv) {
    console.warn("[middleware-auth]", { pathname, hasSupabaseEnv: hasEnv, hasAuthCookie, hasSession: false, userId: null, reason: "session_lookup_failed" });
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ message: "Autenticação não configurada no ambiente" }, { status: 503 });
    }

    return NextResponse.redirect(new URL("/login", request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-route-access", "private");

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  try {
    const {
      data: { session }
    } = await withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS);

    console.log("[middleware-auth]", { pathname, hasSupabaseEnv: hasEnv, hasAuthCookie, hasSession: Boolean(session), userId: session?.user?.id ?? null });

    if (!session && pathname.startsWith("/api")) {
      return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
    }

    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    return response;
  } catch {
    console.warn("[middleware-auth]", { pathname, hasSupabaseEnv: hasEnv, hasAuthCookie, hasSession: false, userId: null, reason: "session_lookup_failed" });
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ message: "Autenticação temporariamente indisponível" }, { status: 503 });
    }

    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
