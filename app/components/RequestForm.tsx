"use client";

import { useState } from "react";
import type { RoomInfo } from "@/lib/availability";
import { formatDateHuman } from "@/lib/dates";
import { MAX_NAME_LENGTH, MAX_NOTE_LENGTH } from "@/lib/validation";
import { detailsHint, roomLabel } from "@/app/lib/roomText";
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
  // The form stays mounted at all times (mounting it on date selection
  // shifted the whole panel); it only accepts input once steps 1 and 2
  // are both done.
  const ready = selectedDates.length > 0 && roomIds.length > 0;
  const controlClass = `${inputClass} disabled:cursor-not-allowed disabled:opacity-50`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
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
        <h3 className="mb-3 text-lg font-semibold">3. Your details</h3>
        {/* min-h reserves room for the tallest stable content (one chip
            row + summary), so the fields below never shift as hints and
            chips swap while steps 1 and 2 are completed. */}
        <div className="min-h-12">
          {selectedRooms.length > 0 ? (
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
          ) : null}
          {ready ? (
            <span className="text-muted">
              {selectedDates.length} night{selectedDates.length === 1 ? "" : "s"}
              : {selectedDates.map((d) => formatDateHuman(d)).join(", ")}
            </span>
          ) : (
            <p className="text-muted">
              {detailsHint(selectedDates.length > 0, selectedRooms.length > 0)}
            </p>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Your name">
          <input
            required
            disabled={!ready}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME_LENGTH}
            className={controlClass}
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
            disabled={!ready}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={controlClass}
            placeholder="you@example.com"
          />
        </Field>
      </div>
      <Field label="Note (optional)">
        <textarea
          disabled={!ready}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          rows={2}
          className={controlClass}
          placeholder="Anything the admin should know"
        />
      </Field>
      <button
        type="submit"
        disabled={submitting || !ready}
        className="w-fit rounded-md bg-invert px-4 py-2 font-medium text-invert-fg hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}
