import { NextRequest, NextResponse } from "next/server";
import { getCurrentApiUser } from "@/lib/auth/session";
import { uploadTicketAttachment, removeTicketAttachment } from "@/lib/services/tickets-service";
import { AppError } from "@/lib/errors";

type Params = Promise<{ id: string }>;

export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const user = await getCurrentApiUser();

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ message: "Arquivo obrigatório" }, { status: 400 });
    }

    const updatedTicket = await uploadTicketAttachment(id, user, file);

    // Retorna o ticket com BigInt convertido
    return NextResponse.json({ 
      data: { 
        ...updatedTicket, 
        anexoSizeBytes: updatedTicket.anexoSizeBytes ? Number(updatedTicket.anexoSizeBytes) : null 
      } 
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.status : 500;
    const message = error.message || "Falha no upload do anexo";
    return NextResponse.json({ message, code: error.code }, { status });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const user = await getCurrentApiUser();

    const updatedTicket = await removeTicketAttachment(id, user);

    return NextResponse.json({ 
      data: { 
        ...updatedTicket, 
        anexoSizeBytes: updatedTicket.anexoSizeBytes ? Number(updatedTicket.anexoSizeBytes) : null 
      } 
    });
  } catch (error: any) {
    const status = error instanceof AppError ? error.status : 500;
    const message = error.message || "Falha ao remover anexo";
    return NextResponse.json({ message, code: error.code }, { status });
  }
}
