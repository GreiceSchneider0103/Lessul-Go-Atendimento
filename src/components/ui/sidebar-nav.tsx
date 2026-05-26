"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

type NavItem = { label: string; href: Route };

const navByPerfil: Record<string, NavItem[]> = {
  LOJA: [{ label: "Operacional Loja", href: "/loja/solicitacoes" }],
  ADMIN: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Tickets", href: "/tickets" },
    { label: "Kanban", href: "/tickets/kanban" },
    { label: "Relatórios", href: "/reports" },
    { label: "Usuários", href: "/users" },
    { label: "Administração", href: "/admin" },
    { label: "Operacional Loja", href: "/loja/solicitacoes" }
  ],
  DEFAULT: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Tickets", href: "/tickets" },
    { label: "Kanban", href: "/tickets/kanban" },
    { label: "Relatórios", href: "/reports" },
    { label: "Usuários", href: "/users" },
    { label: "Administração", href: "/admin" }
  ]
};

export function SidebarNav({ perfil }: { perfil: string }) {
  const pathname = usePathname();
  const navItems = navByPerfil[perfil] ?? navByPerfil.DEFAULT;
  return <nav className="nav-list">{navItems.map((item) => <Link key={item.href} href={item.href} className={`nav-item ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? "active" : ""}`}>{item.label}</Link>)}</nav>;
}
