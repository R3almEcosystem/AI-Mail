import { redirect } from "next/navigation";
import { MailDashboard } from "@/components/mail-dashboard";
import { getSessionUser } from "@/lib/session";
import { webPath } from "@/lib/web-path";

export default async function InboxPage() {
  const user = await getSessionUser();
  if (!user) redirect(`${webPath("/login")}?next=${encodeURIComponent(webPath("/inbox"))}`);
  return <MailDashboard initialUser={user} />;
}
