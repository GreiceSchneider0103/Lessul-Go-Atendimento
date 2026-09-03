import { z } from "zod";
import { DevolucaoDefeito, DevolucaoSolucao } from "@prisma/client";
import { CANAIS_MARKETPLACE, normalizeCanalMarketplace } from "@/config/domains";

const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }, schema.optional());

export const devolucaoInternaSchema = z.object({
  codigoVenda: z.string().min(1, "Informe o código da venda"),
  cliente: z.string().min(1, "Informe o cliente"),
  canalMarketplace: z.preprocess(
    (value) => normalizeCanalMarketplace(typeof value === "string" ? value : undefined),
    z.enum(CANAIS_MARKETPLACE, { message: "Marketplace inválido" })
  ),
  produto: z.string().min(1, "Informe o produto"),
  sku: z.string().optional().or(z.literal("")),
  defeito: z.nativeEnum(DevolucaoDefeito),
  dataRecebimento: z.string().optional().nullable().or(z.literal("")),
  dataRevisao: z.string().optional().nullable().or(z.literal("")),
  solucao: z.nativeEnum(DevolucaoSolucao).optional().nullable().or(z.literal("")),
  solicitadoReembolso: z.coerce.boolean().default(false),
  valorRecuperado: z.coerce.number().min(0).default(0),
  observacao: z.string().optional().or(z.literal(""))
});

export const devolucaoInternaFiltersSchema = z.object({
  canalMarketplace: emptyToUndefined(z.enum(CANAIS_MARKETPLACE)),
  defeito: emptyToUndefined(z.nativeEnum(DevolucaoDefeito)),
  solucao: emptyToUndefined(z.nativeEnum(DevolucaoSolucao)),
  startDate: emptyToUndefined(z.string()),
  endDate: emptyToUndefined(z.string())
});

export type DevolucaoInternaInput = z.infer<typeof devolucaoInternaSchema>;
export type DevolucaoInternaFiltersInput = z.infer<typeof devolucaoInternaFiltersSchema>;
