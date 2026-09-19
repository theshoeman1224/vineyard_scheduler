import { Resend } from "resend";
import type { EmailMessage } from "./emails";
import { emailFrom, resendApiKey } from "./env";

export async function sendEmail(
  to: string,
  msg: EmailMessage,
): Promise<{ ok: boolean; error?: string }> {
  const key = resendApiKey();
  if (!key) return { ok: false, error: "RESEND_API_KEY not set" };
  try {
    const resend = new Resend(key);
    const res = await resend.emails.send({
      from: emailFrom(),
      to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Variant that never throws, for flows where the database change has
// already succeeded and a mailer crash must not fail the whole request
// (an admin PATCH, a withdrawal confirmation). Callers surface the
// ok/error result however they like.
export async function trySendEmail(
  to: string,
  msg: EmailMessage,
): Promise<{ ok: boolean; error?: string }> {
  try {
    return await sendEmail(to, msg);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
