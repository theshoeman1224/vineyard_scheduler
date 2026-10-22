// The result page shown after an admin clicks "Yes, approve/deny" on a
// decision link. Pure (results in, title/body/color out) so the wording
// for full, partial, and failed decisions can be tested without a
// database or a request.

import type { DecideAction } from "@/lib/tokens";
import { COLOR_AMBER, COLOR_GREEN, COLOR_RED, esc } from "./tokenPage";

export type DecisionOutcome = {
  roomName: string;
  ok: boolean;
  error?: string;
};

export type DecisionPage = { title: string; body: string; headingColor: string };

function pageTitle(verb: string, succeeded: number, failed: number): string {
  if (failed === 0) return `Request ${verb}`;
  if (succeeded > 0) return `Partly ${verb}`;
  return "Could not apply decision";
}

function headingColor(action: DecideAction, failed: number): string {
  if (failed > 0) return COLOR_AMBER;
  return action === "approve" ? COLOR_GREEN : COLOR_RED;
}

// `notified`: whether this click changed anything (and so emailed the
// requester); re-clicked links change nothing and send nothing.
export function decisionPage(
  action: DecideAction,
  results: DecisionOutcome[],
  notified: boolean,
): DecisionPage {
  const verb = action === "approve" ? "approved" : "denied";
  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  let body = "";
  if (succeeded.length > 0) {
    const rooms = succeeded.map((r) => esc(r.roomName)).join("<br/>");
    const heading = `${succeeded.length} room${succeeded.length === 1 ? "" : "s"} ${verb}`;
    body += `<p style="color:${COLOR_GREEN}"><strong>${heading}:</strong></p>
      <p>${rooms}</p>`;
  }
  if (failed.length > 0) {
    const list = failed
      .map((f) => `<strong>${esc(f.roomName)}</strong> &mdash; ${esc(f.error ?? "")}`)
      .join("<br/>");
    body += `<p style="color:${COLOR_RED}"><strong>Could not be ${verb}:</strong></p>
      <p>${list}</p>
      <p>Those rooms were left as they were; manage them in the admin panel.</p>`;
  }
  body += notified
    ? `<p style="color:#666;font-size:13px;">The requester has been notified (if they left an email).</p>`
    : `<p style="color:#666;font-size:13px;">Nothing changed, so no email was sent.</p>`;

  return {
    title: pageTitle(verb, succeeded.length, failed.length),
    body,
    headingColor: headingColor(action, failed.length),
  };
}
