import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { AdminNav } from "@/app/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <AdminNav />
      {children}
    </div>
  );
}
