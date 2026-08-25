import { NextRequest } from "next/server";
import { z } from "zod";
import { extractBearerToken, resolveUserFromToken } from "@/lib/auth/personal-access-token";
import { encodeTicketPrefill } from "@/lib/services/ticket-prefill";
import { UnauthorizedError } from "@/lib/errors";
import { withApiHandler } from "@/lib/http";

// Only Mercado Livre is supported for now; other marketplaces are future work.
const importSchema = z.object({
  canalMarketplace: z.literal("MERCADO_LIVRE"),
  nomeCliente: z.string().optional(),
  numeroVenda: z.string().optional(),
  produto: z.string().optional(),
  sku: z.string().optional(),
  dataCompra: z.string().optional(),
  linkPedido: z.string().optional()
});

export async function POST(request: NextRequest) {
  return withApiHandler(async () => {
    const token = extractBearerToken(request);
    if (!token) throw new UnauthorizedError("Token de acesso ausente");

    await resolveUserFromToken(token);

    const payload = importSchema.parse(await request.json());
    const encoded = encodeTicketPrefill(payload);

    return { data: { prefillPath: `/tickets/new?prefill=${encoded}` } };
  });
}
