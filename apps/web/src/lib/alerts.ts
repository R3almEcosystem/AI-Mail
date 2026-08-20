export type AlertSeverity = "critical" | "warning" | "info" | "success";
export type AlertStatus = "active" | "snoozed" | "resolved";
export type AlertDestination = "message" | "settings" | "inbox";

export type AlertRecord = {
  id: string;
  title: string;
  summary: string;
  detail: string;
  source: string;
  time: string;
  severity: AlertSeverity;
  status: AlertStatus;
  unread: boolean;
  destination: AlertDestination;
  messageUid?: number;
  escalatedToGroupId?: string;
  escalatedAt?: string;
};

export const initialAlerts: AlertRecord[] = [
  {
    id: "opera-deadline",
    title: "Opera response due tomorrow",
    summary: "North Capital is waiting on three implementation items before scheduling the technical session.",
    detail: "Send the current offering flow, identity-verification responsibilities, and expected first-issuer timeline. Completing this before 10:00 AM keeps the Opera implementation session on track for early next week.",
    source: "North Capital",
    time: "3h",
    severity: "critical",
    status: "active",
    unread: true,
    destination: "message",
    messageUid: 1042,
  },
  {
    id: "bank-package",
    title: "Bank package ready for approval",
    summary: "The corrected resolutions and minutes have passed the final internal check.",
    detail: "Signature spacing, dates, officer titles, and the removal of the bank acknowledgment were checked against the approved instructions. The package is ready for your final review.",
    source: "Corporate",
    time: "4h",
    severity: "warning",
    status: "active",
    unread: true,
    destination: "message",
    messageUid: 1041,
  },
  {
    id: "trademark-specimens",
    title: "Trademark specimens requested",
    summary: "Counsel needs dated R3ALM use examples to complete the chain-of-title record.",
    detail: "Collect the earliest website captures, presentations, and offering materials showing Capital Realm, Inc. using the R3ALM mark before its transfer to r3alm inc.",
    source: "Legal",
    time: "6h",
    severity: "warning",
    status: "active",
    unread: true,
    destination: "message",
    messageUid: 1040,
  },
  {
    id: "security-setup",
    title: "Production authentication incomplete",
    summary: "The preview is protected by demo sessions; production identity secrets are not configured.",
    detail: "Add AUTH_SECRET and DATABASE_URL in Vercel, seed the initial Super Admin, and keep demo login disabled before promoting this build to ai-mail.r3alm.com.",
    source: "Security",
    time: "Now",
    severity: "critical",
    status: "active",
    unread: true,
    destination: "settings",
  },
  {
    id: "preview-ready",
    title: "AI-Mail preview deployed",
    summary: "Version 0.2.0 passed build, route, and browser verification.",
    detail: "The landing page, Bernie demo access, dashboard, Admin Console, user-management forms, settings, and audit views are available in the isolated preview deployment.",
    source: "Deployment",
    time: "8h",
    severity: "success",
    status: "active",
    unread: false,
    destination: "inbox",
  },
];
