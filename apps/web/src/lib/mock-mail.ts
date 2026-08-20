import type { MailMessage } from "@/lib/types";

export const mockMessages: MailMessage[] = [
  {
    uid: 1042,
    sender: "Nikki Gilbreth",
    senderEmail: "ngilbreth@northcapital.com",
    subject: "Opera integration — proposed next steps",
    preview:
      "Bernie, thank you for the updated architecture overview. I have outlined the items our implementation team needs before we schedule the technical session…",
    body:
      "Bernie,\n\nThank you for the updated architecture overview. I have outlined the items our implementation team needs before we schedule the technical session. Please send the current offering flow, identity-verification responsibilities, and the expected first issuer timeline.\n\nIf we can review those items this week, I can coordinate a working session with the Opera implementation group early next week.\n\nBest,\nNikki",
    receivedAt: "2026-08-19T16:42:00-04:00",
    unread: true,
    flagged: true,
    priority: "urgent",
    category: "Capital Markets",
    attachments: 1,
  },
  {
    uid: 1041,
    sender: "Martin Pelcin",
    senderEmail: "martin@r3alm.com",
    subject: "Bank authorization package is ready",
    preview:
      "The corrected resolutions and minutes are now assembled. I checked the signature spacing, dates, and officer titles against the final instructions…",
    body:
      "Bernie,\n\nThe corrected resolutions and minutes are now assembled. I checked the signature spacing, dates, and officer titles against the final instructions. The bank acknowledgment has been removed and both packages are ready for final review.\n\nMartin",
    receivedAt: "2026-08-19T15:18:00-04:00",
    unread: true,
    flagged: false,
    priority: "important",
    category: "Corporate",
    attachments: 3,
  },
  {
    uid: 1040,
    sender: "IP Capital Group",
    senderEmail: "docket@ipcapitalgroup.com",
    subject: "R3ALM trademark intake — additional specimens",
    preview:
      "We received the initial chain-of-title summary. Counsel requests dated examples showing use of the R3ALM mark by Capital Realm, Inc.…",
    body:
      "We received the initial chain-of-title summary. Counsel requests dated examples showing use of the R3ALM mark by Capital Realm, Inc. and the subsequent transfer to r3alm inc. Please upload the earliest website captures, presentations, and offering materials available.",
    receivedAt: "2026-08-19T13:07:00-04:00",
    unread: true,
    flagged: false,
    priority: "important",
    category: "Legal",
    attachments: 0,
  },
  {
    uid: 1039,
    sender: "Vercel",
    senderEmail: "notifications@vercel.com",
    subject: "Deployment completed for ai-mail",
    preview:
      "Your production deployment completed successfully. Build logs and runtime details are available in the project dashboard…",
    body:
      "Your production deployment completed successfully. Build logs and runtime details are available in the project dashboard.",
    receivedAt: "2026-08-19T11:51:00-04:00",
    unread: false,
    flagged: false,
    priority: "normal",
    category: "Technology",
    attachments: 0,
  },
  {
    uid: 1038,
    sender: "Marilyn Roosevelt",
    senderEmail: "marilyn@r3alm.com",
    subject: "Board materials for Friday",
    preview:
      "Can you include the final financing comparison and the updated R3EQ tokenomics note in the board packet? I would like to circulate it tomorrow…",
    body:
      "Can you include the final financing comparison and the updated R3EQ tokenomics note in the board packet? I would like to circulate it tomorrow afternoon so everyone has time to review it before Friday.",
    receivedAt: "2026-08-19T10:34:00-04:00",
    unread: false,
    flagged: true,
    priority: "important",
    category: "Corporate",
    attachments: 0,
  },
  {
    uid: 1037,
    sender: "Rialto Markets",
    senderEmail: "onboarding@rialtomarkets.com",
    subject: "Transfer-agent onboarding checklist",
    preview:
      "Attached is the working checklist for issuer onboarding, shareholder records, and digital-security controls…",
    body:
      "Attached is the working checklist for issuer onboarding, shareholder records, and digital-security controls. Please identify the operational owner for each workstream before our kickoff call.",
    receivedAt: "2026-08-18T17:22:00-04:00",
    unread: false,
    flagged: false,
    priority: "normal",
    category: "Capital Markets",
    attachments: 2,
  },
];

