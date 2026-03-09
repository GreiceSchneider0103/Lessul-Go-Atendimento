"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

type NavItem = {
  label: string;
  href: Route;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Tickets", href: "/tickets" },
  { label: "Kanban", href: "/tickets/kanban" },
  { label: "Relatórios", href: "/reports" },
  { label: "Usuários", href: "/users" },
  { label: "Administração", href: "/admin" }
];

const iconByLabel: Record<string, string> = {
  Dashboard: "▦",
  Tickets: "⌘",
  Kanban: "║",
  Relatórios: "▤",
  Usuários: "◔",
  Administração: "⚙"
};

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="nav-list">
      {navItems.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${active ? "active" : ""}`}
          >
            <span className="nav-icon">{iconByLabel[item.label] ?? "•"}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
