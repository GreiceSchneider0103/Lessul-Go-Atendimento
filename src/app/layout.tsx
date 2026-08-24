import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { Command } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { SidebarNav } from "@/components/ui/sidebar-nav";
import { getCurrentUser } from "@/lib/auth/session";
import { ServiceUnavailableError, UnauthorizedError } from "@/lib/errors";
import { hasSupabaseClientEnv } from "@/lib/supabase/config";
import { prisma } from "@/lib/db/prisma";
import { hasUnreadOperacionalLoja } from "@/lib/services/operational-requests-service";

async function resolveHasUnreadOperacional(currentUser: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  if (currentUser.perfil !== "LOJA" && currentUser.perfil !== "ADMIN" && currentUser.perfil !== "MASTER") {
    return false;
  }

  try {
    let empresasVinculadas: NonNullable<typeof currentUser.empresaVinculada>[] = [];

    if (currentUser.perfil === "LOJA") {
      const vinculos = await prisma.usuarioEmpresa.findMany({ where: { usuarioId: currentUser.id } });
      empresasVinculadas = vinculos.length
        ? vinculos.map((item) => item.empresa)
        : currentUser.empresaVinculada
          ? [currentUser.empresaVinculada]
          : [];
    }

    return await hasUnreadOperacionalLoja({
      perfil: currentUser.perfil,
      empresasVinculadas,
      visitadoEm: currentUser.operacionalLojaVisitadoEm
    });
  } catch {
    return false;
  }
}

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  icons: {
    icon: "/icon.svg"
  }
};


function getInitials(name?: string) {
  if (!name) return "VS";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  let currentUser: Awaited<ReturnType<typeof getCurrentUser>> | null = null;
  const requestHeaders = await headers();
  const isPublicRoute = requestHeaders.get("x-route-access") === "public";

  try {
    if (hasSupabaseClientEnv() && !isPublicRoute) {
      currentUser = await getCurrentUser();
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      currentUser = null;
    } else if (error instanceof ServiceUnavailableError) {
      console.warn("[RootLayout] fallback user null due to auth/session unavailable", {
        pathname: "layout",
        reason: "service_unavailable_auth_or_session",
        message: error.message
      });
      currentUser = null;
    } else {
      throw error;
    }
  }

  const hasUnreadOperacional = currentUser ? await resolveHasUnreadOperacional(currentUser) : false;

  if (!currentUser) {
    return (
      <html lang="pt-BR" className={inter.variable}>
        <body>
          <main className="grid min-h-screen place-items-center p-6" style={{ background: "var(--color-bg)" }}>
            <div className="grid gap-6 justify-items-center">
              <div className="flex items-center gap-2.5">
                <div className="brand-icon">
                  <Command size={16} strokeWidth={2.5} />
                </div>
                <span className="text-[15px] font-bold tracking-tight text-slate-800">GO Atendimento</span>
              </div>
              {children}
            </div>
          </main>
        </body>
      </html>
    );
  }

  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>
        <div className="app-shell">
          <header className="app-header">
            <div className="header-left">
              <div className="brand-row">
                <div className="brand-icon">
                  <Command size={16} strokeWidth={2.5} />
                </div>
                <span className="brand">GO Atendimento</span>
              </div>
              <SidebarNav perfil={currentUser.perfil} hasUnreadOperacional={hasUnreadOperacional} />
            </div>
            <div className="header-right">
              <div className="user-chip">
                <div>
                  <div className="user-name">{currentUser.nome}</div>
                  <div className="user-role">{currentUser.perfil.toLowerCase()}</div>
                </div>
                <span className="avatar">{getInitials(currentUser.nome)}</span>
              </div>
              <LogoutButton />
            </div>
          </header>

          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
