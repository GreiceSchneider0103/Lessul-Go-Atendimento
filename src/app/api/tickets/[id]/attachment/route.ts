import { getCurrentApiUser } from "@/lib/auth/session";
import { withApiHandler } from "@/lib/http";
import { removeTicketAttachment, uploadTicketAttachment } from "@/lib/services/tickets-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    const { id } = await params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new Error("Arquivo é obrigatório");
    }
    return { data: await uploadTicketAttachment(id, user, file) };
  });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    const { id } = await params;
    return { data: await removeTicketAttachment(id, user) };
  });
}
