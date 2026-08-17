import { NextRequest } from "next/server";
import { getCurrentApiUser } from "@/lib/auth/session";
import { withApiHandler } from "@/lib/http";
import { assertPermission } from "@/lib/rbac/permissions";
import { deleteOperationalRequest, updateOperationalRequest } from "@/lib/services/operational-requests-service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    assertPermission(user.perfil, "operational.update");
    const { id } = await params;
    return { data: await updateOperationalRequest(id, user, await request.json()) };
  });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    assertPermission(user.perfil, "operational.update");
    const { id } = await params;
    return { data: await deleteOperationalRequest(id, user) };
  });
}
