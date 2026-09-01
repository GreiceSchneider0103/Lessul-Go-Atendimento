import { Ticket, Usuario } from "@prisma/client";

export type TicketListResponse = {
  data: Ticket[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
  meta: { orderBy: string; orderDir: string };
};

export type ReportsResponse = {
  items: Ticket[];
  totals: {
    totalTickets: number;
    totalCustos: number;
    totalReembolso: number;
    totalColeta: number;
    totalRecuperado: number;
  };
  breakdowns: {
    porMarketplace: Array<{ name: string; custo: number }>;
    porEmpresa: Array<{ name: string; custo: number }>;
    porMotivo: Array<{ name: string; custo: number }>;
    porSku: Array<{ name: string; custo: number }>;
  };
  meta: {
    limit: number;
    returned: number;
    totalAvailable: number;
    truncated: boolean;
  };
};

export type UsersListResponse = {
  data: Usuario[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
  meta: { resource: "users" };
};
