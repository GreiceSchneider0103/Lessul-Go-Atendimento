import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentApiUser: vi.fn(),
  createDevolucaoRecebidaTicket: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentApiUser: mocks.getCurrentApiUser
}));

vi.mock("@/lib/services/tickets-service", () => ({
  createDevolucaoRecebidaTicket: mocks.createDevolucaoRecebidaTicket,
  RETURN_PHOTOS_MIN_COUNT: 5
}));

import { POST } from "@/app/api/loja/devolucoes/route";

function buildFormData(overrides: Record<string, string> = {}, fileCount = 5) {
  const formData = new FormData();
  formData.set("nomeCliente", overrides.nomeCliente ?? "Cliente Teste");
  formData.set("numeroVenda", overrides.numeroVenda ?? "12345678");
  formData.set("dataRecebimento", overrides.dataRecebimento ?? "2026-08-20");
  formData.set("canalMarketplace", overrides.canalMarketplace ?? "MERCADO_LIVRE");
  formData.set("empresa", overrides.empresa ?? "LESSUL");
  formData.set("produto", overrides.produto ?? "Cadeira");
  formData.set("sku", overrides.sku ?? "SKU-1");

  for (let index = 0; index < fileCount; index += 1) {
    formData.append("files", new File(["foto"], `foto-${index}.png`, { type: "image/png" }));
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

  it("exige pelo menos 5 fotos do produto recebido", async () => {
    mocks.getCurrentApiUser.mockResolvedValue({ id: "loja-1", perfil: "LOJA" });

    const response = await POST(
      new NextRequest("http://localhost/api/loja/devolucoes", {
        method: "POST",
        body: buildFormData({}, 3)
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.createDevolucaoRecebidaTicket).not.toHaveBeenCalled();
  });

  it("bloqueia empresa fora do vínculo do usuário LOJA", async () => {
    mocks.getCurrentApiUser.mockResolvedValue({
      id: "loja-1",
      perfil: "LOJA",
      empresaVinculada: "LESSUL",
      empresasVinculadas: ["LESSUL"]
    });

    const response = await POST(
      new NextRequest("http://localhost/api/loja/devolucoes", {
        method: "POST",
        body: buildFormData({ empresa: "MODIFIKA" })
      })
    );

    expect(response.status).toBe(403);
    expect(mocks.createDevolucaoRecebidaTicket).not.toHaveBeenCalled();
  });

  it("cria o ticket quando o LOJA envia dados válidos com 5+ fotos para uma empresa vinculada", async () => {
    const user = {
      id: "loja-1",
      perfil: "LOJA",
      empresaVinculada: "LESSUL",
      empresasVinculadas: ["LESSUL", "MODIFIKA"]
    };
    mocks.getCurrentApiUser.mockResolvedValue(user);
    mocks.createDevolucaoRecebidaTicket.mockResolvedValue({ id: "ticket-1" });

    const response = await POST(
      new NextRequest("http://localhost/api/loja/devolucoes", {
        method: "POST",
        body: buildFormData({ empresa: "MODIFIKA" }, 7)
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.createDevolucaoRecebidaTicket).toHaveBeenCalledTimes(1);
    const [inputArg, filesArg, userArg] = mocks.createDevolucaoRecebidaTicket.mock.calls[0];
    expect(inputArg.empresa).toBe("MODIFIKA");
    expect(filesArg).toHaveLength(7);
    expect(filesArg[0]).toBeInstanceOf(File);
    expect(userArg).toBe(user);
  });
});
