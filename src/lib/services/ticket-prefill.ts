import { z } from "zod";
import { CANAIS_MARKETPLACE } from "@/config/domains";

/**
 * Stateless prefill encoding for the order-import extension: the payload is
 * base64url JSON embedded directly in the /tickets/new URL, not persisted or
 * signed. This is safe because prefill data only pre-populates form fields —
 * ticket creation still runs the real createTicket validation and RBAC on
 * submit, so a tampered param has no effect beyond cosmetic pre-fill.
 */
export const ticketPrefillSchema = z.object({
  canalMarketplace: z.enum(CANAIS_MARKETPLACE).optional(),
  nomeCliente: z.string().optional(),
  numeroVenda: z.string().optional(),
  produto: z.string().optional(),
  sku: z.string().optional(),
  dataCompra: z.string().optional(),
  dataReclamacao: z.string().optional(),
  linkPedido: z.string().optional(),
  cpf: z.string().optional(),
  uf: z.string().optional()
});

export type TicketPrefill = z.infer<typeof ticketPrefillSchema>;

export function encodeTicketPrefill(data: TicketPrefill) {
  return Buffer.from(JSON.stringify(data), "utf8").toString("base64url");
}

export function decodeTicketPrefill(encoded: string): TicketPrefill | null {
  try {
    const json = Buffer.from(encoded, "base64url").toString("utf8");
    return ticketPrefillSchema.parse(JSON.parse(json));
  } catch {
    return null;
  }
}
