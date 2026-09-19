import { decideGroup, getGroupRequests } from "@/lib/data";
import { verifyDecideToken } from "@/lib/tokens";
import { signingSecret } from "@/lib/env";
import { groupDecisionEmail } from "@/lib/emails";
import { trySendEmail } from "@/lib/mailer";
import {
  COLOR_AMBER,
  COLOR_GREEN,
  COLOR_RED,
  roomSummaryList,
  tokenPage,
} from "@/app/lib/tokenPage";

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
  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  // Notify the requester with a per-room summary (they shared one email).
  // The decision itself is already committed; a mailer failure must not
  // turn this page into an error.
  const email = group.find((r) => r.email)?.email;
  if (email) {
    await trySendEmail(
      email,
      groupDecisionEmail(
        {
          name: group[0].name,
          email,
          rooms: group.map((r) => r.roomName),
          dates: group[0].dates,
        },
        results.map((r) => ({
          roomName: r.roomName,
          ok: r.ok,
          error: r.error,
        })),
      ),
    );
  }

  const verb = payload.a === "approve" ? "approved" : "denied";
  let body = "";
  if (succeeded.length > 0) {
    body += `<p style="color:${COLOR_GREEN}"><strong>${succeeded.length} room${succeeded.length === 1 ? "" : "s"} ${verb}:</strong></p>
      <p>${succeeded.map((r) => `${r.roomName}`).join("<br/>")}</p>`;
  }
  if (failed.length > 0) {
    body += `<p style="color:${COLOR_RED}"><strong>Could not be ${verb}:</strong></p>
      <p>${failed.map((f) => `<strong>${f.roomName}</strong> &mdash; ${f.error}`).join("<br/>")}</p>
      <p>Those requests are unchanged and still pending; manage them in the admin panel.</p>`;
  }
  body += `<p style="color:#666;font-size:13px;">The requester has been notified (if they left an email).</p>`;

  let title: string;
  if (failed.length === 0) {
    title = `Request ${verb}`;
  } else if (succeeded.length > 0) {
    title = `Partly ${verb}`;
  } else {
    title = "Could not apply decision";
  }
  let headingColor: string;
  if (failed.length > 0) {
    headingColor = COLOR_AMBER;
  } else if (payload.a === "approve") {
    headingColor = COLOR_GREEN;
  } else {
    headingColor = COLOR_RED;
  }
  return tokenPage(title, body, headingColor);
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
  const name = group[0].name;
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
