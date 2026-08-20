import { redirect } from "next/navigation";
import { AdminConsole } from "@/components/admin-console";
import { getSessionUser } from "@/lib/session";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin" && user.role !== "super_admin") redirect("/app");
  return <AdminConsole initialUser={user} />;
}
