"use client";

import type { AvailabilityMap, RoomInfo } from "@/lib/availability";
import { countBookableDates } from "@/lib/availability";
import {
  availabilityDotClass,
  bedsLabel,
  roomsSelectedHint,
} from "@/app/lib/roomText";

export function RoomList({
  rooms,
  availability,
  selectedDates,
  selectedRoomIds,
  onSelect,
}: {
  readonly rooms: RoomInfo[];
  readonly availability: AvailabilityMap;
  readonly selectedDates: string[];
  readonly selectedRoomIds: number[];
  readonly onSelect: (id: number) => void;
}) {
  if (rooms.length === 0) {
    return (
      <p className="text-sm text-muted">
        No rooms configured yet — an admin can add rooms in the admin panel.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="min-h-5 text-xs text-muted">
        {roomsSelectedHint(selectedRoomIds.length, "list")}
      </p>
      <ul className="flex flex-col gap-2">
        {rooms.map((room) => {
          const bookable = countBookableDates(
            availability,
            room.id,
            selectedDates,
          );
          const fullyAvailable =
            selectedDates.length > 0 && bookable === selectedDates.length;
          const partial = bookable > 0 && bookable < selectedDates.length;
          const isSelected = selectedRoomIds.includes(room.id);
          return (
            <li key={room.id}>
              <button
                type="button"
                onClick={() => onSelect(room.id)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  isSelected
                    ? "border-fg bg-invert text-invert-fg"
                    : "border-edge bg-card hover:bg-subtle"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${availabilityDotClass(fullyAvailable, partial)}`}
                  />
                  <span className="font-medium">{room.name}</span>
                  {isSelected ? (
                    <span className="rounded-full bg-invert-fg/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      selected
                    </span>
                  ) : null}
                </span>
                <span
                  className={
                    isSelected ? "text-invert-fg/70" : "text-muted"
                  }
                >
                  {bedsLabel(room.beds)}
                  {selectedDates.length > 0
                    ? ` · ${bookable}/${selectedDates.length} dates free`
                    : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
