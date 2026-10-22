"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";

// Fallback for unexpected errors while rendering a page. In production the
// error carries only a digest (never the server's message), which matches
// the server log line, so show that rather than the message.
export default function ErrorPage({
  error,
  retry,
}: {
  readonly error: Error & { digest?: string };
  readonly retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16 text-center">
      <h1 className="mb-2 text-2xl font-semibold">Something went wrong</h1>
      <p className="mb-6 text-sm text-muted">
        The page could not load. This is usually temporary.
        {error.digest ? ` (Reference: ${error.digest})` : null}
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-md bg-invert px-4 py-2 text-sm font-medium text-invert-fg"
      >
        Try again
      </button>
    </main>
  );
}
