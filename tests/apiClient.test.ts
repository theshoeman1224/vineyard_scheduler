import { afterEach, describe, expect, it, vi } from "vitest";
import { apiGet, apiSend, apiSendForm } from "@/app/lib/apiClient";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

describe("apiGet", () => {
  it("returns parsed JSON on success", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ rooms: [] }), { status: 200 }),
    );
    const res = await apiGet<{ rooms: unknown[] }>("/api/admin/rooms");
    expect(res).toEqual({ ok: true, data: { rooms: [] } });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/rooms", { cache: "no-store" });
  });

  it("extracts the server error string on failure", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Room has requests" }), { status: 409 }),
    );
    const res = await apiGet("/api/x");
    expect(res).toEqual({ ok: false, error: "Room has requests" });
  });

  it("falls back to a status-based message for non-JSON bodies", async () => {
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 500 }));
    const res = await apiGet("/api/x");
    expect(res).toEqual({ ok: false, error: "Request failed (500)" });
  });

  it("maps network failures to a friendly message", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("failed to fetch"));
    const res = await apiGet("/api/x");
    expect(res).toEqual({ ok: false, error: "Network error — try again" });
  });
});

describe("apiSend", () => {
  it("POSTs a JSON body with the right content-type", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const res = await apiSend<{ ok: boolean }>("/api/requests", "POST", {
      name: "Josh",
    });
    expect(res).toEqual({ ok: true, data: { ok: true } });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(init.body).toBe(JSON.stringify({ name: "Josh" }));
  });

  it("DELETEs without a body or content-type when none is given", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    await apiSend("/api/admin/rooms/1", "DELETE");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("DELETE");
    expect(init.headers).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it("reports the server error on 4xx", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Wrong password" }), { status: 401 }),
    );
    const res = await apiSend("/api/admin/login", "POST", { password: "x" });
    expect(res).toEqual({ ok: false, error: "Wrong password" });
  });
});

describe("apiSendForm", () => {
  it("POSTs multipart data as-is", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const form = new FormData();
    form.set("file", "fake");
    const res = await apiSendForm<{ ok: boolean }>("/api/admin/blueprint", form);
    expect(res).toEqual({ ok: true, data: { ok: true } });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(form);
  });
});
