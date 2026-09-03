import { NextRequest } from "next/server";
import { getCurrentApiUser } from "@/lib/auth/session";
import { withApiHandler } from "@/lib/http";
import { assertPermission } from "@/lib/rbac/permissions";
import { createDevolucaoInterna, listDevolucoesInternas } from "@/lib/services/devolucoes-internas-service";
import { devolucaoInternaFiltersSchema, devolucaoInternaSchema } from "@/lib/validation/devolucao-interna";

export async function GET(request: NextRequest) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    assertPermission(user.perfil, "devolucoes_internas.view");

    const filters = devolucaoInternaFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    return { data: await listDevolucoesInternas(filters) };
  });
}

export async function POST(request: NextRequest) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    assertPermission(user.perfil, "devolucoes_internas.update");

    const payload = devolucaoInternaSchema.parse(await request.json());
    return { data: await createDevolucaoInterna(payload, user.id) };
  });
}
