"use client";

import { useState } from "react";
import type { RoomInfo } from "@/lib/availability";
import { formatDateHuman } from "@/lib/dates";
import { MAX_NAME_LENGTH, MAX_NOTE_LENGTH } from "@/lib/validation";
import { roomLabel } from "@/app/lib/roomText";
import { apiSend } from "@/app/lib/apiClient";
import { Field, inputClass } from "@/app/components/Field";

export function RequestForm({
  rooms,
  selectedDates,
  roomIds,
  onRoomChange,
  onSuccess,
  onError,
  onClearDates,
}: {
  readonly rooms: RoomInfo[];
  readonly selectedDates: string[];
  readonly roomIds: number[];
  readonly onRoomChange: (id: number) => void;
  readonly onSuccess: (cancelUrl: string) => void;
  readonly onError: (message: string) => void;
  readonly onClearDates: () => void;
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
      const res = await apiSend<{ ok: boolean; cancelUrl: string }>(
        "/api/requests",
        "POST",
        { name, email, roomIds, dates: selectedDates, note },
      );
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onSuccess(res.data.cancelUrl);
      setName("");
      setEmail("");
      setNote("");
      for (const id of roomIds) onRoomChange(id);
      onClearDates();
    } finally {
      setSubmitting(false);
    }
  }

  let submitLabel = "Send request";
  if (submitting) {
    submitLabel = "Sending…";
  } else if (roomIds.length > 1) {
    submitLabel = `Send request for ${roomIds.length} rooms`;
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
                  {roomLabel(room)} ✕
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
        <Field label="Your name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME_LENGTH}
            className={inputClass}
            placeholder="e.g. Josh"
          />
        </Field>
        <Field
          label={
            <>
              Email <span className="text-muted">(optional — for updates)</span>
            </>
          }
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder="you@example.com"
          />
        </Field>
      </div>
      <Field label="Note (optional)">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          rows={2}
          className={inputClass}
          placeholder="Anything the admin should know"
        />
      </Field>
      <button
        type="submit"
        disabled={submitting}
        className="w-fit rounded-md bg-invert px-4 py-2 font-medium text-invert-fg hover:opacity-85 disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}
