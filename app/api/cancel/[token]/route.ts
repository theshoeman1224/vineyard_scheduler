import { cancelByToken, getGroupByCancelToken } from "@/lib/data";
import { requestCancelledByUserEmail } from "@/lib/emails";
import { trySendEmail } from "@/lib/mailer";
import { adminEmail, adminEmailIsConfigured } from "@/lib/env";
import { COLOR_RED, esc, roomSummaryList, tokenPage } from "@/app/lib/tokenPage";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const group = await getGroupByCancelToken(token);
  if (group.length === 0) {
    return tokenPage(
      "Link no longer valid",
      "This request was already withdrawn or removed.",
      COLOR_RED,
    );
  }
  return tokenPage("Withdraw request?", `
<p><strong>#${group[0].id}</strong> &mdash; <strong>${esc(group[0].name)}</strong>. This removes <strong>all ${group.length === 1 ? "" : group.length + " "}</strong>room${group.length === 1 ? "" : "s"} of this submission:</p>
<p>${roomSummaryList(group)}</p>
<form method="POST" action="/api/cancel/${token}">
<button class="btn bad" type="submit">Yes, withdraw it</button>
</form>
`);
}

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const group = await getGroupByCancelToken(token);
  if (group.length === 0) {
    return tokenPage(
      "Link no longer valid",
      "This request was already withdrawn or removed.",
      COLOR_RED,
    );
  }
  const ok = await cancelByToken(token);
  if (!ok) {
    return tokenPage("Already withdrawn", "This request no longer exists.", COLOR_RED);
  }

  // Notify the admin, but only when an inbox exists to notify — and
  // never let a mailer failure fail the withdrawal itself.
  if (adminEmailIsConfigured()) {
    await trySendEmail(
      adminEmail(),
      requestCancelledByUserEmail({
        name: group[0].name,
        email: group[0].email,
        rooms: group.map((r) => r.roomName),
        dates: group[0].dates,
        note: group[0].note,
      }),
    );
  }

  return tokenPage(
    "Request withdrawn",
    `Your request for <strong>${group.map((r) => esc(r.roomName)).join(", ")}</strong> was removed. Submit a new one any time.`,
    COLOR_RED,
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
