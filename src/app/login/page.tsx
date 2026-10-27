import type { Metadata } from "next";
import { LoginPanel } from "@/components/login-panel";
import { SovsiAuthShell } from "@/components/sovsi-auth-shell";

export const metadata: Metadata = {
  title: "Sign in | ASSIST Mail · SOVSI ID",
  description: "Secure SOVSI ID sign-in for ASSIST Mail. Verify your existing authenticator; mailbox permissions remain independently enforced.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <SovsiAuthShell><LoginPanel /></SovsiAuthShell>;
}
