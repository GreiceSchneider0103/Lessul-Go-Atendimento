import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ticketFindFirst: vi.fn(),
  operationalRequestFindFirst: vi.fn(),
  operationalRequestCreate: vi.fn(),
  usuarioFindMany: vi.fn(),
  registerTicketAudit: vi.fn(),
  sendEmail: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    ticket: { findFirst: mocks.ticketFindFirst },
    operationalRequest: { findFirst: mocks.operationalRequestFindFirst, create: mocks.operationalRequestCreate },
    usuario: { findMany: mocks.usuarioFindMany }
  }
}));

vi.mock("@/lib/audit/ticket-audit", () => ({ registerTicketAudit: mocks.registerTicketAudit }));
vi.mock("@/lib/services/email-service", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/supabase/config", () => ({ getAppBaseUrl: () => "http://localhost:3000" }));

import { createFromTicket } from "@/lib/services/operational-requests-service";

describe("createFromTicket ticket lookup scoping (regression)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("scopes an ATENDENTE's lookup to tickets they created/updated/are responsible for, not any ticket id", async () => {
    mocks.ticketFindFirst.mockResolvedValue(null);
    const actor = { id: "atendente-1", perfil: "ATENDENTE" as const, empresaVinculada: null };

    await expect(createFromTicket("ticket-999", "ASSISTENCIA", actor as any)).rejects.toThrow("Ticket não encontrado");

    expect(mocks.ticketFindFirst).toHaveBeenCalledWith({
      where: {
        id: "ticket-999",
        ativo: true,
        OR: [{ criadoPorId: "atendente-1" }, { atualizadoPorId: "atendente-1" }, { responsavelId: "atendente-1" }]
      }
    });
  });

  it("scopes a LOJA actor's lookup to their own empresa, not any ticket id system-wide", async () => {
    mocks.ticketFindFirst.mockResolvedValue(null);
    const actor = { id: "loja-1", perfil: "LOJA" as const, empresaVinculada: "LESSUL" as const, empresasVinculadas: ["LESSUL" as const] };

    await expect(createFromTicket("ticket-999", "DEVOLUCAO", actor as any)).rejects.toThrow("Ticket não encontrado");

    expect(mocks.ticketFindFirst).toHaveBeenCalledWith({
      where: { id: "ticket-999", ativo: true, empresa: { in: ["LESSUL"] } }
    });
  });
});
