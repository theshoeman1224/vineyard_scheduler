import { z } from "zod";
import { isValidDateStr, todayStr } from "./dates";

// Public API validation schemas.

// Input limits shared by the zod schemas and the HTML inputs so the
// browser's maxlength and the server's limit cannot drift apart.
export const MAX_NAME_LENGTH = 80;
export const MAX_NOTE_LENGTH = 500;
export const MAX_ROOM_NAME_LENGTH = 60;
export const MAX_BEDS = 20;

const dateStr = z
  .string()
  .refine((s) => isValidDateStr(s), "Invalid date, expected YYYY-MM-DD");

const futureDateStr = z
  .string()
  .refine((s) => isValidDateStr(s) && s >= todayStr(), "Date is in the past");

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

const optionalEmail = z
  .union([
    z.string().trim().refine(isEmailShape, "Invalid email"),
    z.literal(""),
    z.undefined(),
    z.null(),
  ])
  .transform((v) => v || null)
  .default(null);

const optionalNote = z
  .union([z.string().trim().max(MAX_NOTE_LENGTH, "Note too long"), z.undefined(), z.null()])
  .transform((v) => v || null)
  .default(null);

const nullableEmail = z
  .union([z.string().trim().max(120), z.null()])
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
  email: nullableEmail,
  roomId: z.number().int().positive(),
  status: z.enum(["pending", "confirmed", "denied"]),
  dates: z
    .array(dateStr)
    .min(1, "At least one date")
    .max(60)
    .refine((d) => new Set(d).size === d.length, "Duplicate dates"),
  note: nullableNote,
});
