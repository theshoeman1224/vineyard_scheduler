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

// Maps a full request row to the client shape. The email (PII) and the
// note (written for the admin — the form says "Anything the admin should
// know") are private: they are stripped unless `includePrivate` is set,
// which only the admin page and the admin-session branch of the API do.
// Used by both the home page and the admin page so the field list lives in
// exactly one place.
export function toPublicRequest(
  r: RequestWithDetails,
  includePrivate = false,
): RequestPublic {
  return {
    id: r.id,
    name: r.name,
    email: includePrivate ? r.email : null,
    roomId: r.roomId,
    roomName: r.roomName,
    status: r.status,
    note: includePrivate ? r.note : null,
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
