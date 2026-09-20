import { describe, expect, it } from "vitest";
import type { RequestWithDetails } from "@/lib/data";
import { editPayload, toPublicRequest } from "@/app/lib/requestTypes";

const row: RequestWithDetails = {
  id: 7,
  name: "Josh",
  email: "josh@example.com",
  roomId: 3,
  roomName: "Loft",
  status: "pending",
  note: "arriving late",
  groupId: "group-1",
  cancelToken: "tok",
  createdAt: new Date("2026-01-01T12:00:00Z"),
  updatedAt: new Date("2026-01-02T12:00:00Z"),
  dates: ["2026-02-01", "2026-02-02"],
};

describe("toPublicRequest", () => {
  it("strips the requester email unless explicitly included", () => {
    expect(toPublicRequest(row).email).toBeNull();
    expect(toPublicRequest(row, true).email).toBe("josh@example.com");
  });

  it("maps the row to the public shape with an ISO createdAt", () => {
    expect(toPublicRequest(row, true)).toEqual({
      id: 7,
      name: "Josh",
      email: "josh@example.com",
      roomId: 3,
      roomName: "Loft",
      status: "pending",
      note: "arriving late",
      dates: ["2026-02-01", "2026-02-02"],
      createdAt: "2026-01-01T12:00:00.000Z",
    });
  });

  it("never leaks the cancel token or group id to the client", () => {
    const pub = toPublicRequest(row) as Record<string, unknown>;
    expect("cancelToken" in pub).toBe(false);
    expect("groupId" in pub).toBe(false);
    expect("updatedAt" in pub).toBe(false);
  });
});

describe("editPayload", () => {
  it("builds the six-field PATCH body with the given status", () => {
    expect(
      editPayload(
        {
          name: "Josh",
          email: null,
          roomId: 3,
          note: null,
          dates: ["2026-02-01"],
        },
        "confirmed",
      ),
    ).toEqual({
      name: "Josh",
      email: null,
      roomId: 3,
      status: "confirmed",
      note: null,
      dates: ["2026-02-01"],
    });
  });
});
