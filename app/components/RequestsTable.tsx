"use client";

import type { RequestPublic } from "./Scheduler";
import { formatDateHuman } from "@/lib/dates";

function StatusPill({ status }: { status: RequestPublic["status"] }) {
  const styles =
    status === "confirmed"
      ? "bg-green-100 text-green-800"
      : status === "pending"
        ? "bg-amber-100 text-amber-800"
        : "bg-edge text-muted";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles}`}
    >
      {status}
    </span>
  );
}

export function RequestsTable({ requests }: { requests: RequestPublic[] }) {
  const visible = requests.filter((r) => r.status !== "denied");
  const sorted = [...visible].sort((a, b) =>
    (a.dates[0] ?? "").localeCompare(b.dates[0] ?? ""),
  );

  return (
    <section className="rounded-lg border border-edge bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold">Current requests</h2>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing requested yet — be the first.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-edge text-xs uppercase text-muted">
                <th className="py-2 pr-4">Dates</th>
                <th className="py-2 pr-4">Room</th>
                <th className="py-2 pr-4">Who</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-edge align-top last:border-0"
                >
                  <td className="py-2 pr-4">
                    {r.dates.map((d) => (
                      <div key={d}>{formatDateHuman(d)}</div>
                    ))}
                  </td>
                  <td className="py-2 pr-4 font-medium">{r.roomName}</td>
                  <td className="py-2 pr-4">{r.name}</td>
                  <td className="py-2 pr-4">
                    <StatusPill status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
