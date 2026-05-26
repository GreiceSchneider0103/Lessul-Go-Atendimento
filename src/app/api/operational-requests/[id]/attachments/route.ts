import { getCurrentApiUser } from "@/lib/auth/session";
import { withApiHandler } from "@/lib/http";
import { listAttachments, uploadAttachment } from "@/lib/services/operational-requests-service";
import { TipoAnexoOperacional } from "@prisma/client";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    const { id } = await params;
    return { data: await listAttachments(id, user) };
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    const tipoAnexo = String(form.get("tipoAnexo") ?? "OUTRO") as TipoAnexoOperacional;
    if (!(file instanceof File)) throw new Error("Arquivo é obrigatório");
    return { data: await uploadAttachment(id, file, tipoAnexo, user) };
  });
}
