import { z } from "zod";
import { isValidDateStr, todayStr } from "./dates";

// Public API validation schemas.

const dateStr = z
  .string()
  .refine((s) => isValidDateStr(s), "Invalid date, expected YYYY-MM-DD");

const futureDateStr = z
  .string()
  .refine((s) => isValidDateStr(s) && s >= todayStr(), "Date is in the past");

const optionalEmail = z
  .union([
    z.string().trim().regex(/^[^@\s]+@[^@\s]+\.[^@\s]+$/, "Invalid email"),
    z.literal(""),
    z.undefined(),
    z.null(),
  ])
  .transform((v) => (v ? v : null))
  .default(null);

const optionalNote = z
  .union([z.string().trim().max(500, "Note too long"), z.undefined(), z.null()])
  .transform((v) => (v ? v : null))
  .default(null);

const nullableEmail = z
  .union([z.string().trim().max(120), z.null()])
  .transform((v) => (v ? v : null))
  .default(null);

const nullableNote = z
  .union([z.string().max(500), z.null()])
  .transform((v) => (v ? v : null))
  .default(null);

export const createRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name too long"),
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
  name: z.string().trim().min(1).max(60),
  beds: z.number().int().min(0).max(20),
  displayOrder: z.number().int().min(0).max(1000),
  hotspotX: z.number().min(0).max(100).nullable().optional(),
  hotspotY: z.number().min(0).max(100).nullable().optional(),
  hotspotW: z.number().min(0).max(100).nullable().optional(),
  hotspotH: z.number().min(0).max(100).nullable().optional(),
});

export const requestEditSchema = z.object({
  name: z.string().trim().min(1).max(80),
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
