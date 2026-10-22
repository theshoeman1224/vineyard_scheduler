import {
  pgTable,
  pgEnum,
  serial,
  integer,
  real,
  text,
  date,
  timestamp,
  index,
  check,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const requestStatusEnum = pgEnum("request_status", [
  "pending",
  "confirmed",
  "denied",
]);

// The CHECK constraints repeat the zod limits in lib/validation.ts at the
// database, so a script or a bad migration cannot store a negative bed
// count or a hotspot outside the blueprint (hotspots are % of its size).
export const rooms = pgTable(
  "rooms",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull().unique(),
    beds: integer("beds").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    hotspotX: real("hotspot_x"),
    hotspotY: real("hotspot_y"),
    hotspotW: real("hotspot_w"),
    hotspotH: real("hotspot_h"),
  },
  (t) => [
    check("rooms_beds_nonnegative", sql`${t.beds} >= 0`),
    check(
      "rooms_hotspot_range",
      sql`${t.hotspotX} BETWEEN 0 AND 100 AND ${t.hotspotY} BETWEEN 0 AND 100
        AND ${t.hotspotW} BETWEEN 0 AND 100 AND ${t.hotspotH} BETWEEN 0 AND 100`,
    ),
  ],
);

export const requests = pgTable(
  "requests",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email"),
    roomId: integer("room_id")
      .notNull()
      .references(() => rooms.id),
    status: requestStatusEnum("status").notNull().default("pending"),
    note: text("note"),
    // Rows created by one submission (possibly several rooms) share this id.
    groupId: text("group_id")
      .notNull()
      .default(sql`(gen_random_uuid()::text)`),
    // Shared by the whole group; not unique — one token withdraws all rooms.
    cancelToken: text("cancel_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("requests_room_idx").on(t.roomId, t.status),
    index("requests_group_idx").on(t.groupId),
    index("requests_cancel_idx").on(t.cancelToken),
  ],
);

export const requestDates = pgTable(
  "request_dates",
  {
    requestId: integer("request_id")
      .notNull()
      .references(() => requests.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
  },
  (t) => [
    // One row per night per request. A primary key, not just a unique
    // index, so the table has a row identity like every other table.
    primaryKey({ name: "request_dates_pkey", columns: [t.requestId, t.date] }),
    index("request_dates_date_idx").on(t.date),
  ],
);

// A single-row table: the check keeps it that way.
export const blueprint = pgTable(
  "blueprint",
  {
    id: integer("id").primaryKey().default(1),
    mimeType: text("mime_type").notNull(),
    dataBase64: text("data_base64").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [check("blueprint_single_row", sql`id = 1`)],
);

export type Room = typeof rooms.$inferSelect;
export type Request = typeof requests.$inferSelect;
export type RequestDate = typeof requestDates.$inferSelect;
export type RequestStatus = Request["status"];
