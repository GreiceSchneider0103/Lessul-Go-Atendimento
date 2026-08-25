import { getCurrentApiUser } from "@/lib/auth/session";
import { withApiHandler } from "@/lib/http";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";

type Params = Promise<{ id: string }>;

export async function DELETE(_req: Request, { params }: { params: Params }) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    const { id } = await params;

    const token = await prisma.personalAccessToken.findUnique({ where: { id } });

    if (!token || token.usuarioId !== user.id) {
      throw new AppError("Token não encontrado", 404, "TOKEN_NOT_FOUND");
    }

    await prisma.personalAccessToken.update({
      where: { id },
      data: { revokedAt: new Date() }
    });

    return { data: { ok: true } };
  });
}
