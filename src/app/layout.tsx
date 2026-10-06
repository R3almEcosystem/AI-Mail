import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "r3alm S.I.-Mail — Executive Inbox Intelligence",
  description: "A secure, S.I.-powered email command center with team governance and human-controlled workflows.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
