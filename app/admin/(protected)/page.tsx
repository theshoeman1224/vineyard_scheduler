import { AdminRequests } from "@/app/components/admin/AdminRequests";
import { getRequestsAll, getRooms } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [requests, rooms] = await Promise.all([getRequestsAll(), getRooms()]);
  return (
    <main>
      <h1 className="mb-1 text-2xl font-semibold">Requests</h1>
      <p className="mb-6 text-sm text-muted">
        Approve, deny, edit, or remove any request. The requester is emailed
        automatically if they left an address.
      </p>
      <AdminRequests initialRequests={requests} rooms={rooms} />
    </main>
  );
}
