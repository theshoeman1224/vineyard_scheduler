import { Scheduler } from "@/app/components/Scheduler";
import { getAvailabilityRange, getRequestsAll, getRooms } from "@/lib/data";
import { addDaysStr, todayStr } from "@/lib/dates";
import { toPublicRequest } from "@/app/lib/requestTypes";

export const dynamic = "force-dynamic";

export default async function Home() {
  const start = todayStr();
  const end = addDaysStr(start, 400);
  const [rooms, availability, requests] = await Promise.all([
    getRooms(),
    getAvailabilityRange(start, end),
    getRequestsAll(),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Scheduler
        initialRooms={rooms}
        initialAvailability={availability}
        initialRequests={requests.map(toPublicRequest)}
      />
    </main>
  );
}
