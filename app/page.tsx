import { Scheduler } from "@/app/components/Scheduler";
import { getAvailabilityRange, getRequestsCurrent, getRooms } from "@/lib/data";
import { availabilityWindow } from "@/lib/availability";
import { toPublicRequest } from "@/app/lib/requestTypes";

export const dynamic = "force-dynamic";

export default async function Home() {
  // The client refreshes and bounds its calendar with this same window.
  const dateWindow = availabilityWindow();
  const [rooms, availability, requests] = await Promise.all([
    getRooms(),
    getAvailabilityRange(dateWindow.start, dateWindow.end),
    getRequestsCurrent(dateWindow.start),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Scheduler
        initialRooms={rooms}
        initialAvailability={availability}
        initialRequests={requests.map((r) => toPublicRequest(r))}
        dateWindow={dateWindow}
      />
    </main>
  );
}
