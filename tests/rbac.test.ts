import { describe, expect, it } from "vitest";
import { hasPermission } from "../src/lib/rbac/permissions";

describe("rbac", () => {
  it("atendente não pode exportar relatório", () => {
    expect(hasPermission("ATENDENTE", "reports.export")).toBe(false);
  });

  it("supervisor pode editar campos sensíveis", () => {
    expect(hasPermission("SUPERVISOR", "ticket.update_sensitive")).toBe(true);
  });

  it("loja não pode criar ticket geral", () => {
    expect(hasPermission("LOJA", "ticket.create")).toBe(false);
  });

  it("master tem acesso ao módulo master, admin não", () => {
    expect(hasPermission("MASTER", "master.manage")).toBe(true);
    expect(hasPermission("ADMIN", "master.manage")).toBe(false);
  });

  it("master herda as permissões de admin", () => {
    expect(hasPermission("MASTER", "user.manage")).toBe(true);
    expect(hasPermission("MASTER", "ticket.soft_delete")).toBe(true);
  });
});
