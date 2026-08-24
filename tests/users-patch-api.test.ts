import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentApiUser: vi.fn(),
  usuarioFindUnique: vi.fn(),
  usuarioUpdate: vi.fn(),
  getUsuarioEmpresas: vi.fn(),
  replaceUsuarioEmpresas: vi.fn(),
  attachEmpresasToUsuarios: vi.fn(),
  normalizeEmpresas: vi.fn(),
  registerUserAudit: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentApiUser: mocks.getCurrentApiUser
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    usuario: {
      findUnique: mocks.usuarioFindUnique,
      update: mocks.usuarioUpdate
    },
    $transaction: async (fn: (tx: unknown) => unknown) => fn({ usuario: { update: mocks.usuarioUpdate } })
  }
}));

vi.mock("@/lib/services/users-service", () => ({
  getUsuarioEmpresas: mocks.getUsuarioEmpresas,
  replaceUsuarioEmpresas: mocks.replaceUsuarioEmpresas,
  attachEmpresasToUsuarios: mocks.attachEmpresasToUsuarios,
  normalizeEmpresas: mocks.normalizeEmpresas
}));

vi.mock("@/lib/audit/user-audit", () => ({
  registerUserAudit: mocks.registerUserAudit
}));

import { PATCH } from "@/app/api/users/[id]/route";

const params = { params: Promise.resolve({ id: "user-1" }) };

describe("PATCH /api/users/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persiste múltiplas empresas vinculadas ao editar um usuário LOJA (regressão)", async () => {
    mocks.getCurrentApiUser.mockResolvedValue({ id: "actor-1", perfil: "MASTER" });
    mocks.usuarioFindUnique.mockResolvedValue({ id: "user-1", perfil: "LOJA", ativo: true, empresaVinculada: "LESSUL" });
    mocks.normalizeEmpresas.mockReturnValue(["LESSUL", "MODIFIKA"]);
    mocks.usuarioUpdate.mockResolvedValue({ id: "user-1", perfil: "LOJA", ativo: true, empresaVinculada: "LESSUL" });
    mocks.getUsuarioEmpresas.mockResolvedValue([]);
    mocks.attachEmpresasToUsuarios.mockReturnValue([{ id: "user-1", empresasVinculadas: ["LESSUL", "MODIFIKA"] }]);

    const request = new Request("http://localhost/api/users/user-1", {
      method: "PATCH",
      body: JSON.stringify({ empresasVinculadas: ["LESSUL", "MODIFIKA"] })
    });

    const response = await PATCH(request, params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.replaceUsuarioEmpresas).toHaveBeenCalledWith(expect.anything(), "user-1", ["LESSUL", "MODIFIKA"]);
    expect(body.data.empresasVinculadas).toEqual(["LESSUL", "MODIFIKA"]);
  });

  it("não mexe nas empresas vinculadas ao atualizar apenas o status ativo", async () => {
    mocks.getCurrentApiUser.mockResolvedValue({ id: "actor-1", perfil: "MASTER" });
    mocks.usuarioFindUnique.mockResolvedValue({ id: "user-1", perfil: "LOJA", ativo: true, empresaVinculada: "LESSUL" });
    mocks.usuarioUpdate.mockResolvedValue({ id: "user-1", perfil: "LOJA", ativo: false, empresaVinculada: "LESSUL" });
    mocks.getUsuarioEmpresas.mockResolvedValue([{ usuarioId: "user-1", empresa: "LESSUL" }]);
    mocks.attachEmpresasToUsuarios.mockReturnValue([{ id: "user-1", empresasVinculadas: ["LESSUL"] }]);

    const request = new Request("http://localhost/api/users/user-1", {
      method: "PATCH",
      body: JSON.stringify({ ativo: false })
    });

    const response = await PATCH(request, params);

    expect(response.status).toBe(200);
    expect(mocks.replaceUsuarioEmpresas).not.toHaveBeenCalled();
  });

  it("bloqueia remover todas as empresas de um usuário LOJA", async () => {
    mocks.getCurrentApiUser.mockResolvedValue({ id: "actor-1", perfil: "MASTER" });
    mocks.usuarioFindUnique.mockResolvedValue({ id: "user-1", perfil: "LOJA", ativo: true, empresaVinculada: "LESSUL" });
    mocks.normalizeEmpresas.mockReturnValue([]);

    const request = new Request("http://localhost/api/users/user-1", {
      method: "PATCH",
      body: JSON.stringify({ empresasVinculadas: [] })
    });

    const response = await PATCH(request, params);

    expect(response.status).toBe(400);
    expect(mocks.replaceUsuarioEmpresas).not.toHaveBeenCalled();
  });
});
