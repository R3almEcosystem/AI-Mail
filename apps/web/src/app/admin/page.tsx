import { redirect } from "next/navigation";
import { AdminConsole } from "@/components/admin-console";
import { getSessionUser } from "@/lib/session";
import { webPath } from "@/lib/web-path";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect(`${webPath("/login")}?next=${encodeURIComponent(webPath("/admin"))}`);
  if (user.role !== "admin" && user.role !== "super_admin") redirect(webPath("/inbox"));
  return <AdminConsole initialUser={user} />;
}
