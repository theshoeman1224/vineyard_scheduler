"use client";

import { useCallback, useMemo, useState } from "react";
import type { AvailabilityMap, RoomInfo } from "@/lib/availability";
import { sortUniqueDates } from "@/lib/dates";
import { CalendarCard } from "./CalendarCard";
import { BlueprintMap } from "./BlueprintMap";
import { RoomList } from "./RoomList";
import { RequestForm } from "./RequestForm";
import { RequestsTable } from "./RequestsTable";

export type RequestPublic = {
  id: number;
  name: string;
  email?: string | null;
  roomId: number;
  roomName: string;
  status: "pending" | "confirmed" | "denied";
  note?: string | null;
  createdAt: string;
  dates: string[];
};
export function Scheduler({
  initialRooms,
  initialAvailability,
  initialRequests,
}: {
  initialRooms: RoomInfo[];
  initialAvailability: AvailabilityMap;
  initialRequests: RequestPublic[];
}) {
  const [rooms] = useState<RoomInfo[]>(initialRooms);
  const [availability, setAvailability] = useState(initialAvailability);
  const [requests, setRequests] = useState(initialRequests);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [roomIds, setRoomIds] = useState<number[]>([]);

  const toggleRoom = useCallback((id: number) => {
    setRoomIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);
  const [mode, setMode] = useState<"list" | "map">("list");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [availRes, reqRes] = await Promise.all([
        fetch("/api/availability", { cache: "no-store" }),
        fetch("/api/requests", { cache: "no-store" }),
      ]);
      if (availRes.ok) {
        const data = await availRes.json();
        setAvailability(data.availability ?? {});
      }
      if (reqRes.ok) {
        const data = await reqRes.json();
        setRequests(data.requests ?? []);
      }
    } catch {
      // keep stale data on failure
    }
  }, []);

  const onDatesChange = useCallback((dates: string[]) => {
    setSelectedDates(sortUniqueDates(dates));
    setSubmitError(null);
    setSuccess(null);
  }, []);

  const onSubmitSuccess = useCallback(
    async (cancelUrl: string) => {
      setSuccess(cancelUrl);
      setSubmitError(null);
      await refresh();
    },
    [refresh],
  );

  const requestFormNode = useMemo(() => {
    if (selectedDates.length === 0) {
      return (
        <p className="text-sm text-muted">
          Pick one or more dates on the calendar to start a request.
        </p>
      );
    }
    return (
      <RequestForm
        rooms={rooms}
        selectedDates={selectedDates}
        roomIds={roomIds}
        onRoomChange={toggleRoom}
        onSuccess={onSubmitSuccess}
        onError={setSubmitError}
        onClearDates={() => onDatesChange([])}
      />
    );
  }, [selectedDates, rooms, roomIds, toggleRoom, onSubmitSuccess, onDatesChange]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            House Scheduler
          </h1>
          <p className="text-sm text-muted">
            Pick dates, choose a room, and send a request — the admin approves
            by email.
          </p>
        </div>
        <a
          href="/admin"
          className="rounded-md border border-edge bg-card px-3 py-1.5 text-sm font-medium hover:bg-subtle"
        >
          Admin
        </a>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <CalendarCard
          availability={availability}
          rooms={rooms}
          selectedDates={selectedDates}
          roomIds={roomIds}
          onChange={onDatesChange}
        />
        <section className="rounded-lg border border-edge bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">2. Choose room(s)</h2>
            <div className="flex overflow-hidden rounded-md border border-edge text-xs">
              <button
                type="button"
                onClick={() => setMode("list")}
                className={`px-3 py-1 ${mode === "list" ? "bg-invert text-invert-fg" : "bg-card"}`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setMode("map")}
                className={`px-3 py-1 ${mode === "map" ? "bg-invert text-invert-fg" : "bg-card"}`}
              >
                Blueprint
              </button>
            </div>
          </div>
          {mode === "list" ? (
            <RoomList
              rooms={rooms}
              availability={availability}
              selectedDates={selectedDates}
              selectedRoomIds={roomIds}
              onSelect={toggleRoom}
            />
          ) : (
            <BlueprintMap
              rooms={rooms}
              availability={availability}
              selectedDates={selectedDates}
              selectedRoomIds={roomIds}
              onSelect={toggleRoom}
            />
          )}
          <div className="mt-4 border-t border-edge pt-4">
            {requestFormNode}
          </div>
          {submitError ? (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
              {submitError}
            </p>
          ) : null}
          {success ? (
            <div className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-500/10 dark:text-green-300">
              <p className="font-medium">Request sent to the admin.</p>
              <p>
                Bookmark this link to withdraw your request later:{" "}
                <a className="underline break-all" href={success}>
                  {success}
                </a>
              </p>
            </div>
          ) : null}
        </section>
      </div>

      <RequestsTable requests={requests} />
    </div>
  );
}
