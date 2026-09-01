import { NextRequest } from "next/server";
import { z } from "zod";
import { SupportStatus } from "@prisma/client";
import { getCurrentApiUser } from "@/lib/auth/session";
import { withApiHandler } from "@/lib/http";
import { assertPermission } from "@/lib/rbac/permissions";
import { getSupportTicketById, updateSupportTicket } from "@/lib/services/support-service";

type Params = Promise<{ id: string }>;

const updateSchema = z.object({
  status: z.nativeEnum(SupportStatus).optional(),
  responsavelId: z.string().uuid().nullable().optional(),
  comentario: z.string().optional()
});

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    assertPermission(user.perfil, "support.view");
    const { id } = await params;
    return { data: await getSupportTicketById(id, user) };
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Params }) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    assertPermission(user.perfil, "support.update");
    const { id } = await params;
    const payload = updateSchema.parse(await request.json());
    return { data: await updateSupportTicket(id, payload, user) };
  });
}
