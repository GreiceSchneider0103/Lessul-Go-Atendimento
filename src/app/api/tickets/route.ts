import { NextRequest } from "next/server";
import { getCurrentApiUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { createTicket, listTickets } from "@/lib/services/tickets-service";
import { ticketFiltersSchema, ticketSchema } from "@/lib/validation/ticket";
import { withApiHandler } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { ForbiddenError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    if (user.perfil === "LOJA") throw new ForbiddenError("Perfil loja não acessa tickets gerais");
    const filters = ticketFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    return listTickets(filters, user);
  });
}

export async function POST(request: NextRequest) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    if (user.perfil === "LOJA") throw new ForbiddenError("Perfil loja não acessa tickets gerais");
    assertPermission(user.perfil, "ticket.create");
    const raw = await request.json();
    const payload = ticketSchema.parse(user.perfil === "LOJA" ? { ...raw, empresa: user.empresaVinculada ?? raw.empresa } : raw);
    if (user.perfil === "LOJA" && !user.empresaVinculada) throw new AppError("Usuário LOJA sem empresa vinculada", 400, "LOJA_EMPRESA_REQUIRED");
    try {
      return createTicket(payload, user.id);
    } catch (error) {
      logError("Erro ao criar ticket", { route: "POST /api/tickets", perfil: user.perfil, userId: user.id, message: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  });
}
