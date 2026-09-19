"use client";

import type { ReactNode } from "react";

// Label + control wrapper shared by the public request form and the admin
// edit form, so label/input styling stays consistent. `span` stretches
// the field across both grid columns.

export const inputClass = "rounded-md border border-edge bg-card px-3 py-2";

export function Field({
  label,
  span,
  children,
}: {
  readonly label: ReactNode;
  readonly span?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${span ? "sm:col-span-2" : ""}`}>
      <span className="text-fg">{label}</span>
      {children}
    </label>
  );
}
