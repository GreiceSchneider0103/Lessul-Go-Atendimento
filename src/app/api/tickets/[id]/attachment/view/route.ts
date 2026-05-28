import { NextRequest, NextResponse } from "next/server";
import { getCurrentApiUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createSupabaseAdmin } from "@/lib/supabase/service-role";
import { getTicketScopeWhere } from "@/lib/rbac/permissions";
import { AppError, ForbiddenError } from "@/lib/errors";
import { logError } from "@/lib/logger";

type Params = Promise<{ id: string }>;

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const user = await getCurrentApiUser();

    // Buscar ticket com segurança de escopo
    const ticket = await prisma.ticket.findFirst({
      where: {
        id,
        ativo: true,
        ...getTicketScopeWhere(user)
      },
      select: {
        id: true,
        anexoPath: true
      }
    });

    if (!ticket) {
      return NextResponse.json({ message: "Ticket não encontrado ou sem acesso" }, { status: 404 });
    }

    if (!ticket.anexoPath) {
      return NextResponse.json({ message: "Ticket sem anexo" }, { status: 404 });
    }

    // Gerar uma Signed URL nova (válida por 5 minutos)
    const supabase = createSupabaseAdmin();
    const bucket = "ticket-anexos";

    const { data: signedData, error: signedUrlError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(ticket.anexoPath, 60 * 5);

    if (signedUrlError || !signedData?.signedUrl) {
      logError("Falha ao gerar signed URL do anexo no view", {
        ticketId: id,
        anexoPath: ticket.anexoPath,
        message: signedUrlError?.message ?? "Signed URL não gerada"
      });

      return NextResponse.json(
        { message: "Falha ao acessar anexo" },
        { status: 500 }
      );
    }

    // Redirecionar para a Signed URL
    return NextResponse.redirect(signedData.signedUrl);
  } catch (error: any) {
    const message = error instanceof AppError ? error.message : error?.message ?? "Erro ao acessar anexo";
    const status = error instanceof ForbiddenError ? 403 : error instanceof AppError ? error.status : 500;

    logError("Erro ao visualizar anexo do ticket", {
      message,
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json({ message }, { status });
  }
}
