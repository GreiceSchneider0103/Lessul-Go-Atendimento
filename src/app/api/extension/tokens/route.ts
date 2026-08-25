import { NextRequest } from "next/server";
import { getCurrentApiUser } from "@/lib/auth/session";
import { withApiHandler } from "@/lib/http";
import { prisma } from "@/lib/db/prisma";
import { generateToken } from "@/lib/auth/personal-access-token";

/**
 * Mints a personal access token for the logged-in user, authenticated via the
 * normal session cookie. The raw token is returned once and only its hash is
 * stored — used by the order-import extension, which has no session cookie.
 */
export async function POST(request: NextRequest) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    const body = await request.json().catch(() => ({}));
    const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim().slice(0, 120) : null;

    const { token, hash } = generateToken();

    await prisma.personalAccessToken.create({
      data: { usuarioId: user.id, tokenHash: hash, label }
    });

    return { data: { token } };
  });
}
