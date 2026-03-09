import "./globals.css";
import Link from "next/link";
import { ReactNode } from "react";
<<<<<<< HEAD
import { LogoutButton } from "@/components/auth/logout-button";
=======
>>>>>>> origin/main

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
<<<<<<< HEAD
        <nav style={{ display: "flex", gap: 12, padding: 16, background: "#111", color: "#fff", alignItems: "center" }}>
=======
        <nav style={{ display: "flex", gap: 12, padding: 16, background: "#111", color: "#fff" }}>
>>>>>>> origin/main
          <Link href="/dashboard" style={{ color: "#fff" }}>Dashboard</Link>
          <Link href="/tickets" style={{ color: "#fff" }}>Tickets</Link>
          <Link href="/tickets/kanban" style={{ color: "#fff" }}>Kanban</Link>
          <Link href="/reports" style={{ color: "#fff" }}>Relatórios</Link>
          <Link href="/users" style={{ color: "#fff" }}>Usuários</Link>
          <Link href="/admin" style={{ color: "#fff" }}>Administração</Link>
<<<<<<< HEAD
          <div style={{ marginLeft: "auto" }}><LogoutButton /></div>
=======
>>>>>>> origin/main
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
