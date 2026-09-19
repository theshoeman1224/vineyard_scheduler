import { cancelByToken, getGroupByCancelToken } from "@/lib/data";
import { requestCancelledByUserEmail } from "@/lib/emails";
import { sendEmail } from "@/lib/mailer";
import { adminEmail } from "@/lib/env";
import { formatDateHuman } from "@/lib/dates";

function page(title: string, body: string, color: string): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark">
<title>${title}</title>
<style>:root{color-scheme:light dark}
body{font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;color:#111;background:#fff}
h1{font-size:22px}.card{border:1px solid #ddd;border-radius:8px;padding:20px;margin-top:16px}
.btn{display:inline-block;padding:10px 18px;border-radius:6px;color:#fff;text-decoration:none;border:none;cursor:pointer;font-size:15px;background:#dc2626}
.back{display:inline-block;margin-top:16px;color:#2563eb}
@media (prefers-color-scheme:dark){body{background:#131316;color:#e8e8ea}.card{border-color:#3a3a40}.back{color:#8ab4ff}}
</style>
</head><body><h1 style="color:${color}">${title}</h1><div class="card">${body}</div>
<a class="back" href="/">← Back to scheduler</a></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

function detailList(reqs: { roomName: string; status: string; dates: string[] }[]): string {
  return reqs
    .map(
      (r) =>
        `<strong>${r.roomName}</strong> (${r.status})<br/>${r.dates.map((d) => formatDateHuman(d)).join("<br/>")}`,
    )
    .join("<br/><br/>");
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const group = await getGroupByCancelToken(token);
  if (group.length === 0) {
    return page(
      "Link no longer valid",
      "This request was already withdrawn or removed.",
      "#dc2626",
    );
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark">
<title>Withdraw request</title>
<style>:root{color-scheme:light dark}
body{font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;color:#111;background:#fff}
h1{font-size:22px}.card{border:1px solid #ddd;border-radius:8px;padding:20px;margin-top:16px}
.btn{display:inline-block;padding:10px 18px;border-radius:6px;color:#fff;text-decoration:none;border:none;cursor:pointer;font-size:15px;background:#dc2626}
.back{display:inline-block;margin-top:16px;color:#2563eb}
@media (prefers-color-scheme:dark){body{background:#131316;color:#e8e8ea}.card{border-color:#3a3a40}.back{color:#8ab4ff}}
</style>
</head><body><h1>Withdraw request?</h1><div class="card">
<p><strong>#${group[0].id}</strong> — <strong>${group[0].name}</strong>. This removes <strong>all ${group.length === 1 ? "" : group.length + " "}</strong>room${group.length === 1 ? "" : "s"} of this submission:</p>
<p>${detailList(group)}</p>
<form method="POST" action="/api/cancel/${token}">
<button class="btn" type="submit">Yes, withdraw it</button>
</form>
</div><a class="back" href="/">← Back to scheduler</a></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const group = await getGroupByCancelToken(token);
  if (group.length === 0) {
    return page(
      "Link no longer valid",
      "This request was already withdrawn or removed.",
      "#dc2626",
    );
  }
  const ok = await cancelByToken(token);
  if (!ok) {
    return page("Already withdrawn", "This request no longer exists.", "#dc2626");
  }

  if (adminEmailIsConfigured()) {
    await sendEmail(
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

  return page(
    "Request withdrawn",
    `Your request for <strong>${group.map((r) => r.roomName).join(", ")}</strong> was removed. Submit a new one any time.`,
    "#dc2626",
  );
}

function adminEmailIsConfigured(): boolean {
  return !!process.env.ADMIN_EMAIL;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
