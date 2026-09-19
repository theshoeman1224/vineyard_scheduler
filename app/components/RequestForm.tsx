"use client";

import { useState } from "react";
import type { RoomInfo } from "@/lib/availability";
import { formatDateHuman } from "@/lib/dates";

export function RequestForm({
  rooms,
  selectedDates,
  roomIds,
  onRoomChange,
  onSuccess,
  onError,
  onClearDates,
}: {
  rooms: RoomInfo[];
  selectedDates: string[];
  roomIds: number[];
  onRoomChange: (id: number) => void;
  onSuccess: (cancelUrl: string) => void;
  onError: (message: string) => void;
  onClearDates: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (rooms.length === 0) {
    return <p className="text-sm text-muted">No rooms available.</p>;
  }

  const selectedRooms = rooms.filter((r) => roomIds.includes(r.id));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (roomIds.length === 0) {
      onError("Pick at least one room first (from the list or blueprint).");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          roomIds,
          dates: selectedDates,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        onError(data.error ?? "Something went wrong");
        return;
      }
      onSuccess(data.cancelUrl);
      setName("");
      setEmail("");
      setNote("");
      for (const id of [...roomIds]) onRoomChange(id);
      onClearDates();
    } catch {
      onError("Network error — try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-sm">
      <div>
        <p className="mb-1 font-medium">3. Your details</p>
        {selectedRooms.length === 0 ? (
          <p className="text-muted">
            No room selected yet — click one or more rooms above (large
            parties can combine rooms).
          </p>
        ) : (
          <div className="text-muted">
            <div className="mb-1 flex flex-wrap gap-1.5">
              {selectedRooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => onRoomChange(room.id)}
                  className="rounded-full border border-edge bg-subtle px-2 py-0.5 text-xs font-medium hover:bg-edge"
                  title="Click to remove this room"
                >
                  {room.name} ({room.beds} bed{room.beds === 1 ? "" : "s"}) ✕
                </button>
              ))}
            </div>
            <span className="text-muted">
              {selectedDates.length} night{selectedDates.length === 1 ? "" : "s"}
              : {selectedDates.map((d) => formatDateHuman(d)).join(", ")}
            </span>
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-fg">Your name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="rounded-md border border-edge bg-card px-3 py-2"
            placeholder="e.g. Josh"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg">
            Email <span className="text-muted">(optional — for updates)</span>
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-edge bg-card px-3 py-2"
            placeholder="you@example.com"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-fg">Note (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          className="rounded-md border border-edge bg-card px-3 py-2"
          placeholder="Anything the admin should know"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="w-fit rounded-md bg-invert px-4 py-2 font-medium text-invert-fg hover:opacity-85 disabled:opacity-50"
      >
        {submitting
          ? "Sending…"
          : roomIds.length > 1
            ? `Send request for ${roomIds.length} rooms`
            : "Send request"}
      </button>
    </form>
  );
}
