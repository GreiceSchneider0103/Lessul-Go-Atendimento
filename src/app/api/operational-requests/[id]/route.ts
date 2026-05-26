import { NextRequest } from "next/server";
import { getCurrentApiUser } from "@/lib/auth/session";
import { withApiHandler } from "@/lib/http";
import { updateOperationalRequest } from "@/lib/services/operational-requests-service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withApiHandler(async () => {
    const user = await getCurrentApiUser();
    const { id } = await params;
    return { data: await updateOperationalRequest(id, user, await request.json()) };
  });
}
