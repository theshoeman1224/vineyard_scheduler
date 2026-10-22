import { formatDateHuman } from "./dates";

// Pure email builders: { subject, html, text }. Sending happens elsewhere.

export type EmailMessage = { subject: string; html: string; text: string };

type ReqInfo = {
  requestId?: number;
  name: string;
  email?: string | null;
  rooms: string[];
  dates: string[];
  note?: string | null;
};

function wrap(inner: string, footer = ""): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:16px;">
  <h2 style="margin:0 0 12px;">House Scheduler</h2>
  ${inner}
  ${footer}
</div>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function listDates(dates: string[]): string {
  return dates.map((d) => formatDateHuman(d)).join("<br>");
}

function listRooms(rooms: string[]): string {
  return rooms.map((r) => esc(r)).join("<br>");
}

export function adminNewRequestEmail(
  req: ReqInfo,
  approveUrl: string,
  denyUrl: string,
): EmailMessage {
  const roomWord = req.rooms.length === 1 ? "room" : "rooms";
  const subject = `New request: ${req.name} — ${req.rooms.length} ${roomWord} (${req.dates.length} night${req.dates.length === 1 ? "" : "s"})`;
  const html = wrap(`
    <p><strong>New room request</strong></p>
    <p>
      <strong>Who:</strong> ${esc(req.name)}${req.email ? ` &lt;${esc(req.email)}&gt;` : ""}<br/>
      <strong>Rooms:</strong><br/>${listRooms(req.rooms)}<br/>
      <strong>Dates:</strong><br/>${listDates(req.dates)}
      ${req.note ? `<br/><strong>Note:</strong> ${esc(req.note)}` : ""}
    </p>
    <p style="margin:24px 0;">
      <a href="${approveUrl}" style="background:#16a34a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;margin-right:12px;">Approve all</a>
      <a href="${denyUrl}" style="background:#dc2626;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Deny all</a>
    </p>
    <p style="color:#666;font-size:12px;">Individual rooms can also be approved/denied separately in the admin panel. Links never expire.</p>`);
  const text = `New room request
Who: ${req.name}${req.email ? ` <${req.email}>` : ""}
Rooms: ${req.rooms.join(", ")}
Dates: ${req.dates.join(", ")}
${req.note ? `Note: ${req.note}\n` : ""}
Approve all: ${approveUrl}
Deny all: ${denyUrl}`;
  return { subject, html, text };
}

export function decisionEmail(
  req: ReqInfo,
  status: "confirmed" | "denied",
): EmailMessage {
  const verb = status === "confirmed" ? "approved" : "denied";
  const subject = `Your request was ${verb}: ${req.rooms.join(", ")}`;
  const html = wrap(
    `<p>Hi ${esc(req.name)},</p>
     <p>Your request for <strong>${esc(req.rooms.join(", "))}</strong> was <strong style="color:${status === "confirmed" ? "#16a34a" : "#dc2626"}">${verb}</strong>.</p>
     <p><strong>Dates:</strong><br/>${listDates(req.dates)}</p>
     ${status === "denied" ? "<p>Reach out to the admin if you think this was a mistake.</p>" : ""}`,
  );
  const text = `Hi ${req.name},
Your request for ${req.rooms.join(", ")} was ${verb}.
Dates: ${req.dates.join(", ")}`;
  return { subject, html, text };
}

// Summary email after an "Approve all" / "Deny all" click. Rooms are
// listed by their status AFTER the decision, not by the action, so the
// requester is never told a room was approved when it was denied (or
// left as previously decided). Pending rooms carry their reason, e.g. a
// room that filled up.
export function groupDecisionEmail(
  req: ReqInfo,
  action: "approve" | "deny",
  results: {
    roomName: string;
    status: "pending" | "confirmed" | "denied";
    error?: string;
  }[],
): EmailMessage {
  const approved = results.filter((r) => r.status === "confirmed").map((r) => r.roomName);
  const denied = results.filter((r) => r.status === "denied").map((r) => r.roomName);
  const pending = results.filter((r) => r.status === "pending");
  const parts: string[] = [];
  if (approved.length > 0) {
    parts.push(
      `<p><strong style="color:#16a34a">Approved:</strong><br/>${listRooms(approved)}</p>`,
    );
  }
  if (denied.length > 0) {
    parts.push(
      `<p><strong style="color:#dc2626">Denied:</strong><br/>${listRooms(denied)}</p>`,
    );
  }
  for (const p of pending) {
    parts.push(
      `<p><strong style="color:#b45309">Still pending: ${esc(p.roomName)}</strong> — ${esc(p.error ?? "awaiting a decision")}</p>`,
    );
  }
  const plural = results.length === 1 ? "" : "s";
  const subject =
    action === "approve"
      ? `Your request: ${approved.length} of ${results.length} room${plural} approved`
      : `Your request: ${denied.length} of ${results.length} room${plural} denied`;
  const html = wrap(
    `<p>Hi ${esc(req.name)},</p>
     <p>The admin responded to your request for these dates:</p>
     <p><strong>Dates:</strong><br/>${listDates(req.dates)}</p>
     ${parts.join("")}
     ${denied.length > 0 ? "<p>Reach out to the admin if you think this was a mistake.</p>" : ""}`,
  );
  const lines = [
    approved.length > 0 ? `Approved: ${approved.join(", ")}` : "",
    denied.length > 0 ? `Denied: ${denied.join(", ")}` : "",
    ...pending.map((p) => `Still pending: ${p.roomName} — ${p.error ?? "awaiting a decision"}`),
  ].filter(Boolean);
  const text = `Hi ${req.name},
The admin responded to your request.
Dates: ${req.dates.join(", ")}
${lines.join("\n")}`;
  return { subject, html, text };
}

export function requestEditedEmail(
  req: ReqInfo,
  status: "pending" | "confirmed" | "denied",
): EmailMessage {
  const subject = `Your request was updated: ${req.rooms.join(", ")}`;
  const html = wrap(
    `<p>Hi ${esc(req.name)},</p>
     <p>The admin updated your request for <strong>${esc(req.rooms.join(", "))}</strong>. Current status: <strong>${esc(status)}</strong>.</p>
     <p><strong>Dates:</strong><br/>${listDates(req.dates)}</p>`,
  );
  const text = `Hi ${req.name},
The admin updated your request for ${req.rooms.join(", ")}. Status: ${status}.
Dates: ${req.dates.join(", ")}`;
  return { subject, html, text };
}

export function requestCancelledByUserEmail(
  req: ReqInfo,
): EmailMessage {
  const subject = `Request withdrawn: ${req.name} — ${req.rooms.join(", ")}`;
  const html = wrap(
    `<p><strong>${esc(req.name)}</strong> withdrew their request for:</p>
     <p><strong>Rooms:</strong><br/>${listRooms(req.rooms)}</p>
     <p><strong>Dates:</strong><br/>${listDates(req.dates)}</p>`,
  );
  const text = `${req.name} withdrew their request.
Rooms: ${req.rooms.join(", ")}
Dates: ${req.dates.join(", ")}`;
  return { subject, html, text };
}
