import { StatusTicket } from "@prisma/client";
import { AppError } from "@/lib/errors";

export type SLAStatus = "CONCLUIDO" | "ATRASADO" | "NO_PRAZO";

export function calculateSla(statusTicket: StatusTicket, prazoConclusao?: Date | null): SLAStatus {
  if (statusTicket === "CONCLUIDO") return "CONCLUIDO";
  if (prazoConclusao && new Date() > prazoConclusao) return "ATRASADO";
  return "NO_PRAZO";
}

export function assertSlaConsistency(statusTicket: StatusTicket, prazoConclusao?: Date | null) {
  if (statusTicket !== "CONCLUIDO" && !prazoConclusao) {
    throw new AppError("Prazo de conclusão é obrigatório para tickets não concluídos.", 422, "PRAZO_REQUIRED");
  }
}
