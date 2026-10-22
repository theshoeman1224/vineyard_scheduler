import { describe, expect, it } from "vitest";
import { roomWriteValues } from "@/lib/data/roomValues";

const base = { name: "Loft", beds: 2, displayOrder: 1 };

describe("roomWriteValues", () => {
  it("leaves hotspot columns out when the fields are omitted", () => {
    // The room edit form sends only name/beds/order; it must not wipe the hotspot.
    const values = roomWriteValues({ id: 3, ...base });
    expect(values).toEqual(base);
    expect("hotspotX" in values).toBe(false);
  });

  it("writes hotspot numbers when provided", () => {
    const values = roomWriteValues({
      ...base,
      hotspotX: 10,
      hotspotY: 20,
      hotspotW: 30,
      hotspotH: 40,
    });
    expect(values).toEqual({
      ...base,
      hotspotX: 10,
      hotspotY: 20,
      hotspotW: 30,
      hotspotH: 40,
    });
  });

  it("clears the hotspot only on explicit null", () => {
    const values = roomWriteValues({
      ...base,
      hotspotX: null,
      hotspotY: null,
      hotspotW: null,
      hotspotH: null,
    });
    expect(values.hotspotX).toBeNull();
    expect(values.hotspotH).toBeNull();
  });

  it("keeps 0 as a real coordinate", () => {
    expect(roomWriteValues({ ...base, hotspotX: 0 }).hotspotX).toBe(0);
  });
});
