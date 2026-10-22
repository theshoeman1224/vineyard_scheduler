import { RoomsAdmin } from "@/app/components/admin/RoomsAdmin";
import { getBlueprintVersion, getRooms } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminRoomsPage() {
  const [rooms, blueprintVersion] = await Promise.all([getRooms(), getBlueprintVersion()]);
  return (
    <main>
      <h1 className="mb-1 text-2xl font-semibold">Rooms &amp; blueprint</h1>
      <p className="mb-6 text-sm text-muted">
        Upload the house floorplan, add rooms with bed counts, and draw a
        clickable area on the blueprint for each room.
      </p>
      <RoomsAdmin initialRooms={rooms} initialBlueprintVersion={blueprintVersion} />
    </main>
  );
}
