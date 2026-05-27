import { logError, logInfo } from "@/lib/logger";

type EmailPayload = { to: string; subject: string; text: string };

export async function sendEmail(payload: EmailPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    logInfo("Email provider não configurado; envio ignorado", { to: payload.to, subject: payload.subject });
    return { ok: false, skipped: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [payload.to], subject: payload.subject, text: payload.text })
  });

  if (!response.ok) {
    const body = await response.text();
    logError("Falha ao enviar e-mail operacional", { status: response.status, body });
    return { ok: false, skipped: false };
  }

  return { ok: true, skipped: false };
}
