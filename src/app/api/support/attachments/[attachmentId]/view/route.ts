import { NextRequest, NextResponse } from "next/server";
import { getCurrentApiUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { empresasFor } from "@/lib/services/operational-requests-service";
import { createSupabaseAdmin } from "@/lib/supabase/service-role";
import { logError } from "@/lib/logger";

type Params = Promise<{ attachmentId: string }>;

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { attachmentId } = await params;
    const user = await getCurrentApiUser();

    const attachment = await prisma.supportAnexo.findUnique({
      where: { id: attachmentId },
      select: { storagePath: true, supportTicket: { select: { empresa: true } } }
    });

    if (!attachment) {
      return NextResponse.json({ message: "Anexo não encontrado" }, { status: 404 });
    }

    if (user.perfil === "LOJA" && !empresasFor(user).includes(attachment.supportTicket.empresa)) {
      return NextResponse.json({ message: "Anexo não encontrado ou sem acesso" }, { status: 404 });
    }

    const supabase = createSupabaseAdmin();
    const { data: signedData, error: signedUrlError } = await supabase.storage
      .from("ticket-anexos")
      .createSignedUrl(attachment.storagePath, 60 * 5);

    if (signedUrlError || !signedData?.signedUrl) {
      logError("Falha ao gerar signed URL do anexo de suporte", {
        attachmentId,
        storagePath: attachment.storagePath,
        message: signedUrlError?.message ?? "Signed URL não gerada"
      });

      return NextResponse.json({ message: "Falha ao acessar anexo" }, { status: 500 });
    }

    return NextResponse.redirect(signedData.signedUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao acessar anexo";
    logError("Erro ao visualizar anexo de suporte", { message });
    return NextResponse.json({ message }, { status: 500 });
  }
}
