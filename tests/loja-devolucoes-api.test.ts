import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentApiUser: vi.fn(),
  createDevolucaoRecebidaTicket: vi.fn(),
  usuarioEmpresaFindMany: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentApiUser: mocks.getCurrentApiUser
}));

vi.mock("@/lib/services/tickets-service", () => ({
  createDevolucaoRecebidaTicket: mocks.createDevolucaoRecebidaTicket
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    usuarioEmpresa: {
      findMany: mocks.usuarioEmpresaFindMany
    }
  }
}));

import { POST } from "@/app/api/loja/devolucoes/route";

function buildFormData(overrides: Record<string, string> = {}, includeFile = true) {
  const formData = new FormData();
  formData.set("nomeCliente", overrides.nomeCliente ?? "Cliente Teste");
  formData.set("numeroVenda", overrides.numeroVenda ?? "12345678");
  formData.set("canalMarketplace", overrides.canalMarketplace ?? "MERCADO_LIVRE");
  formData.set("empresa", overrides.empresa ?? "LESSUL");
  formData.set("produto", overrides.produto ?? "Cadeira");
  formData.set("sku", overrides.sku ?? "SKU-1");

  if (includeFile) {
    formData.set("file", new File(["foto"], "foto.png", { type: "image/png" }));
  }

  return formData;
}

describe("POST /api/loja/devolucoes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks perfis diferentes de LOJA", async () => {
    mocks.getCurrentApiUser.mockResolvedValue({ id: "user-1", perfil: "ADMIN" });

    const response = await POST(
      new NextRequest("http://localhost/api/loja/devolucoes", { method: "POST", body: buildFormData() })
    );

    expect(response.status).toBe(403);
    expect(mocks.createDevolucaoRecebidaTicket).not.toHaveBeenCalled();
  });

  it("exige a foto do produto recebido", async () => {
    mocks.getCurrentApiUser.mockResolvedValue({ id: "loja-1", perfil: "LOJA" });

    const response = await POST(
      new NextRequest("http://localhost/api/loja/devolucoes", {
        method: "POST",
        body: buildFormData({}, false)
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.createDevolucaoRecebidaTicket).not.toHaveBeenCalled();
  });

  it("bloqueia empresa fora do vínculo do usuário LOJA", async () => {
    mocks.getCurrentApiUser.mockResolvedValue({ id: "loja-1", perfil: "LOJA", empresaVinculada: "LESSUL" });
    mocks.usuarioEmpresaFindMany.mockResolvedValue([{ empresa: "LESSUL" }]);

    const response = await POST(
      new NextRequest("http://localhost/api/loja/devolucoes", {
        method: "POST",
        body: buildFormData({ empresa: "MODIFIKA" })
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.createDevolucaoRecebidaTicket).not.toHaveBeenCalled();
  });

  it("cria o ticket quando o LOJA envia dados válidos para uma empresa vinculada", async () => {
    const user = { id: "loja-1", perfil: "LOJA", empresaVinculada: "LESSUL" };
    mocks.getCurrentApiUser.mockResolvedValue(user);
    mocks.usuarioEmpresaFindMany.mockResolvedValue([{ empresa: "LESSUL" }, { empresa: "MODIFIKA" }]);
    mocks.createDevolucaoRecebidaTicket.mockResolvedValue({ id: "ticket-1" });

    const response = await POST(
      new NextRequest("http://localhost/api/loja/devolucoes", {
        method: "POST",
        body: buildFormData({ empresa: "MODIFIKA" })
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.createDevolucaoRecebidaTicket).toHaveBeenCalledTimes(1);
    const [inputArg, fileArg, userArg] = mocks.createDevolucaoRecebidaTicket.mock.calls[0];
    expect(inputArg.empresa).toBe("MODIFIKA");
    expect(fileArg).toBeInstanceOf(File);
    expect(userArg).toBe(user);
  });
});
