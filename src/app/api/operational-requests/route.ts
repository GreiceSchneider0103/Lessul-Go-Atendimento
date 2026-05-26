import { NextRequest } from "next/server";
import { getCurrentApiUser } from "@/lib/auth/session";
import { withApiHandler } from "@/lib/http";
import { assertPermission } from "@/lib/rbac/permissions";
import { createFromTicket, listOperationalRequests } from "@/lib/services/operational-requests-service";
import { TipoAcaoOperacional } from "@prisma/client";

export async function GET() {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    return { data: await listOperationalRequests(user) };
  });
}

export async function POST(request: NextRequest) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    assertPermission(user.perfil, "ticket.update");
    const body = await request.json();
    return { data: await createFromTicket(body.ticketId, body.tipoAcao as TipoAcaoOperacional, user) };
  });
}
