"use client";

import type { AvailabilityMap, RoomInfo } from "@/lib/availability";
import { countBookableDates } from "@/lib/availability";
import { bedsLabel } from "@/app/lib/roomText";

export function BlueprintMap({
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
  const withHotspots = rooms.filter(
    (r) =>
      r.hotspotX != null &&
      r.hotspotY != null &&
      r.hotspotW != null &&
      r.hotspotH != null,
  );

  if (withHotspots.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-edge p-6 text-center text-sm text-muted">
        No blueprint with room hotspots yet. An admin can upload a floorplan
        and draw room areas in{" "}
        <a className="underline" href="/admin/rooms">
          the admin panel
        </a>
        .
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="min-h-5 text-xs text-muted">
        {selectedRoomIds.length > 1
          ? `${selectedRoomIds.length} rooms selected — the calendar shows these rooms combined.`
          : selectedRoomIds.length === 1
            ? "1 room selected — click more rooms to combine them for large parties."
            : "Click rooms on the floorplan to select — combine several for large parties."}
      </p>
      <div className="relative w-full overflow-hidden rounded-md border border-edge bg-subtle">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/api/blueprint"
          alt="House blueprint"
          className="block w-full select-none"
          draggable={false}
        />
        {withHotspots.map((room) => {
          const bookable = countBookableDates(availability, room.id, selectedDates);
          const full = selectedDates.length > 0 && bookable === 0;
          const partial = bookable > 0 && bookable < selectedDates.length;
          const bg = full
            ? "bg-neutral-400/50"
            : partial
              ? "bg-amber-400/50"
              : selectedDates.length > 0
                ? "bg-green-500/50"
                : "bg-neutral-800/40";
          const selected = selectedRoomIds.includes(room.id);
          return (
            <button
              key={room.id}
              type="button"
              title={`${room.name} — ${bedsLabel(room.beds)}`}
              onClick={() => onSelect(room.id)}
              style={{
                left: `${room.hotspotX}%`,
                top: `${room.hotspotY}%`,
                width: `${room.hotspotW}%`,
                height: `${room.hotspotH}%`,
              }}
              className={`absolute ${bg} flex items-center justify-center rounded border-2 p-1 text-xs font-semibold text-white transition-colors ${
                selected
                  ? "border-fg ring-2 ring-fg"
                  : "border-white/70 hover:border-fg"
              }`}
            >
              <span className="max-w-full truncate rounded bg-black/40 px-1">
                {room.name}
                {selectedDates.length > 0 ? ` (${bookable}/${selectedDates.length})` : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
