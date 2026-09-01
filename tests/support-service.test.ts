import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  supportTicketFindUnique: vi.fn(),
  supportTicketCreate: vi.fn(),
  supportTicketUpdate: vi.fn(),
  supportComentarioCreate: vi.fn()
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    supportTicket: {
      findUnique: mocks.supportTicketFindUnique,
      create: mocks.supportTicketCreate,
      update: mocks.supportTicketUpdate
    },
    supportComentario: { create: mocks.supportComentarioCreate }
  }
}));

vi.mock("@/lib/supabase/service-role", () => ({ createSupabaseAdmin: vi.fn() }));

import { createSupportTicket, updateSupportTicket } from "@/lib/services/support-service";

describe("createSupportTicket authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a non-LOJA actor", async () => {
    const actor = { id: "atendente-1", perfil: "ATENDENTE" as const, empresaVinculada: null };

    await expect(
      createSupportTicket({ empresa: "LESSUL", categoria: "GERAL", titulo: "x", descricao: "y" }, [], actor)
    ).rejects.toThrow("Apenas o perfil loja pode abrir chamados de suporte");

    expect(mocks.supportTicketCreate).not.toHaveBeenCalled();
  });

  it("rejects a LOJA actor opening a chamado for an empresa they aren't linked to", async () => {
    const actor = { id: "loja-1", perfil: "LOJA" as const, empresaVinculada: "LESSUL" as const, empresasVinculadas: ["LESSUL" as const] };

    await expect(
      createSupportTicket({ empresa: "MODIFIKA", categoria: "GERAL", titulo: "x", descricao: "y" }, [], actor)
    ).rejects.toThrow("Empresa não vinculada ao usuário");

    expect(mocks.supportTicketCreate).not.toHaveBeenCalled();
  });
});

describe("updateSupportTicket LOJA restrictions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.supportTicketFindUnique.mockResolvedValue({
      id: "chamado-1",
      empresa: "LESSUL",
      status: "ABERTO",
      prazoResposta: new Date(Date.now() + 86400000),
      responsavel: null,
      criadoPor: null,
      anexos: [],
      comentarios: []
    });
  });

  it("blocks a LOJA actor from changing status", async () => {
    const actor = { id: "loja-1", perfil: "LOJA" as const, empresaVinculada: "LESSUL" as const, empresasVinculadas: ["LESSUL" as const] };

    await expect(updateSupportTicket("chamado-1", { status: "CONCLUIDO" }, actor)).rejects.toThrow(
      "Perfil loja não pode alterar o status do chamado"
    );

    expect(mocks.supportTicketUpdate).not.toHaveBeenCalled();
  });

  it("blocks a LOJA actor from assigning a responsável", async () => {
    const actor = { id: "loja-1", perfil: "LOJA" as const, empresaVinculada: "LESSUL" as const, empresasVinculadas: ["LESSUL" as const] };

    await expect(updateSupportTicket("chamado-1", { responsavelId: "user-2" }, actor)).rejects.toThrow(
      "Perfil loja não pode atribuir responsável"
    );

    expect(mocks.supportTicketUpdate).not.toHaveBeenCalled();
  });
});
