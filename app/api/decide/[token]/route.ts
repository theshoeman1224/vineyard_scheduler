import { decideGroup, getGroupRequests } from "@/lib/data";
import { verifyDecideToken } from "@/lib/tokens";
import { signingSecret } from "@/lib/env";
import { groupDecisionEmail } from "@/lib/emails";
import { sendEmail } from "@/lib/mailer";
import { formatDateHuman } from "@/lib/dates";

function page(title: string, body: string, color: string): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark">
<title>${title}</title>
<style>:root{color-scheme:light dark}
body{font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;color:#111;background:#fff}
h1{font-size:22px}.card{border:1px solid #ddd;border-radius:8px;padding:20px;margin-top:16px}
.btn{display:inline-block;padding:10px 18px;border-radius:6px;color:#fff;text-decoration:none;border:none;cursor:pointer;font-size:15px}
.ok{background:#16a34a}.bad{background:#dc2626}.back{display:inline-block;margin-top:16px;color:#2563eb}
@media (prefers-color-scheme:dark){body{background:#131316;color:#e8e8ea}.card{border-color:#3a3a40}.back{color:#8ab4ff}}
</style>
</head><body><h1 style="color:${color}">${title}</h1><div class="card">${body}</div>
<a class="back" href="/">← Back to scheduler</a></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

function roomList(reqs: { roomName: string; dates: string[]; status: string }[]): string {
  return reqs
    .map((r) => `<strong>${r.roomName}</strong> (${r.status})<br/>${r.dates.map((d) => formatDateHuman(d)).join("<br/>")}`)
    .join("<br/><br/>");
}

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const payload = verifyDecideToken(token, signingSecret());
  if (!payload) {
    return page(
      "Invalid link",
      "This decision link is not valid. Use the links in the latest admin email or manage the request in the admin panel.",
      "#dc2626",
    );
  }

  const group = await getGroupRequests(payload.g);
  if (group.length === 0) {
    return page("Not found", "This request no longer exists.", "#dc2626");
  }

  const results = await decideGroup(payload.g, payload.a);
  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  // Notify the requester with a per-room summary (they shared one email).
  const email = group.find((r) => r.email)?.email;
  if (email) {
    await sendEmail(
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
    body += `<p style="color:#16a34a"><strong>${succeeded.length} room${succeeded.length === 1 ? "" : "s"} ${verb}:</strong></p>
      <p>${succeeded.map((r) => `${r.roomName}`).join("<br/>")}</p>`;
  }
  if (failed.length > 0) {
    body += `<p style="color:#dc2626"><strong>Could not be ${verb}:</strong></p>
      <p>${failed.map((f) => `<strong>${f.roomName}</strong> — ${f.error}`).join("<br/>")}</p>
      <p>Those requests are unchanged and still pending; manage them in the admin panel.</p>`;
  }
  body += `<p style="color:#666;font-size:13px;">The requester has been notified (if they left an email).</p>`;

  const title =
    failed.length === 0
      ? `Request ${verb}`
      : succeeded.length > 0
        ? `Partly ${verb}`
        : "Could not apply decision";
  return page(title, body, failed.length === 0 ? (payload.a === "approve" ? "#16a34a" : "#dc2626") : "#b45309");
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const payload = verifyDecideToken(token, signingSecret());
  if (!payload) {
    return page("Invalid link", "This decision link is not valid.", "#dc2626");
  }
  const group = await getGroupRequests(payload.g);
  if (group.length === 0) {
    return page("Not found", "This request no longer exists.", "#dc2626");
  }
  const verb = payload.a === "approve" ? "approve" : "deny";
  const name = group[0].name;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark">
<title>Confirm decision</title>
<style>:root{color-scheme:light dark}
body{font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;color:#111;background:#fff}
h1{font-size:22px}.card{border:1px solid #ddd;border-radius:8px;padding:20px;margin-top:16px}
.btn{display:inline-block;padding:10px 18px;border-radius:6px;color:#fff;text-decoration:none;border:none;cursor:pointer;font-size:15px}
.ok{background:#16a34a}.bad{background:#dc2626}.back{display:inline-block;margin-top:16px;color:#2563eb}
@media (prefers-color-scheme:dark){body{background:#131316;color:#e8e8ea}.card{border-color:#3a3a40}.back{color:#8ab4ff}}
</style>
</head><body><h1>Confirm: ${verb} request</h1><div class="card">
<p><strong>${name}</strong> →</p>
<p>${roomList(group)}</p>
<form method="POST" action="/api/decide/${token}">
<button class="btn ${payload.a === "approve" ? "ok" : "bad"}" type="submit">Yes, ${verb} ${group.length === 1 ? "it" : "all"}</button>
</form>
<p style="color:#666;font-size:13px;">Rooms without free beds (if any) will stay pending.</p>
</div><a class="back" href="/">← Back to scheduler</a></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
