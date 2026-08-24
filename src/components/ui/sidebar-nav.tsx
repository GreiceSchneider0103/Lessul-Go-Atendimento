"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { LayoutDashboard, Ticket, BarChart3, Settings, Shield, Store, type LucideIcon } from "lucide-react";

type NavItem = { label: string; href: Route; icon: LucideIcon };

const navByPerfil: Record<string, NavItem[]> = {
  LOJA: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Operacional Loja", href: "/loja/solicitacoes", icon: Store }
  ],
  ADMIN: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Tickets", href: "/tickets", icon: Ticket },
    { label: "Relatórios", href: "/reports", icon: BarChart3 },
    { label: "Administração", href: "/admin", icon: Settings },
    { label: "Operacional Loja", href: "/loja/solicitacoes", icon: Store }
  ],
  MASTER: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Tickets", href: "/tickets", icon: Ticket },
    { label: "Relatórios", href: "/reports", icon: BarChart3 },
    { label: "Administração", href: "/admin", icon: Settings },
    { label: "Master", href: "/master", icon: Shield },
    { label: "Operacional Loja", href: "/loja/solicitacoes", icon: Store }
  ],
  DEFAULT: [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Tickets", href: "/tickets", icon: Ticket },
    { label: "Relatórios", href: "/reports", icon: BarChart3 }
  ]
};

export function SidebarNav({ perfil, hasUnreadOperacional = false }: { perfil: string; hasUnreadOperacional?: boolean }) {
  const pathname = usePathname();
  const navItems = navByPerfil[perfil] ?? navByPerfil.DEFAULT;

  return (
    <nav className="nav-list">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        const showUnreadDot = hasUnreadOperacional && item.href === "/loja/solicitacoes";

        return (
          <Link key={item.href} href={item.href} className={`nav-item ${isActive ? "active" : ""}`}>
            <span className="nav-icon" style={{ position: "relative" }}>
              <Icon size={17} strokeWidth={2.25} />
              {showUnreadDot ? <span className="nav-unread-dot" aria-label="Atualizações não vistas" /> : null}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
