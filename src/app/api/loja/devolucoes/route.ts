import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentApiUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createDevolucaoRecebidaTicket } from "@/lib/services/tickets-service";
import { AppError, ForbiddenError } from "@/lib/errors";
import { CANAIS_MARKETPLACE, EMPRESAS, normalizeCanalMarketplace } from "@/config/domains";

const schema = z.object({
  nomeCliente: z.string().min(3, "Informe o nome do cliente"),
  numeroVenda: z.string().min(3, "Informe o número da venda"),
  canalMarketplace: z.preprocess(
    (value) => normalizeCanalMarketplace(typeof value === "string" ? value : undefined),
    z.enum(CANAIS_MARKETPLACE, { message: "Marketplace inválido" })
  ),
  empresa: z.enum(EMPRESAS),
  produto: z.string().min(2, "Informe o produto"),
  sku: z.string().min(2, "Informe o SKU")
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentApiUser();

    if (user.perfil !== "LOJA") {
      throw new ForbiddenError();
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ message: "Anexe uma foto do produto recebido" }, { status: 400 });
    }

    const parsed = schema.safeParse({
      nomeCliente: formData.get("nomeCliente"),
      numeroVenda: formData.get("numeroVenda"),
      canalMarketplace: formData.get("canalMarketplace"),
      empresa: formData.get("empresa"),
      produto: formData.get("produto"),
      sku: formData.get("sku")
    });

    if (!parsed.success) {
      return NextResponse.json({ message: "Dados inválidos", issues: parsed.error.issues }, { status: 422 });
    }

    const vinculos = await prisma.usuarioEmpresa.findMany({ where: { usuarioId: user.id } });
    const empresasPermitidas = vinculos.length
      ? vinculos.map((item) => item.empresa)
      : user.empresaVinculada
        ? [user.empresaVinculada]
        : [];

    if (!empresasPermitidas.includes(parsed.data.empresa)) {
      throw new ForbiddenError("Empresa não vinculada ao usuário");
    }

    const ticket = await createDevolucaoRecebidaTicket(parsed.data, file, user);

    return NextResponse.json({ data: { id: ticket.id } }, { status: 201 });
  } catch (error: any) {
    const status = error instanceof AppError ? error.status : 500;
    const message = error.message || "Falha ao registrar devolução recebida";
    return NextResponse.json({ message, code: error.code }, { status });
  }
}
