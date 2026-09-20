"use client";

import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import {
  dayStatuses,
  type AvailabilityMap,
  type RoomInfo,
} from "@/lib/availability";
import { parseDate, toDateString } from "@/lib/dates";

export function CalendarCard({
  availability,
  rooms,
  selectedDates,
  roomIds,
  onChange,
}: {
  readonly availability: AvailabilityMap;
  readonly rooms: RoomInfo[];
  readonly selectedDates: string[];
  readonly roomIds: number[];
  readonly onChange: (dates: string[]) => void;
}) {
  const today = new Date();
  const [month, setMonth] = useState<Date>(today);

  const statusByDate = useMemo(
    () => dayStatuses(availability, rooms, roomIds),
    [availability, rooms, roomIds],
  );

  const modifiers = useMemo(() => {
    const limitedDays: Date[] = [];
    const limitedRequestedDays: Date[] = [];
    const requestedDays: Date[] = [];
    const fullDays: Date[] = [];
    for (const [date, status] of statusByDate) {
      const d = parseDate(date);
      if (status === "limited") limitedDays.push(d);
      else if (status === "limited-requested") limitedRequestedDays.push(d);
      else if (status === "full") fullDays.push(d);
      else requestedDays.push(d);
    }
    return { limitedDays, limitedRequestedDays, requestedDays, fullDays };
  }, [statusByDate]);

  const selected = useMemo(
    () => selectedDates.map((d) => parseDate(d)),
    [selectedDates],
  );

  const selectedRooms = rooms.filter((r) => roomIds.includes(r.id));

  return (
    <section className="rounded-lg border border-edge bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">1. Pick dates</h2>
        <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span className="dot-limited inline-block h-2.5 w-2.5 rounded-full" />
            <span>partly booked</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="dot-limited-amber inline-block h-2.5 w-2.5 rounded-full" />
            <span>partly + requested</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span>requested</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" />
            <span>full</span>
          </span>
        </div>
      </div>
      <DayPicker
        mode="multiple"
        month={month}
        onMonthChange={setMonth}
        selected={selected}
        onSelect={(dates: Date[] | undefined) => {
          onChange((dates ?? []).map((d) => toDateString(d)));
        }}
        disabled={{ before: today }}
        modifiers={{
          limited: [...modifiers.limitedDays, ...modifiers.limitedRequestedDays],
          full: modifiers.fullDays,
          requested: [
            ...modifiers.requestedDays,
            ...modifiers.limitedRequestedDays,
          ],
        }}
        modifiersClassNames={{
          limited: "rdp-day_limited",
          full: "rdp-day_full",
          requested: "rdp-day_requested",
        }}
        showOutsideDays
        weekStartsOn={0}
      />
      {selectedRooms.length > 0 ? (
        <p className="mt-2 text-xs text-muted">
          Showing status for{" "}
          <strong>
            {selectedRooms.length === 1
              ? selectedRooms[0].name
              : `${selectedRooms.length} selected rooms`}
          </strong>{" "}
          — partly booked days take priority over requested. Clear the room selection
          to see all rooms.
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted">
          Showing activity across all rooms — select one or more rooms to
          filter these markers.
        </p>
      )}
      {selectedDates.length > 0 ? (
        <p className="mt-2 text-sm text-muted">
          {selectedDates.length} date{selectedDates.length === 1 ? "" : "s"}{" "}
          selected —{" "}
          <button
            type="button"
            className="underline hover:text-fg"
            onClick={() => onChange([])}
          >
            clear
          </button>
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Click individual dates to build a request (dates = nights).
        </p>
      )}
    </section>
  );
}
