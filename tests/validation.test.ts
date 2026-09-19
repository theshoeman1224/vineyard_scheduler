import { describe, expect, it } from "vitest";
import { createRequestSchema, requestEditSchema } from "@/lib/validation";
import { isValidDateStr, todayStr, addDaysStr } from "@/lib/dates";

const FUTURE = addDaysStr(todayStr(), 10);
const FUTURE2 = addDaysStr(todayStr(), 11);

describe("createRequestSchema", () => {
  it("accepts a valid request", () => {
    const parsed = createRequestSchema.safeParse({
      name: "Josh",
      email: "josh@example.com",
      roomIds: [1, 3],
      dates: [FUTURE, FUTURE2],
      note: "arriving late",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("josh@example.com");
      expect(parsed.data.note).toBe("arriving late");
    }
  });

  it("normalizes empty email/note to null", () => {
    const parsed = createRequestSchema.safeParse({
      name: "Josh",
      email: "",
      roomIds: [1],
      dates: [FUTURE],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBeNull();
      expect(parsed.data.note).toBeNull();
    }
  });

  it("trims the name", () => {
    const parsed = createRequestSchema.safeParse({
      name: "  Josh  ",
      roomIds: [1],
      dates: [FUTURE],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.name).toBe("Josh");
  });

  it("rejects missing name", () => {
    const parsed = createRequestSchema.safeParse({
      name: "   ",
      roomIds: [1],
      dates: [FUTURE],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects past dates", () => {
    const parsed = createRequestSchema.safeParse({
      name: "Josh",
      roomIds: [1],
      dates: ["2020-01-01"],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects malformed dates", () => {
    const parsed = createRequestSchema.safeParse({
      name: "Josh",
      roomIds: [1],
      dates: ["not-a-date"],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects duplicate dates", () => {
    const parsed = createRequestSchema.safeParse({
      name: "Josh",
      roomIds: [1],
      dates: [FUTURE, FUTURE],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects empty date list", () => {
    const parsed = createRequestSchema.safeParse({
      name: "Josh",
      roomIds: [1],
      dates: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects too many dates", () => {
    const dates = Array.from({ length: 61 }, (_, i) => addDaysStr(todayStr(), i));
    const parsed = createRequestSchema.safeParse({
      name: "Josh",
      roomIds: [1],
      dates,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-positive roomId", () => {
    const parsed = createRequestSchema.safeParse({
      name: "Josh",
      roomIds: [0],
      dates: [FUTURE],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("createRequestSchema roomIds", () => {
  const base = { name: "Josh", dates: [FUTURE] };

  it("accepts multiple rooms", () => {
    const parsed = createRequestSchema.safeParse({ ...base, roomIds: [1, 2, 3] });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.roomIds).toEqual([1, 2, 3]);
  });

  it("rejects an empty room list", () => {
    const parsed = createRequestSchema.safeParse({ ...base, roomIds: [] });
    expect(parsed.success).toBe(false);
  });

  it("rejects duplicate rooms", () => {
    const parsed = createRequestSchema.safeParse({ ...base, roomIds: [2, 2] });
    expect(parsed.success).toBe(false);
  });
});

describe("requestEditSchema", () => {
  it("accepts full admin edit", () => {
    const parsed = requestEditSchema.safeParse({
      name: "Josh",
      email: null,
      roomId: 2,
      status: "confirmed",
      dates: [FUTURE, FUTURE2],
      note: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("requires a valid status", () => {
    const parsed = requestEditSchema.safeParse({
      name: "Josh",
      email: null,
      roomId: 2,
      status: "approved",
      dates: [FUTURE],
      note: null,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("isValidDateStr used by parsers", () => {
  it("validates admin-pasted dates", () => {
    expect(isValidDateStr("2026-06-15")).toBe(true);
    expect(isValidDateStr("2026-06-31")).toBe(false);
  });
});
