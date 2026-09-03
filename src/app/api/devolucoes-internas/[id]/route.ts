import { NextRequest } from "next/server";
import { getCurrentApiUser } from "@/lib/auth/session";
import { withApiHandler } from "@/lib/http";
import { assertPermission } from "@/lib/rbac/permissions";
import { deleteDevolucaoInterna, getDevolucaoInternaById, updateDevolucaoInterna } from "@/lib/services/devolucoes-internas-service";
import { devolucaoInternaSchema } from "@/lib/validation/devolucao-interna";

type Params = Promise<{ id: string }>;

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    assertPermission(user.perfil, "devolucoes_internas.view");
    const { id } = await params;
    return { data: await getDevolucaoInternaById(id) };
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    assertPermission(user.perfil, "devolucoes_internas.update");
    const { id } = await params;
    const payload = devolucaoInternaSchema.partial().parse(await request.json());
    return { data: await updateDevolucaoInterna(id, payload, user.id) };
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    assertPermission(user.perfil, "devolucoes_internas.update");
    const { id } = await params;
    return { data: await deleteDevolucaoInterna(id) };
  });
}
