import { describe, expect, it } from "vitest";
import {
  computeAvailability,
  countBookableDates,
  dayStatuses,
  roomCalendarStatus,
  roomDateStatus,
} from "@/lib/availability";

const rooms = [
  { id: 1, name: "Bunk Room", beds: 2, displayOrder: 0 },
  { id: 2, name: "Master", beds: 1, displayOrder: 1 },
];

describe("computeAvailability", () => {
  it("starts full with everything free", () => {
    const avail = computeAvailability(rooms, [], ["2026-01-01"]);
    expect(avail["2026-01-01"]).toEqual({
      1: { beds: 2, confirmed: 0, pending: 0, free: 2 },
      2: { beds: 1, confirmed: 0, pending: 0, free: 1 },
    });
  });

  it("counts confirmed bookings and reduces free beds", () => {
    const avail = computeAvailability(
      rooms,
      [
        { roomId: 1, status: "confirmed", dates: ["2026-01-01", "2026-01-02"] },
      ],
      ["2026-01-01", "2026-01-02", "2026-01-03"],
    );
    expect(avail["2026-01-01"][1]).toEqual({
      beds: 2,
      confirmed: 1,
      pending: 0,
      free: 1,
    });
    expect(avail["2026-01-03"][1]).toEqual({
      beds: 2,
      confirmed: 0,
      pending: 0,
      free: 2,
    });
  });

  it("never goes below zero free when overbooked", () => {
    const avail = computeAvailability(
      rooms,
      [
        { roomId: 2, status: "confirmed", dates: ["2026-01-01"] },
        { roomId: 2, status: "confirmed", dates: ["2026-01-01"] },
      ],
      ["2026-01-01"],
    );
    expect(avail["2026-01-01"][2]).toEqual({
      beds: 1,
      confirmed: 2,
      pending: 0,
      free: 0,
    });
  });

  it("tracks pending separately without consuming beds", () => {
    const avail = computeAvailability(
      rooms,
      [
        { roomId: 1, status: "pending", dates: ["2026-01-01"] },
        { roomId: 1, status: "confirmed", dates: ["2026-01-01"] },
      ],
      ["2026-01-01"],
    );
    expect(avail["2026-01-01"][1]).toEqual({
      beds: 2,
      confirmed: 1,
      pending: 1,
      free: 1,
    });
  });

  it("ignores bookings for unknown rooms/dates", () => {
    const avail = computeAvailability(
      rooms,
      [{ roomId: 99, status: "confirmed", dates: ["2026-01-01"] }],
      ["2026-01-01"],
    );
    expect(avail["2026-01-01"][99]).toBeUndefined();
    expect(avail["2026-01-01"][1].free).toBe(2);
  });
});

describe("countBookableDates", () => {
  it("counts dates with a free bed", () => {
    const avail = computeAvailability(
      rooms,
      [{ roomId: 2, status: "confirmed", dates: ["2026-01-01"] }],
      ["2026-01-01", "2026-01-02"],
    );
    expect(countBookableDates(avail, 2, ["2026-01-01", "2026-01-02"])).toBe(1);
    expect(countBookableDates(avail, 1, ["2026-01-01", "2026-01-02"])).toBe(2);
  });
});

describe("roomDateStatus", () => {
  it("is idle with no dates selected", () => {
    const avail = computeAvailability(
      rooms,
      [{ roomId: 1, status: "pending", dates: ["2026-01-01"] }],
      ["2026-01-01"],
    );
    expect(roomDateStatus(avail, 1, [])).toBe("idle");
  });

  it("is free when every selected date has a free bed", () => {
    const avail = computeAvailability(rooms, [], ["2026-01-01", "2026-01-02"]);
    expect(roomDateStatus(avail, 1, ["2026-01-01", "2026-01-02"])).toBe("free");
  });

  it("is limited when a confirmed booking leaves beds free", () => {
    const avail = computeAvailability(
      rooms,
      [{ roomId: 1, status: "confirmed", dates: ["2026-01-01"] }],
      ["2026-01-01"],
    );
    expect(roomDateStatus(avail, 1, ["2026-01-01"])).toBe("limited");
  });

  it("is limited-requested when a pending request also touches the room", () => {
    const avail = computeAvailability(
      rooms,
      [
        { roomId: 1, status: "confirmed", dates: ["2026-01-01"] },
        { roomId: 1, status: "pending", dates: ["2026-01-01"] },
      ],
      ["2026-01-01"],
    );
    expect(roomDateStatus(avail, 1, ["2026-01-01"])).toBe("limited-requested");
  });

  it("is requested when only a pending request touches the room", () => {
    const avail = computeAvailability(
      rooms,
      [{ roomId: 2, status: "pending", dates: ["2026-01-01"] }],
      ["2026-01-01"],
    );
    expect(roomDateStatus(avail, 2, ["2026-01-01"])).toBe("requested");
  });

  it("is full when no selected date has a free bed", () => {
    const avail = computeAvailability(
      rooms,
      [
        { roomId: 2, status: "confirmed", dates: ["2026-01-01"] },
        { roomId: 2, status: "confirmed", dates: ["2026-01-02"] },
      ],
      ["2026-01-01", "2026-01-02"],
    );
    expect(roomDateStatus(avail, 2, ["2026-01-01", "2026-01-02"])).toBe("full");
  });

  it("is partial when only some selected dates are bookable", () => {
    const avail = computeAvailability(
      rooms,
      [{ roomId: 1, status: "confirmed", dates: ["2026-01-01"] },
       { roomId: 1, status: "confirmed", dates: ["2026-01-01"] }],
      ["2026-01-01", "2026-01-02"],
    );
    expect(roomDateStatus(avail, 1, ["2026-01-01", "2026-01-02"])).toBe("partial");
  });

  it("a pending request in another room does not affect this room", () => {
    const avail = computeAvailability(
      rooms,
      [{ roomId: 2, status: "pending", dates: ["2026-01-01"] }],
      ["2026-01-01"],
    );
    expect(roomDateStatus(avail, 1, ["2026-01-01"])).toBe("free");
  });

  it("prefers full over requested in the same room", () => {
    // Bunk Room: 1 confirmed (2/2 = full) AND a pending request
    const avail = computeAvailability(
      rooms,
      [
        { roomId: 1, status: "confirmed", dates: ["2026-01-01"] },
        { roomId: 1, status: "confirmed", dates: ["2026-01-01"] },
        { roomId: 1, status: "pending", dates: ["2026-01-01"] },
      ],
      ["2026-01-01"],
    );
    expect(roomDateStatus(avail, 1, ["2026-01-01"])).toBe("full");
  });
});

describe("roomCalendarStatus", () => {
  it("is idle with no dates selected", () => {
    const avail = computeAvailability(
      rooms,
      [{ roomId: 1, status: "pending", dates: ["2026-01-01"] }],
      ["2026-01-01"],
    );
    expect(roomCalendarStatus(avail, 1, [])).toBe("idle");
  });

  it("is free when no selected date has a booking", () => {
    const avail = computeAvailability(rooms, [], ["2026-01-01", "2026-01-02"]);
    expect(roomCalendarStatus(avail, 1, ["2026-01-01", "2026-01-02"])).toBe(
      "free",
    );
  });

  it("is limited when a confirmed booking leaves beds free", () => {
    const avail = computeAvailability(
      rooms,
      [{ roomId: 1, status: "confirmed", dates: ["2026-01-01"] }],
      ["2026-01-01"],
    );
    expect(roomCalendarStatus(avail, 1, ["2026-01-01"])).toBe("limited");
  });

  it("is limited-requested when confirmed and pending share a date", () => {
    const avail = computeAvailability(
      rooms,
      [
        { roomId: 1, status: "confirmed", dates: ["2026-01-01"] },
        { roomId: 1, status: "pending", dates: ["2026-01-01"] },
      ],
      ["2026-01-01"],
    );
    expect(roomCalendarStatus(avail, 1, ["2026-01-01"])).toBe(
      "limited-requested",
    );
  });

  it("is requested when only a pending request touches the room", () => {
    const avail = computeAvailability(
      rooms,
      [{ roomId: 2, status: "pending", dates: ["2026-01-01"] }],
      ["2026-01-01"],
    );
    expect(roomCalendarStatus(avail, 2, ["2026-01-01"])).toBe("requested");
  });

  it("is full when a date has no free bed", () => {
    const avail = computeAvailability(
      rooms,
      [{ roomId: 2, status: "confirmed", dates: ["2026-01-01"] }],
      ["2026-01-01"],
    );
    expect(roomCalendarStatus(avail, 2, ["2026-01-01"])).toBe("full");
  });

  it("worst date wins: a fully booked date shows as full, not partial", () => {
    // Jan 1 is full in the Bunk Room; Jan 2 is untouched. The calendar
    // paints Jan 1 solid red, so the hotspot must read full too —
    // roomDateStatus's range-level "partial" is deliberately not used.
    const avail = computeAvailability(
      rooms,
      [
        { roomId: 1, status: "confirmed", dates: ["2026-01-01"] },
        { roomId: 1, status: "confirmed", dates: ["2026-01-01"] },
      ],
      ["2026-01-01", "2026-01-02"],
    );
    expect(roomDateStatus(avail, 1, ["2026-01-01", "2026-01-02"])).toBe(
      "partial",
    );
    expect(roomCalendarStatus(avail, 1, ["2026-01-01", "2026-01-02"])).toBe(
      "full",
    );
  });

  it("worst date wins: a pending request on another date cannot soften limited", () => {
    // Jan 1 is limited (confirmed, beds remain); Jan 2 is only pending.
    // The calendar shows ring on Jan 1 and amber on Jan 2 — the ring is
    // the worse state, so the hotspot stays limited.
    const avail = computeAvailability(
      rooms,
      [
        { roomId: 1, status: "confirmed", dates: ["2026-01-01"] },
        { roomId: 1, status: "pending", dates: ["2026-01-02"] },
      ],
      ["2026-01-01", "2026-01-02"],
    );
    expect(roomCalendarStatus(avail, 1, ["2026-01-01", "2026-01-02"])).toBe(
      "limited",
    );
  });

  it("limited-requested outranks plain limited across dates", () => {
    const avail = computeAvailability(
      rooms,
      [
        { roomId: 1, status: "confirmed", dates: ["2026-01-01"] },
        { roomId: 1, status: "pending", dates: ["2026-01-01"] },
        { roomId: 1, status: "confirmed", dates: ["2026-01-02"] },
      ],
      ["2026-01-01", "2026-01-02"],
    );
    expect(roomCalendarStatus(avail, 1, ["2026-01-01", "2026-01-02"])).toBe(
      "limited-requested",
    );
  });

  it("full outranks limited-requested across dates", () => {
    const avail = computeAvailability(
      rooms,
      [
        { roomId: 2, status: "confirmed", dates: ["2026-01-01"] },
        { roomId: 2, status: "confirmed", dates: ["2026-01-02"] },
        { roomId: 2, status: "confirmed", dates: ["2026-01-02"] },
        { roomId: 2, status: "pending", dates: ["2026-01-02"] },
      ],
      ["2026-01-01", "2026-01-02"],
    );
    expect(roomCalendarStatus(avail, 2, ["2026-01-01", "2026-01-02"])).toBe(
      "full",
    );
  });

  it("treats dates without slot data as unmarked, like the calendar", () => {
    const avail = computeAvailability(
      rooms,
      [{ roomId: 1, status: "confirmed", dates: ["2026-01-01"] }],
      ["2026-01-01"],
    );
    expect(roomCalendarStatus(avail, 1, ["2026-02-01"])).toBe("free");
  });
});

describe("dayStatuses", () => {
  it("does not leak other rooms' pending requests when a room is selected", () => {
    const avail = computeAvailability(
      rooms,
      [{ roomId: 1, status: "pending", dates: ["2026-01-01"] }], // Lounge pending
      ["2026-01-01", "2026-01-02"],
    );
    const scoped = dayStatuses(avail, rooms, [2]); // looking at Master
    expect(scoped.get("2026-01-01")).toBeUndefined();
    expect(scoped.has("2026-01-02")).toBe(false);
  });

  it("marks limited/full/requested for the selected room only", () => {
    const avail = computeAvailability(
      rooms,
      [
        { roomId: 1, status: "pending", dates: ["2026-01-01"] },
        { roomId: 2, status: "confirmed", dates: ["2026-01-01", "2026-01-02"] },
      ],
      ["2026-01-01", "2026-01-02", "2026-01-03"],
    );
    const scoped = dayStatuses(avail, rooms, [2]);
    expect(scoped.get("2026-01-01")).toBe("full"); // 1-bed room, confirmed
    expect(scoped.get("2026-01-02")).toBe("full");
    expect(scoped.has("2026-01-03")).toBe(false);
  });

  it("shows limited while beds remain for the selected room", () => {
    const avail = computeAvailability(
      rooms,
      [{ roomId: 1, status: "confirmed", dates: ["2026-01-01"] }],
      ["2026-01-01"],
    );
    const scoped = dayStatuses(avail, rooms, [1]);
    expect(scoped.get("2026-01-01")).toBe("limited"); // 1 of 2 beds taken
  });

  it("shows limited-requested when a pending request sits on a partly booked day", () => {
    const avail = computeAvailability(
      rooms,
      [
        { roomId: 1, status: "confirmed", dates: ["2026-01-01"] },
        { roomId: 1, status: "pending", dates: ["2026-01-01"] },
      ],
      ["2026-01-01"],
    );
    const scoped = dayStatuses(avail, rooms, [1]);
    expect(scoped.get("2026-01-01")).toBe("limited-requested");
  });

  it("marks requested-only days for the selected room", () => {
    const avail = computeAvailability(
      rooms,
      [{ roomId: 2, status: "pending", dates: ["2026-01-01"] }],
      ["2026-01-01"],
    );
    const scoped = dayStatuses(avail, rooms, [2]);
    expect(scoped.get("2026-01-01")).toBe("requested");
  });

  it("with no room selected, aggregates across all rooms", () => {
    const avail = computeAvailability(
      rooms,
      [
        { roomId: 1, status: "pending", dates: ["2026-01-01"] },
        { roomId: 1, status: "confirmed", dates: ["2026-01-02"] },
        { roomId: 1, status: "confirmed", dates: ["2026-01-03"] },
        { roomId: 1, status: "confirmed", dates: ["2026-01-03"] },
        { roomId: 2, status: "confirmed", dates: ["2026-01-03"] },
      ],
      ["2026-01-01", "2026-01-02", "2026-01-03"],
    );
    const overview = dayStatuses(avail, rooms, []);
    expect(overview.get("2026-01-01")).toBe("requested");
    expect(overview.get("2026-01-02")).toBe("limited");
    expect(overview.get("2026-01-03")).toBe("full"); // Lounge 2/2 + Master 1/1
  });

  it("prefers limited over full in the aggregate view when beds remain", () => {
    // Bunk Room (2 beds) fully booked, Master still free with a pending request
    const avail = computeAvailability(
      rooms,
      [
        { roomId: 1, status: "confirmed", dates: ["2026-02-01"] },
        { roomId: 1, status: "confirmed", dates: ["2026-02-01"] },
        { roomId: 2, status: "pending", dates: ["2026-02-01"] },
      ],
      ["2026-02-01"],
    );
    const overview = dayStatuses(avail, rooms, []);
    expect(overview.get("2026-02-01")).toBe("limited-requested"); // Bunk full (confirmed), Master pending, free beds remain
    const scopedLounge = dayStatuses(avail, rooms, [1]);
    expect(scopedLounge.get("2026-02-01")).toBe("full");
  });

  it("ignores dates without availability data", () => {
    const overview = dayStatuses({}, rooms, []);
    expect(overview.size).toBe(0);
  });

  it("combines several selected rooms: limited-requested wins over requested", () => {
    // Lounge confirmed 1/2 (limited), Master only pending (requested)
    const avail = computeAvailability(
      rooms,
      [
        { roomId: 1, status: "confirmed", dates: ["2026-03-01"] },
        { roomId: 2, status: "pending", dates: ["2026-03-01"] },
      ],
      ["2026-03-01"],
    );
    const combined = dayStatuses(avail, rooms, [1, 2]);
    expect(combined.get("2026-03-01")).toBe("limited-requested");
  });

  it("combines several selected rooms: full wins over everything", () => {
    // Both selected rooms completely full (Lounge 2/2, Master 1/1)
    const avail = computeAvailability(
      rooms,
      [
        { roomId: 1, status: "confirmed", dates: ["2026-03-01"] },
        { roomId: 1, status: "confirmed", dates: ["2026-03-01"] },
        { roomId: 2, status: "confirmed", dates: ["2026-03-01"] },
      ],
      ["2026-03-01"],
    );
    const combined = dayStatuses(avail, rooms, [1, 2]);
    expect(combined.get("2026-03-01")).toBe("full");
  });

  it("a pending request in an unselected room does not mark the day", () => {
    const avail = computeAvailability(
      rooms,
      [{ roomId: 2, status: "pending", dates: ["2026-03-02"] }],
      ["2026-03-02"],
    );
    const combined = dayStatuses(avail, rooms, [1]); // only Lounge selected
    expect(combined.has("2026-03-02")).toBe(false);
  });

  it("an empty selection falls back to all rooms", () => {
    const avail = computeAvailability(
      rooms,
      [{ roomId: 1, status: "pending", dates: ["2026-03-03"] }],
      ["2026-03-03"],
    );
    const overview = dayStatuses(avail, rooms, []);
    expect(overview.get("2026-03-03")).toBe("requested");
  });
});
