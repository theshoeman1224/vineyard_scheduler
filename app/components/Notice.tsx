"use client";

// Shared inline banner for one-off UI feedback (form errors, mutation
// results). Keeps error/success styling consistent across the scheduler,
// the admin tables, and the login form.

const KIND_STYLES = {
  error: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  success:
    "bg-green-50 text-green-800 dark:bg-green-500/10 dark:text-green-300",
  info: "bg-subtle text-muted",
} as const;

export function Notice({
  kind,
  children,
}: {
  kind: keyof typeof KIND_STYLES;
  children: React.ReactNode;
}) {
  return (
    <p
      className={`rounded-md px-3 py-2 text-sm ${KIND_STYLES[kind]}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}
