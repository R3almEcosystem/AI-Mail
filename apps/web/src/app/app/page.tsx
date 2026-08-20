import { redirect } from "next/navigation";
import { MailDashboard } from "@/components/mail-dashboard";
import { getSessionUser } from "@/lib/session";

export default async function AppPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/app");
  return <MailDashboard initialUser={user} />;
}
