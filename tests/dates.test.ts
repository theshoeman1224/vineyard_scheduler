import { describe, expect, it } from "vitest";
import {
  addDaysStr,
  dateRange,
  dateTextParts,
  datesToText,
  formatDateHuman,
  isValidDateStr,
  parseDate,
  parseDatesText,
  sortUniqueDates,
  todayStr,
  toDateString,
} from "@/lib/dates";

describe("isValidDateStr", () => {
  it("accepts valid dates", () => {
    expect(isValidDateStr("2026-01-31")).toBe(true);
    expect(isValidDateStr("2024-02-29")).toBe(true); // leap year
    expect(isValidDateStr("2026-12-01")).toBe(true);
  });

  it("rejects invalid dates", () => {
    expect(isValidDateStr("2026-02-30")).toBe(false);
    expect(isValidDateStr("2026-13-01")).toBe(false);
    expect(isValidDateStr("2026-00-10")).toBe(false);
    expect(isValidDateStr("2026-01-00")).toBe(false);
    expect(isValidDateStr("2026-1-1")).toBe(false);
    expect(isValidDateStr("banana")).toBe(false);
    expect(isValidDateStr("")).toBe(false);
    expect(isValidDateStr("2026/01/01")).toBe(false);
  });
});

describe("toDateString / parseDate roundtrip", () => {
  it("roundtrips", () => {
    const s = "2026-03-14";
    expect(toDateString(parseDate(s))).toBe(s);
  });

  it("pads single digits", () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("addDaysStr", () => {
  it("crosses month and year boundaries", () => {
    expect(addDaysStr("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysStr("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysStr("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysStr("2026-01-01", 0)).toBe("2026-01-01");
  });
});

describe("dateRange", () => {
  it("is inclusive of both ends", () => {
    expect(dateRange("2026-01-01", "2026-01-03")).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ]);
  });

  it("returns empty when end before start", () => {
    expect(dateRange("2026-01-05", "2026-01-04")).toEqual([]);
  });

  it("handles single day", () => {
    expect(dateRange("2026-05-01", "2026-05-01")).toEqual(["2026-05-01"]);
  });
});

describe("sortUniqueDates", () => {
  it("dedupes and sorts", () => {
    expect(
      sortUniqueDates(["2026-03-05", "2026-01-01", "2026-03-05"]),
    ).toEqual(["2026-01-01", "2026-03-05"]);
  });
});

describe("formatDateHuman", () => {
  it("formats nicely", () => {
    expect(formatDateHuman("2026-01-03")).toMatch(/Jan 3, 2026/);
  });

  it("passes through invalid strings", () => {
    expect(formatDateHuman("nope")).toBe("nope");
  });
});

describe("todayStr", () => {
  it("formats a known date", () => {
    expect(todayStr(new Date(2026, 8, 18))).toBe("2026-09-18");
  });
});

describe("dateTextParts", () => {
  it("splits on whitespace, commas, and newlines", () => {
    expect(dateTextParts("2026-01-01\n2026-01-02, 2026-01-03")).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ]);
  });

  it("drops empty segments", () => {
    expect(dateTextParts(" , 2026-01-01 ,\n")).toEqual(["2026-01-01"]);
    expect(dateTextParts("")).toEqual([]);
  });
});

describe("parseDatesText", () => {
  it("returns the valid dates sorted", () => {
    expect(
      parseDatesText("2026-01-05, banana, 2026-01-02\n2026-01-31"),
    ).toEqual(["2026-01-02", "2026-01-05", "2026-01-31"]);
  });

  it("keeps duplicates so the server can reject them explicitly", () => {
    expect(parseDatesText("2026-01-01\n2026-01-01")).toEqual([
      "2026-01-01",
      "2026-01-01",
    ]);
  });

  it("drops everything when nothing is valid", () => {
    expect(parseDatesText("garbage in")).toEqual([]);
  });
});

describe("datesToText", () => {
  it("joins one date per line (roundtrip with parseDatesText)", () => {
    const dates = ["2026-01-01", "2026-01-02"];
    expect(parseDatesText(datesToText(dates))).toEqual(dates);
  });
});
