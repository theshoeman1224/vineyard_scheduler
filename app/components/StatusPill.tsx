"use client";

// Colored status badge shared by the public requests table and the admin
// requests table. Unknown statuses fall back to the neutral style.

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  denied: "bg-edge text-muted",
};

export function StatusPill({ status }: { readonly status: string }) {
  const styles = STATUS_STYLES[status] ?? "bg-edge text-muted";
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles}`}
    >
      {status}
    </span>
  );
}
