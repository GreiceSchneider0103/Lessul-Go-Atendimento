import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { UnauthorizedError } from "@/lib/errors";

const TOKEN_PREFIX = "goat_pat_";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken() {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("hex")}`;
  return { token, hash: hashToken(token) };
}

export async function resolveUserFromToken(token: string) {
  const record = await prisma.personalAccessToken.findUnique({ where: { tokenHash: hashToken(token) } });

  if (!record || record.revokedAt) {
    throw new UnauthorizedError("Token de acesso inválido");
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: record.usuarioId } });

  if (!usuario || !usuario.ativo) {
    throw new UnauthorizedError("Usuário do token inválido ou inativo");
  }

  await prisma.personalAccessToken.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() }
  });

  return usuario;
}

export function extractBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}
