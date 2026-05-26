import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ServiceUnavailableError, UnauthorizedError } from "@/lib/errors";

export async function requireCurrentUser() {
  try {
    return await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/login");
    }

    if (error instanceof ServiceUnavailableError) {
      console.warn("[requireCurrentUser] redirect -> /login", {
        pathname: "server-component",
        reason: "service_unavailable_auth_or_session",
        message: error.message
      });
      redirect("/login");
    }

    throw error;
  }
}
