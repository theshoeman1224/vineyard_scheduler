import { Scheduler } from "@/app/components/Scheduler";
import { getAvailabilityRange, getRequestsCurrent, getRooms } from "@/lib/data";
import { addDaysStr, earliestBookableDate } from "@/lib/dates";
import { toPublicRequest } from "@/app/lib/requestTypes";

export const dynamic = "force-dynamic";

export default async function Home() {
  const start = earliestBookableDate();
  const end = addDaysStr(start, 400);
  const [rooms, availability, requests] = await Promise.all([
    getRooms(),
    getAvailabilityRange(start, end),
    getRequestsCurrent(start),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Scheduler
        initialRooms={rooms}
        initialAvailability={availability}
        initialRequests={requests.map((r) => toPublicRequest(r))}
      />
    </main>
  );
}
