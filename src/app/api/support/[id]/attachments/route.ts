import { NextRequest } from "next/server";
import { getCurrentApiUser } from "@/lib/auth/session";
import { withApiHandler } from "@/lib/http";
import { AppError } from "@/lib/errors";
import { uploadSupportAttachment } from "@/lib/services/support-service";

type Params = Promise<{ id: string }>;

export async function POST(request: NextRequest, { params }: { params: Params }) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new AppError("Arquivo é obrigatório", 400, "FILE_REQUIRED");
    }

    return { data: await uploadSupportAttachment(id, file, user) };
  });
}
