import { NextRequest, NextResponse } from "next/server";
import { getCurrentApiUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getTicketScopeWhere } from "@/lib/rbac/permissions";
import { createSupabaseAdmin } from "@/lib/supabase/service-role";
import { logError } from "@/lib/logger";

type Params = Promise<{ attachmentId: string }>;

/**
 * OperationalRequestAttachment rows (the loja photo uploads) live in the
 * ticket-anexos bucket, which requires a signed URL to read back — the
 * fileUrl saved at upload time was a public-bucket URL that never actually
 * worked against it. Regenerates a short-lived signed URL on every view
 * instead of trusting a stored URL that can be wrong or expired.
 */
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { attachmentId } = await params;
    const user = await getCurrentApiUser();

    const attachment = await prisma.operationalRequestAttachment.findUnique({
      where: { id: attachmentId },
      select: { storagePath: true, ticketId: true }
    });

    if (!attachment?.storagePath) {
      return NextResponse.json({ message: "Anexo não encontrado" }, { status: 404 });
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: attachment.ticketId, ...getTicketScopeWhere(user) },
      select: { id: true }
    });

    if (!ticket) {
      return NextResponse.json({ message: "Anexo não encontrado ou sem acesso" }, { status: 404 });
    }

    const supabase = createSupabaseAdmin();
    const { data: signedData, error: signedUrlError } = await supabase.storage
      .from("ticket-anexos")
      .createSignedUrl(attachment.storagePath, 60 * 5);

    if (signedUrlError || !signedData?.signedUrl) {
      logError("Falha ao gerar signed URL do anexo operacional", {
        attachmentId,
        storagePath: attachment.storagePath,
        message: signedUrlError?.message ?? "Signed URL não gerada"
      });

      return NextResponse.json({ message: "Falha ao acessar anexo" }, { status: 500 });
    }

    return NextResponse.redirect(signedData.signedUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao acessar anexo";
    logError("Erro ao visualizar anexo operacional", { message });
    return NextResponse.json({ message }, { status: 500 });
  }
}
