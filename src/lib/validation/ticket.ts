import { z } from "zod";
import { CANAIS_MARKETPLACE, EMPRESAS, MOTIVOS, normalizeCanalMarketplace, RESOLUCOES, STATUS_RECLAMACAO, STATUS_TICKET } from "@/config/domains";

const isoDateOrDateString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Data inválida"
});
const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }, schema.optional());

export const ticketSchema = z.object({
  nomeCliente: z.string().min(3),
  dataCompra: isoDateOrDateString,
  numeroVenda: z.string().min(3),
  linkPedido: z.string().url().optional().or(z.literal("")),
  uf: z.string().length(2),
  cpf: z.string().min(11).max(14),
  canalMarketplace: z.preprocess((value) => normalizeCanalMarketplace(typeof value === "string" ? value : undefined), z.enum(CANAIS_MARKETPLACE, { message: "Marketplace inválido" })),
  empresa: z.enum(EMPRESAS),
  produto: z.string().min(2),
  sku: z.string().min(2),
  fabricante: z.string().optional().or(z.literal("")),
  transportadora: z.string().optional().or(z.literal("")),
  statusReclamacao: z.enum(STATUS_RECLAMACAO),
  dataReclamacao: isoDateOrDateString,
  motivo: z.enum(MOTIVOS),
  detalhesCliente: z.string().optional().or(z.literal("")),
  comentarioInterno: z.string().optional().or(z.literal("")),
  resolucao: z.enum(RESOLUCOES).optional().nullable(),
  valorReembolso: z.coerce.number().min(0).default(0),
  valorColeta: z.coerce.number().min(0).default(0),
  statusTicket: z.enum(STATUS_TICKET),
  prazoConclusao: isoDateOrDateString.optional().nullable(),
  responsavelId: z.string().uuid().optional().nullable()
});

export const ticketFormSchema = ticketSchema.extend({
  dataCompra: z.string().min(1, "Data de compra é obrigatória"),
  dataReclamacao: z.string().min(1, "Data da reclamação é obrigatória"),
  prazoConclusao: z.string().optional().nullable(),
  linkPedido: z.string().optional(),
  fabricante: z.string().optional(),
  transportadora: z.string().optional(),
  detalhesCliente: z.string().optional(),
  comentarioInterno: z.string().optional(),
  resolucao: z.enum(RESOLUCOES).or(z.literal("")).optional().nullable(),
  responsavelId: z.string().uuid("Responsável inválido").or(z.literal("")).optional().nullable()
});

export const ticketFiltersSchema = z.object({
  search: emptyToUndefined(z.string()),
  sku: emptyToUndefined(z.string()),
  empresa: emptyToUndefined(z.enum(EMPRESAS)),
  canalMarketplace: emptyToUndefined(z.enum(CANAIS_MARKETPLACE)),
  statusTicket: emptyToUndefined(z.enum(STATUS_TICKET)),
  statusReclamacao: emptyToUndefined(z.enum(STATUS_RECLAMACAO)),
  motivo: emptyToUndefined(z.enum(MOTIVOS)),
  responsavelId: emptyToUndefined(z.string().uuid()),
  criadoPorId: emptyToUndefined(z.string().uuid()),
  startDate: emptyToUndefined(z.string()),
  endDate: emptyToUndefined(z.string()),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(20),
  orderBy: emptyToUndefined(z.enum(["dataReclamacao", "criadoEm", "custosTotais", "prazoConclusao"])).default("criadoEm"),
  orderDir: emptyToUndefined(z.enum(["asc", "desc"])).default("desc"),
  includeConcluidos: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => value === true || value === "true" || value === "1")
    .default(false)
});

export type TicketInput = z.infer<typeof ticketSchema>;
export type TicketFormInput = z.infer<typeof ticketFormSchema>;
export type TicketFiltersInput = z.infer<typeof ticketFiltersSchema>;
