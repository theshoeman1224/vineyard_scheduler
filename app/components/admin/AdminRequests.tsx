"use client";

import { useState } from "react";
import type { RoomInfo } from "@/lib/availability";
import {
  dateTextParts,
  datesToText,
  formatDateHuman,
  isValidDateStr,
  parseDatesText,
} from "@/lib/dates";
import { MAX_NAME_LENGTH, MAX_NOTE_LENGTH } from "@/lib/validation";
import type { AdminRequest } from "@/app/lib/requestTypes";
import { editPayload } from "@/app/lib/requestTypes";
import { roomLabel } from "@/app/lib/roomText";
import { apiGet, apiSend } from "@/app/lib/apiClient";
import { StatusPill } from "@/app/components/StatusPill";
import { Notice } from "@/app/components/Notice";
import { Field, inputClass } from "@/app/components/Field";

export function AdminRequests({
  initialRequests,
  rooms,
}: {
  readonly initialRequests: AdminRequest[];
  readonly rooms: RoomInfo[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  // Refetches the public requests list. Failures keep the stale table; a
  // banner would be noise for a background refresh.
  async function reload() {
    const res = await apiGet<{ requests?: AdminRequest[] }>("/api/requests");
    if (res.ok) {
      setRequests(res.data.requests ?? []);
    }
  }

  async function patch(id: number, body: object) {
    setBusy(id);
    setError(null);
    const res = await apiSend<unknown>(
      `/api/admin/requests/${id}`,
      "PATCH",
      body,
    );
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    await reload();
    return true;
  }

  async function remove(id: number) {
    if (!confirm(`Delete request #${id} permanently?`)) return;
    setBusy(id);
    const res = await apiSend<unknown>(`/api/admin/requests/${id}`, "DELETE");
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await reload();
  }

  async function quickDecide(r: AdminRequest, status: "confirmed" | "denied") {
    await patch(r.id, editPayload(r, status));
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <Notice kind="error">{error}</Notice> : null}
      {requests.length === 0 ? (
        <p className="rounded-md border border-dashed border-edge p-6 text-center text-sm text-muted">
          No requests yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-edge bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-edge text-xs uppercase text-muted">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Who</th>
                <th className="px-3 py-2">Room</th>
                <th className="px-3 py-2">Dates</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className="border-t border-edge align-top">
                  <td className="px-3 py-2 text-muted">{r.id}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.name}</div>
                    {r.email ? (
                      <div className="text-xs text-muted">{r.email}</div>
                    ) : null}
                    {r.note ? (
                      <div className="mt-1 text-xs italic text-muted">
                        “{r.note}”
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{r.roomName}</td>
                  <td className="px-3 py-2">
                    {r.dates.map((d) => (
                      <div key={d}>{formatDateHuman(d)}</div>
                    ))}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {r.status !== "confirmed" ? (
                        <button
                          type="button"
                          disabled={busy === r.id}
                          onClick={() => quickDecide(r, "confirmed")}
                          className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-500 disabled:opacity-50"
                        >
                          Approve
                        </button>
                      ) : null}
                      {r.status !== "denied" ? (
                        <button
                          type="button"
                          disabled={busy === r.id}
                          onClick={() => quickDecide(r, "denied")}
                          className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                        >
                          Deny
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() =>
                          setEditingId(editingId === r.id ? null : r.id)
                        }
                        className="rounded border border-edge px-2 py-1 text-xs hover:bg-subtle"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => remove(r.id)}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingId !== null
        ? (() => {
            const r = requests.find((x) => x.id === editingId);
            if (!r) return null;
            return (
              <EditForm
                key={r.id}
                request={r}
                rooms={rooms}
                onCancel={() => setEditingId(null)}
                onSaved={async () => {
                  setEditingId(null);
                  await reload();
                }}
                onError={setError}
              />
            );
          })()
        : null}
    </div>
  );
}

function EditForm({
  request,
  rooms,
  onSaved,
  onCancel,
  onError,
}: {
  readonly request: AdminRequest;
  readonly rooms: RoomInfo[];
  readonly onSaved: () => Promise<void>;
  readonly onCancel: () => void;
  readonly onError: (message: string | null) => void;
}) {
  const [name, setName] = useState(request.name);
  const [email, setEmail] = useState(request.email ?? "");
  const [roomId, setRoomId] = useState(request.roomId);
  const [status, setStatus] = useState(request.status);
  const [note, setNote] = useState(request.note ?? "");
  const [datesText, setDatesText] = useState(datesToText(request.dates));
  const [saving, setSaving] = useState(false);

  const dates = parseDatesText(datesText);
  const invalid = dateTextParts(datesText).filter((s) => !isValidDateStr(s));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    onError(null);
    const res = await apiSend<unknown>(
      `/api/admin/requests/${request.id}`,
      "PATCH",
      editPayload({ name, email, roomId, note, dates }, status),
    );
    setSaving(false);
    if (!res.ok) {
      onError(res.error);
      return;
    }
    await onSaved();
  }

  return (
    <form
      onSubmit={save}
      className="rounded-lg border border-edge bg-subtle p-4 text-sm"
    >
      <p className="mb-3 font-medium">Edit request #{request.id}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={MAX_NAME_LENGTH}
            className={inputClass}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Room">
          <select
            value={roomId}
            onChange={(e) => setRoomId(Number(e.target.value))}
            className={inputClass}
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {roomLabel(room)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as AdminRequest["status"])
            }
            className={inputClass}
          >
            <option value="pending">pending</option>
            <option value="confirmed">confirmed</option>
            <option value="denied">denied</option>
          </select>
        </Field>
        <Field label="Dates (YYYY-MM-DD, one per line or comma-separated)" span>
          <textarea
            rows={4}
            value={datesText}
            onChange={(e) => setDatesText(e.target.value)}
            className={`${inputClass} font-mono text-xs`}
          />
          {invalid.length > 0 ? (
            <span className="text-xs text-red-600 dark:text-red-400">
              Ignoring invalid dates: {invalid.join(", ")}
            </span>
          ) : null}
          <span className="text-xs text-muted">
            {dates.length} valid date{dates.length === 1 ? "" : "s"}
          </span>
        </Field>
        <Field label="Note" span>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={MAX_NOTE_LENGTH}
            className={inputClass}
          />
        </Field>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-invert px-4 py-2 font-medium text-invert-fg hover:opacity-85 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-edge bg-card px-4 py-2 hover:bg-subtle"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
