"use client";

import { useRef, useState } from "react";
import type { RoomInfo } from "@/lib/availability";

type Rect = { x: number; y: number; w: number; h: number };

function normalize(r: Rect): Rect {
  const x1 = r.w < 0 ? r.x + r.w : r.x;
  const y1 = r.h < 0 ? r.y + r.h : r.y;
  return { x: Math.max(0, x1), y: Math.max(0, y1), w: Math.abs(r.w), h: Math.abs(r.h) };
}

function clampRect(r: Rect): Rect {
  const x = Math.min(100, Math.max(0, r.x));
  const y = Math.min(100, Math.max(0, r.y));
  const w = Math.min(100 - x, r.w);
  const h = Math.min(100 - y, r.h);
  return { x, y, w, h };
}

export function RoomsAdmin({ initialRooms }: { initialRooms: RoomInfo[] }) {
  const [rooms, setRooms] = useState(initialRooms);
  const [bpVersion, setBpVersion] = useState<number>(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newBeds, setNewBeds] = useState(1);
  const [newOrder, setNewOrder] = useState(rooms.length);

  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editBeds, setEditBeds] = useState(1);
  const [editOrder, setEditOrder] = useState(0);

  const [hotspotRoomId, setHotspotRoomId] = useState<number | null>(null);
  const [drawn, setDrawn] = useState<Rect | null>(null);
  const [drawing, setDrawing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  async function reloadRooms() {
    const res = await fetch("/api/admin/rooms", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setRooms(data.rooms ?? []);
    }
  }

  function pct(e: React.PointerEvent): { x: number; y: number } {
    const rect = containerRef.current!.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
    };
  }

  async function saveRoomPayload(body: object, successMsg: string) {
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        return false;
      }
      setMessage(successMsg);
      await reloadRooms();
      return true;
    } catch {
      setError("Network error");
      return false;
    }
  }

  async function addRoom(e: React.FormEvent) {
    e.preventDefault();
    const ok = await saveRoomPayload(
      { name: newName, beds: newBeds, displayOrder: newOrder },
      `Room “${newName}” added.`,
    );
    if (ok) {
      setNewName("");
      setNewBeds(1);
      setNewOrder(newOrder + 1);
    }
  }

  async function saveEdits(room: RoomInfo) {
    const ok = await saveRoomPayload(
      {
        id: room.id,
        name: editName,
        beds: editBeds,
        displayOrder: editOrder,
      },
      "Room updated.",
    );
    if (ok) setEditId(null);
  }

  async function removeRoom(room: RoomInfo) {
    if (!confirm(`Delete room “${room.name}”?`)) return;
    setError(null);
    const res = await fetch(`/api/admin/rooms?id=${room.id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Delete failed");
      return;
    }
    setMessage("Room deleted.");
    await reloadRooms();
  }

  async function saveHotspot() {
    const room = rooms.find((r) => r.id === hotspotRoomId);
    if (!room || !drawn) return;
    const r = clampRect(normalize(drawn));
    if (r.w < 1 || r.h < 1) {
      setError("Draw a larger area on the blueprint first.");
      return;
    }
    const ok = await saveRoomPayload(
      {
        id: room.id,
        name: room.name,
        beds: room.beds,
        displayOrder: room.displayOrder,
        hotspotX: r.x,
        hotspotY: r.y,
        hotspotW: r.w,
        hotspotH: r.h,
      },
      `Hotspot saved for “${room.name}”.`,
    );
    if (ok) {
      setDrawn(null);
      setHotspotRoomId(null);
    }
  }

  async function clearHotspot(room: RoomInfo) {
    const ok = await saveRoomPayload(
      {
        id: room.id,
        name: room.name,
        beds: room.beds,
        displayOrder: room.displayOrder,
        hotspotX: null,
        hotspotY: null,
        hotspotW: null,
        hotspotH: null,
      },
      `Hotspot cleared for “${room.name}”.`,
    );
    if (ok && hotspotRoomId === room.id) {
      setDrawn(null);
      setHotspotRoomId(null);
    }
  }

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const fileInput = formEl.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      setError("Choose an image file first.");
      return;
    }
    setError(null);
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/admin/blueprint", {
      method: "POST",
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Upload failed");
      return;
    }
    setMessage("Blueprint uploaded.");
    setBpVersion(Date.now());
    formEl.reset();
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-500/10 dark:text-green-300">
          {message}
        </p>
      ) : null}

      <section className="rounded-lg border border-edge bg-card p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Blueprint image</h2>
        <form onSubmit={upload} className="flex flex-wrap items-center gap-3 text-sm">
          <input
            type="file"
            name="file"
            accept="image/png,image/jpeg,image/webp"
            className="rounded-md border border-edge bg-card px-3 py-2"
          />
          <button
            type="submit"
            className="rounded-md bg-invert px-4 py-2 font-medium text-invert-fg hover:opacity-85"
          >
            Upload
          </button>
          <span className="text-xs text-muted">
            PNG/JPEG/WebP up to 3MB
          </span>
        </form>
      </section>

      <section className="rounded-lg border border-edge bg-card p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Rooms</h2>
        {rooms.length === 0 ? (
          <p className="mb-4 text-sm text-muted">No rooms yet.</p>
        ) : (
          <ul className="mb-4 flex flex-col divide-y divide-edge">
            {rooms.map((room) => (
              <li key={room.id} className="py-2 text-sm">
                {editId === room.id ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1">
                      <span>Name</span>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="rounded-md border border-edge bg-card px-2 py-1"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span>Beds</span>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={editBeds}
                        onChange={(e) => setEditBeds(Number(e.target.value))}
                        className="w-16 rounded-md border border-edge bg-card px-2 py-1"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span>Order</span>
                      <input
                        type="number"
                        min={0}
                        value={editOrder}
                        onChange={(e) => setEditOrder(Number(e.target.value))}
                        className="w-16 rounded-md border border-edge bg-card px-2 py-1"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => saveEdits(room)}
                      className="rounded bg-invert px-3 py-1.5 font-medium text-invert-fg hover:opacity-85"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditId(null)}
                      className="rounded border border-edge px-3 py-1.5 hover:bg-subtle"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{room.name}</span>
                      <span className="text-muted">
                        {" "}
                        — {room.beds} bed{room.beds === 1 ? "" : "s"}, order{" "}
                        {room.displayOrder}
                      </span>
                      {room.hotspotX != null ? (
                        <span className="text-xs text-green-700 dark:text-green-400">
                          {" "}
                          · hotspot drawn
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          {" "}
                          · no hotspot
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(room.id);
                          setEditName(room.name);
                          setEditBeds(room.beds);
                          setEditOrder(room.displayOrder);
                        }}
                        className="rounded border border-edge px-2 py-1 text-xs hover:bg-subtle"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHotspotRoomId(room.id);
                          setDrawn(null);
                        }}
                        className="rounded border border-edge px-2 py-1 text-xs hover:bg-subtle"
                      >
                        {room.hotspotX != null ? "Redraw hotspot" : "Draw hotspot"}
                      </button>
                      {room.hotspotX != null ? (
                        <button
                          type="button"
                          onClick={() => clearHotspot(room)}
                          className="rounded border border-edge px-2 py-1 text-xs hover:bg-subtle"
                        >
                          Clear hotspot
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeRoom(room)}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addRoom} className="flex flex-wrap items-end gap-2 border-t border-edge pt-3 text-sm">
          <label className="flex flex-col gap-1">
            <span>New room name</span>
            <input
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Loft"
              className="rounded-md border border-edge bg-card px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>Beds</span>
            <input
              type="number"
              min={0}
              max={20}
              value={newBeds}
              onChange={(e) => setNewBeds(Number(e.target.value))}
              className="w-16 rounded-md border border-edge bg-card px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>Display order</span>
            <input
              type="number"
              min={0}
              value={newOrder}
              onChange={(e) => setNewOrder(Number(e.target.value))}
              className="w-20 rounded-md border border-edge bg-card px-2 py-1"
            />
          </label>
          <button
            type="submit"
            className="rounded bg-invert px-3 py-1.5 font-medium text-invert-fg hover:opacity-85"
          >
            Add room
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-edge bg-card p-4 shadow-sm">
        <h2 className="mb-1 font-semibold">Hotspot editor</h2>
        {hotspotRoomId === null ? (
          <p className="text-sm text-muted">
            Pick a room above and click “Draw hotspot”, then drag a rectangle
            over that room on the blueprint below and save.
          </p>
        ) : (
          <p className="mb-3 text-sm">
            Drawing for <strong>{rooms.find((r) => r.id === hotspotRoomId)?.name}</strong>
            {drawn ? (
              <>
                {" "}
                — saved rect: x {Math.round(clampRect(normalize(drawn)).x)}%, y{" "}
                {Math.round(clampRect(normalize(drawn)).y)}%, w{" "}
                {Math.round(clampRect(normalize(drawn)).w)}%, h{" "}
                {Math.round(clampRect(normalize(drawn)).h)}%
              </>
            ) : (
              " — drag on the blueprint to draw the room area."
            )}
          </p>
        )}
        <div
          ref={containerRef}
          className="relative w-full overflow-hidden rounded-md border border-edge bg-subtle select-none"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            if (hotspotRoomId === null) return;
            const p = pct(e);
            setDrawing(true);
            setDrawn({ x: p.x, y: p.y, w: 0, h: 0 });
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drawing) return;
            const p = pct(e);
            setDrawn((r) => (r ? { ...r, w: p.x - r.x, h: p.y - r.y } : r));
          }}
          onPointerUp={() => setDrawing(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/blueprint?v=${bpVersion}`}
            alt="House blueprint"
            className="pointer-events-none block w-full"
            draggable={false}
          />
          {rooms
            .filter((r) => r.hotspotX != null && r.id !== hotspotRoomId)
            .map((room) => (
              <div
                key={`existing-${room.id}`}
                style={{
                  left: `${room.hotspotX}%`,
                  top: `${room.hotspotY}%`,
                  width: `${room.hotspotW}%`,
                  height: `${room.hotspotH}%`,
                }}
                className="pointer-events-none absolute rounded border border-neutral-600 bg-neutral-800/30 p-1 text-xs font-semibold text-neutral-800"
              >
                {room.name}
              </div>
            ))}
          {drawn && hotspotRoomId !== null ? (
            (() => {
              const r = normalize(drawn);
              return (
                <div
                  style={{
                    left: `${r.x}%`,
                    top: `${r.y}%`,
                    width: `${r.w}%`,
                    height: `${r.h}%`,
                  }}
                  className="absolute rounded border-2 border-blue-600 bg-blue-500/40"
                />
              );
            })()
          ) : null}
        </div>
        {hotspotRoomId !== null ? (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={saveHotspot}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Save hotspot
            </button>
            <button
              type="button"
              onClick={() => {
                setHotspotRoomId(null);
                setDrawn(null);
              }}
              className="rounded border border-edge bg-card px-4 py-2 text-sm hover:bg-subtle"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
