"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export function AdminNav() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <nav className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-4 text-sm font-medium">
        <Link href="/admin" className="hover:underline">
          Requests
        </Link>
        <Link href="/admin/rooms" className="hover:underline">
          Rooms &amp; blueprint
        </Link>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <Link href="/" className="text-blue-600 hover:underline">
          View site
        </Link>
        <button
          type="button"
          onClick={logout}
          className="rounded-md border border-edge bg-card px-3 py-1.5 hover:bg-subtle"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
