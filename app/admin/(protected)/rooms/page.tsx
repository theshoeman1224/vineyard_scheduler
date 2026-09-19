import { RoomsAdmin } from "@/app/components/admin/RoomsAdmin";
import { getRooms } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminRoomsPage() {
  const rooms = await getRooms();
  return (
    <main>
      <h1 className="mb-1 text-2xl font-semibold">Rooms &amp; blueprint</h1>
      <p className="mb-6 text-sm text-muted">
        Upload the house floorplan, add rooms with bed counts, and draw a
        clickable area on the blueprint for each room.
      </p>
      <RoomsAdmin initialRooms={rooms} />
    </main>
  );
}
