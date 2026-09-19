// Shared HTML shell for the two token-driven flows: admin approve/deny
// links and user withdraw links. These pages are served outside the React
// app, so they carry their own inline styling. Keeping one template here
// (instead of a copy per route) means every token page stays visually and
// behaviorally identical.

import { formatDateHuman } from "@/lib/dates";

const TOKEN_PAGE_CSS = `
:root{color-scheme:light dark}
body{font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:48px auto;padding:0 16px;color:#111;background:#fff}
h1{font-size:22px}.card{border:1px solid #ddd;border-radius:8px;padding:20px;margin-top:16px}
.btn{display:inline-block;padding:10px 18px;border-radius:6px;color:#fff;text-decoration:none;border:none;cursor:pointer;font-size:15px}
.ok{background:#16a34a}.bad{background:#dc2626}.back{display:inline-block;margin-top:16px;color:#2563eb}
@media (prefers-color-scheme:dark){body{background:#131316;color:#e8e8ea}.card{border-color:#3a3a40}.back{color:#8ab4ff}}
`;

// Shared accent colors for token-page headings and buttons.
export const COLOR_GREEN = "#16a34a";
export const COLOR_RED = "#dc2626";
export const COLOR_AMBER = "#b45309";

// Builds the full token page: colored heading, card body, back link.
// `headingColor` is optional; confirm pages (GET) use the default color.
export function tokenPage(
  title: string,
  body: string,
  headingColor?: string,
): Response {
  const heading = headingColor
    ? `<h1 style="color:${headingColor}">${title}</h1>`
    : `<h1>${title}</h1>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark">
<title>${title}</title>
<style>${TOKEN_PAGE_CSS}</style>
</head><body>${heading}<div class="card">${body}</div>
<a class="back" href="/">&larr; Back to scheduler</a></body></html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

// One "room (status) + dates" block per request row, shared by the
// confirm pages and result pages of both token flows.
export function roomSummaryList(
  reqs: { roomName: string; status: string; dates: string[] }[],
): string {
  return reqs
    .map(
      (r) =>
        `<strong>${r.roomName}</strong> (${r.status})<br/>${r.dates.map((d) => formatDateHuman(d)).join("<br/>")}`,
    )
    .join("<br/><br/>");
}
