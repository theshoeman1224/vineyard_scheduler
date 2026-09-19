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
  readonly kind: keyof typeof KIND_STYLES;
  readonly children: React.ReactNode;
}) {
  if (kind === "error") {
    return (
      <p
        className={`rounded-md px-3 py-2 text-sm ${KIND_STYLES[kind]}`}
        role="alert"
      >
        {children}
      </p>
    );
  }
  // <output> exposes the status role natively, so live-region feedback
  // works the same across browsers and assistive tech.
  return (
    <output
      className={`block rounded-md px-3 py-2 text-sm ${KIND_STYLES[kind]}`}
    >
      {children}
    </output>
  );
}
