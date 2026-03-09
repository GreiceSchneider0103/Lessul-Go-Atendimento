<<<<<<< HEAD
import { NextRequest } from "next/server";
import { getCurrentApiUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { createTicket, listTickets } from "@/lib/services/tickets-service";
import { ticketFiltersSchema, ticketSchema } from "@/lib/validation/ticket";
import { withApiHandler } from "@/lib/http";

export async function GET(request: NextRequest) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    const filters = ticketFiltersSchema.parse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    return listTickets(filters, user);
  });
}

export async function POST(request: NextRequest) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    assertPermission(user.perfil, "ticket.create");
    const payload = ticketSchema.parse(await request.json());
    return createTicket(payload, user.id);
  });
=======
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/permissions";
import { createTicket, listTickets } from "@/lib/services/tickets-service";
import { ticketSchema } from "@/lib/validation/ticket";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const search = request.nextUrl.searchParams.get("search") ?? undefined;
  const page = Number(request.nextUrl.searchParams.get("page") ?? 1);
  const data = await listTickets({ search, page });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!hasPermission(user.perfil, "ticket.create")) {
    return NextResponse.json({ message: "Sem permissão" }, { status: 403 });
  }

  const payload = ticketSchema.parse(await request.json());
  const ticket = await createTicket(payload, user.id);
  return NextResponse.json(ticket, { status: 201 });
>>>>>>> origin/main
}
