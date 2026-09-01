import { NextRequest } from "next/server";
import { z } from "zod";
import { SupportCategoria, SupportStatus } from "@prisma/client";
import { getCurrentApiUser } from "@/lib/auth/session";
import { withApiHandler } from "@/lib/http";
import { assertPermission } from "@/lib/rbac/permissions";
import { createSupportTicket, listSupportTickets } from "@/lib/services/support-service";
import { EMPRESAS } from "@/config/domains";

const createSchema = z.object({
  empresa: z.enum(EMPRESAS),
  categoria: z.nativeEnum(SupportCategoria),
  titulo: z.string().min(3, "Informe um título"),
  descricao: z.string().min(3, "Descreva o chamado")
});

export async function GET(request: NextRequest) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    assertPermission(user.perfil, "support.view");

    const params = request.nextUrl.searchParams;
    const empresa = params.get("empresa");
    const status = params.get("status");
    const categoria = params.get("categoria");

    return {
      data: await listSupportTickets(user, {
        empresa: empresa && EMPRESAS.includes(empresa as (typeof EMPRESAS)[number]) ? (empresa as (typeof EMPRESAS)[number]) : undefined,
        status: status && status in SupportStatus ? (status as SupportStatus) : undefined,
        categoria: categoria && categoria in SupportCategoria ? (categoria as SupportCategoria) : undefined
      })
    };
  });
}

export async function POST(request: NextRequest) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();

    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);

    const parsed = createSchema.parse({
      empresa: formData.get("empresa"),
      categoria: formData.get("categoria"),
      titulo: formData.get("titulo"),
      descricao: formData.get("descricao")
    });

    return { data: await createSupportTicket(parsed, files, user) };
  });
}
