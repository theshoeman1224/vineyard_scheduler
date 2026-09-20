import type { RequestWithDetails } from "@/lib/data";

// Shape of a request row as exposed to the client by GET /api/requests:
// no cancelToken or groupId (those stay server-side), createdAt as an
// ISO string (JSON has no Date type). The admin table works on the same
// rows as the public site; the admin API adds nothing the table needs.
// One type, so the two tables can never drift.
export type RequestPublic = {
  id: number;
  name: string;
  email: string | null;
  roomId: number;
  roomName: string;
  status: "pending" | "confirmed" | "denied";
  note: string | null;
  createdAt: string;
  dates: string[];
};

// Maps a full request row to the client shape. Emails are PII, so they are
// stripped unless explicitly requested — only the admin page and the admin
// API call this with `includeEmail` (guarded by the admin session).
// Used by both the home page and the admin page so the field list lives in
// exactly one place.
export function toPublicRequest(
  r: RequestWithDetails,
  includeEmail = false,
): RequestPublic {
  return {
    id: r.id,
    name: r.name,
    email: includeEmail ? r.email : null,
    roomId: r.roomId,
    roomName: r.roomName,
    status: r.status,
    note: r.note,
    dates: r.dates,
    createdAt: r.createdAt.toISOString(),
  };
}

// The six-field PATCH body the admin request endpoint expects. Both the
// quick approve/deny buttons and the edit form send this shape.
export function editPayload(
  fields: {
    name: string;
    email: string | null;
    roomId: number;
    note: string | null;
    dates: string[];
  },
  status: RequestPublic["status"],
) {
  return {
    name: fields.name,
    email: fields.email,
    roomId: fields.roomId,
    status,
    note: fields.note,
    dates: fields.dates,
  };
}
