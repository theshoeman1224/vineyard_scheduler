import { z } from "zod";
import { earliestBookableDate, isValidDateStr } from "./dates";
import { availabilityWindow } from "./availability";

// Public API validation schemas.

// Input limits shared by the zod schemas and the HTML inputs so the
// browser's maxlength and the server's limit cannot drift apart.
export const MAX_NAME_LENGTH = 80;
export const MAX_NOTE_LENGTH = 500;
export const MAX_ROOM_NAME_LENGTH = 60;
export const MAX_BEDS = 20;
// 254 is the longest address SMTP can deliver to (RFC 5321 path limit).
export const MAX_EMAIL_LENGTH = 254;

const dateStr = z
  .string()
  .refine((s) => isValidDateStr(s), "Invalid date, expected YYYY-MM-DD");

// Bookable nights: not in the past (timezone-tolerant, see
// earliestBookableDate) and not beyond the availability window the
// calendar offers, so the API accepts exactly what the UI can pick.
const futureDateStr = z
  .string()
  .refine((s) => isValidDateStr(s), "Invalid date, expected YYYY-MM-DD")
  .refine((s) => s >= earliestBookableDate(), "Date is in the past")
  .refine((s) => s <= availabilityWindow().end, "Date is too far ahead");

// Linear-time email shape check. Replaces the equivalent single regex
// /^[^@\s]+@[^@\s]+\.[^@\s]+$/, which backtracked super-linearly on
// adversarial input. Accepts: no whitespace, exactly one "@", a non-empty
// local part, and a domain with a dot that has at least one character on
// each side (extra dots elsewhere are fine).
function isEmailShape(s: string): boolean {
  if (/\s/.test(s)) return false;
  const at = s.indexOf("@");
  if (at <= 0 || s.includes("@", at + 1)) return false;
  const domain = s.slice(at + 1);
  const dot = domain.indexOf(".");
  return dot > 0 && dot < domain.length - 1;
}

// One email rule for the public form and the admin edit form: trimmed,
// length-capped, shape-checked; empty means "no email" (null).
const emailString = z
  .string()
  .trim()
  .max(MAX_EMAIL_LENGTH, "Email too long")
  .refine((s) => s === "" || isEmailShape(s), "Invalid email");

const optionalEmail = z
  .union([emailString, z.undefined(), z.null()])
  .transform((v) => v || null)
  .default(null);

const optionalNote = z
  .union([z.string().trim().max(MAX_NOTE_LENGTH, "Note too long"), z.undefined(), z.null()])
  .transform((v) => v || null)
  .default(null);

const nullableNote = z
  .union([z.string().max(MAX_NOTE_LENGTH), z.null()])
  .transform((v) => v || null)
  .default(null);

export const createRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(MAX_NAME_LENGTH, "Name too long"),
  email: optionalEmail,
  roomIds: z
    .array(z.number().int().positive())
    .min(1, "Pick at least one room")
    .max(20, "Too many rooms")
    .refine((r) => new Set(r).size === r.length, "Duplicate rooms"),
  dates: z
    .array(futureDateStr)
    .min(1, "Pick at least one date")
    .max(60, "Too many dates (max 60)")
    .refine((d) => new Set(d).size === d.length, "Duplicate dates"),
  note: optionalNote,
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const roomUpsertSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(MAX_ROOM_NAME_LENGTH),
  beds: z.number().int().min(0).max(MAX_BEDS),
  displayOrder: z.number().int().min(0).max(1000),
  hotspotX: z.number().min(0).max(100).nullable().optional(),
  hotspotY: z.number().min(0).max(100).nullable().optional(),
  hotspotW: z.number().min(0).max(100).nullable().optional(),
  hotspotH: z.number().min(0).max(100).nullable().optional(),
});

export const requestEditSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  email: optionalEmail,
  roomId: z.number().int().positive(),
  status: z.enum(["pending", "confirmed", "denied"]),
  dates: z
    .array(dateStr)
    .min(1, "At least one date")
    .max(60)
    .refine((d) => new Set(d).size === d.length, "Duplicate dates"),
  note: nullableNote,
});
