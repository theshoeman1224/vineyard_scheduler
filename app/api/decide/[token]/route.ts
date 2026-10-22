import { decideGroup, getGroupRequests, shouldNotifyRequester } from "@/lib/data";
import { verifyDecideToken } from "@/lib/tokens";
import { signingSecret } from "@/lib/env";
import { groupDecisionEmail } from "@/lib/emails";
import { trySendEmail } from "@/lib/mailer";
import { COLOR_RED, esc, roomSummaryList, tokenPage } from "@/app/lib/tokenPage";
import { decisionPage } from "@/app/lib/decisionPage";

const INVALID_LINK_PAGE = () =>
  tokenPage(
    "Invalid link",
    "This decision link is not valid. Use the links in the latest admin email or manage the request in the admin panel.",
    COLOR_RED,
  );

const NOT_FOUND_PAGE = () =>
  tokenPage("Not found", "This request no longer exists.", COLOR_RED);

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const payload = verifyDecideToken(token, signingSecret());
  if (!payload) return INVALID_LINK_PAGE();

  const group = await getGroupRequests(payload.g);
  if (group.length === 0) return NOT_FOUND_PAGE();

  const results = await decideGroup(payload.g, payload.a);
  const notified = shouldNotifyRequester(results);

  // Notify the requester with a per-room summary (they shared one email),
  // but only when this click changed something — re-clicking a link must
  // not re-send. The decision itself is already committed; a mailer
  // failure must not turn this page into an error.
  const email = group.find((r) => r.email)?.email;
  if (email && notified) {
    await trySendEmail(
      email,
      groupDecisionEmail(
        {
          name: group[0].name,
          email,
          rooms: group.map((r) => r.roomName),
          dates: group[0].dates,
        },
        payload.a,
        results.map((r) => ({
          roomName: r.roomName,
          status: r.status,
          error: r.error,
        })),
      ),
    );
  }

  const page = decisionPage(payload.a, results, notified);
  return tokenPage(page.title, page.body, page.headingColor);
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const payload = verifyDecideToken(token, signingSecret());
  if (!payload) {
    return tokenPage("Invalid link", "This decision link is not valid.", COLOR_RED);
  }
  const group = await getGroupRequests(payload.g);
  if (group.length === 0) return NOT_FOUND_PAGE();

  const verb = payload.a === "approve" ? "approve" : "deny";
  const name = esc(group[0].name);
  return tokenPage(`Confirm: ${verb} request`, `
<p><strong>${name}</strong> &rarr;</p>
<p>${roomSummaryList(group)}</p>
<form method="POST" action="/api/decide/${token}">
<button class="btn ${payload.a === "approve" ? "ok" : "bad"}" type="submit">Yes, ${verb} ${group.length === 1 ? "it" : "all"}</button>
</form>
<p style="color:#666;font-size:13px;">Rooms without free beds (if any) will stay pending.</p>
`);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
