import { NextRequest } from "next/server";
import { Perfil } from "@prisma/client";
import { getCurrentApiUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { createTicket, listTickets } from "@/lib/services/tickets-service";
import { ticketFiltersSchema, ticketSchema } from "@/lib/validation/ticket";
import { withApiHandler } from "@/lib/http";
import { AppError, ForbiddenError } from "@/lib/errors";
import { logError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    const perfil = user.perfil as Perfil;

    if (perfil === Perfil.LOJA) throw new ForbiddenError("Perfil loja não acessa tickets gerais");

    const filters = ticketFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    return listTickets(filters, user);
  });
}

export async function POST(request: NextRequest) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    const perfil = user.perfil as Perfil;
    const isLoja = perfil === Perfil.LOJA;

    assertPermission(perfil, "ticket.create");

    const raw = await request.json();

    if (isLoja && !user.empresaVinculada) {
      throw new AppError("Usuário LOJA sem empresa vinculada", 400, "LOJA_EMPRESA_REQUIRED");
    }

    const normalizedRaw = isLoja
      ? { ...raw, empresa: user.empresaVinculada ?? raw.empresa }
      : raw;

    const payload = ticketSchema.parse(normalizedRaw);

    try {
      return createTicket(payload, user.id);
    } catch (error) {
      logError("Erro ao criar ticket", {
        route: "POST /api/tickets",
        perfil,
        userId: user.id,
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  });
}
