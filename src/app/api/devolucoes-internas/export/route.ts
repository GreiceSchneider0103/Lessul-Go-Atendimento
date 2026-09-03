import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentApiUser } from "@/lib/auth/session";
import { assertPermission } from "@/lib/rbac/permissions";
import { listDevolucoesInternas } from "@/lib/services/devolucoes-internas-service";
import { devolucaoInternaFiltersSchema } from "@/lib/validation/devolucao-interna";
import { formatDateBR, formatEnumLabel } from "@/lib/formatters/display";
import { withApiHandler } from "@/lib/http";

export async function GET(request: NextRequest) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    assertPermission(user.perfil, "devolucoes_internas.view");

    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const format = params.format ?? "csv";
    const filters = devolucaoInternaFiltersSchema.parse(params);

    const items = await listDevolucoesInternas(filters);
    const data = items.map((item) => ({
      numero: item.numero,
      codigo_venda: item.codigoVenda,
      cliente: item.cliente,
      canal: formatEnumLabel(item.canalMarketplace),
      produto: item.produto,
      sku: item.sku ?? "",
      defeito: formatEnumLabel(item.defeito),
      data_recebimento: item.dataRecebimento ? formatDateBR(item.dataRecebimento) : "",
      data_revisao: item.dataRevisao ? formatDateBR(item.dataRevisao) : "",
      solucao: item.solucao ? formatEnumLabel(item.solucao) : "",
      solicitado_reembolso: item.solicitadoReembolso ? "SIM" : "NÃO",
      valor_recuperado: Number(item.valorRecuperado)
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "devolucoes_internas");

    if (format === "xlsx") {
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="devolucoes-internas.xlsx"'
        }
      });
    }

    const csv = XLSX.utils.sheet_to_csv(worksheet);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="devolucoes-internas.csv"'
      }
    });
  });
}
