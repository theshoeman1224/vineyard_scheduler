"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { apiSend } from "@/app/lib/apiClient";
import { Notice } from "@/app/components/Notice";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await apiSend<unknown>("/api/admin/login", "POST", { password });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <h1 className="mb-1 text-2xl font-semibold">Admin sign in</h1>
      <p className="mb-6 text-sm text-muted">
        Enter the admin password to manage requests and rooms.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="password"
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin password"
          className="rounded-md border border-edge bg-card px-3 py-2 text-sm"
        />
        {error ? <Notice kind="error">{error}</Notice> : null}
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-invert px-4 py-2 text-sm font-medium text-invert-fg hover:opacity-85 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <Link href="/" className="mt-6 text-sm text-blue-600 hover:underline">
        ← Back to scheduler
      </Link>
    </main>
  );
}
