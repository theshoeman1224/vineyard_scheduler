"use client";

import { useState } from "react";
import type { RoomInfo } from "@/lib/availability";
import { formatDateHuman, isValidDateStr } from "@/lib/dates";

type AdminRequest = {
  id: number;
  name: string;
  email: string | null;
  roomId: number;
  roomName: string;
  status: "pending" | "confirmed" | "denied";
  note: string | null;
  cancelToken: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  dates: string[];
};

function parseDates(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(isValidDateStr)
    .sort();
}

function datesToText(dates: string[]): string {
  return dates.join("\n");
}

function StatusPill({ status }: { status: AdminRequest["status"] }) {
  const styles =
    status === "confirmed"
      ? "bg-green-100 text-green-800"
      : status === "pending"
        ? "bg-amber-100 text-amber-800"
        : "bg-edge text-muted";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles}`}
    >
      {status}
    </span>
  );
}

export function AdminRequests({
  initialRequests,
  rooms,
}: {
  initialRequests: AdminRequest[];
  rooms: RoomInfo[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  async function reload() {
    const res = await fetch("/api/requests", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setRequests(data.requests ?? []);
    }
  }

  async function patch(id: number, body: object) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Update failed");
        return false;
      }
      await reload();
      return true;
    } catch {
      setError("Network error");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: number) {
    if (!confirm(`Delete request #${id} permanently?`)) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/requests/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Delete failed");
        return;
      }
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function quickDecide(r: AdminRequest, status: "confirmed" | "denied") {
    await patch(r.id, {
      name: r.name,
      email: r.email,
      roomId: r.roomId,
      status,
      dates: r.dates,
      note: r.note,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      ) : null}
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
  request: AdminRequest;
  rooms: RoomInfo[];
  onSaved: () => Promise<void>;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState(request.name);
  const [email, setEmail] = useState(request.email ?? "");
  const [roomId, setRoomId] = useState(request.roomId);
  const [status, setStatus] = useState(request.status);
  const [note, setNote] = useState(request.note ?? "");
  const [datesText, setDatesText] = useState(datesToText(request.dates));
  const [saving, setSaving] = useState(false);

  const dates = parseDates(datesText);
  const invalid = datesText
    .split(/[\s,]+/)
    .filter((s) => s.trim().length > 0 && !isValidDateStr(s.trim()));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    onError("");
    try {
      const res = await fetch(`/api/admin/requests/${request.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          roomId,
          status,
          note,
          dates,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        onError(data.error ?? "Save failed");
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="rounded-lg border border-edge bg-subtle p-4 text-sm"
    >
      <p className="mb-3 font-medium">Edit request #{request.id}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span>Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="rounded-md border border-edge bg-card px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-edge bg-card px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Room</span>
          <select
            value={roomId}
            onChange={(e) => setRoomId(Number(e.target.value))}
            className="rounded-md border border-edge bg-card px-3 py-2"
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} ({room.beds} beds)
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span>Status</span>
          <select
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as AdminRequest["status"])
            }
            className="rounded-md border border-edge bg-card px-3 py-2"
          >
            <option value="pending">pending</option>
            <option value="confirmed">confirmed</option>
            <option value="denied">denied</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span>Dates (YYYY-MM-DD, one per line or comma-separated)</span>
          <textarea
            rows={4}
            value={datesText}
            onChange={(e) => setDatesText(e.target.value)}
            className="rounded-md border border-edge bg-card px-3 py-2 font-mono text-xs"
          />
          {invalid.length > 0 ? (
            <span className="text-xs text-red-600 dark:text-red-400">
              Ignoring invalid dates: {invalid.join(", ")}
            </span>
          ) : null}
          <span className="text-xs text-muted">
            {dates.length} valid date{dates.length === 1 ? "" : "s"}
          </span>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span>Note</span>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            className="rounded-md border border-edge bg-card px-3 py-2"
          />
        </label>
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
