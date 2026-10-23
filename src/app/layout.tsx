import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ASSIST Mail — Intelligent Communications",
  description: "ASSIST Mail by Sovereign Super-Intelligence: secure intelligent communications, connected mailboxes, and human-controlled workflows.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
