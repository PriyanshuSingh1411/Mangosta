import { redirect } from "next/navigation";
import { isAuthenticated } from "@/app/lib/adminAuth";
import AdminShell from "./AdminShell";

// Every /admin/* route (except /admin/login itself) is guarded here at the
// layout level - a single server-side check that covers all admin pages
// without needing to repeat it in each page component.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAuthenticated();
  if (!authed) {
    redirect("/admin/login");
  }

  return <AdminShell>{children}</AdminShell>;
}
