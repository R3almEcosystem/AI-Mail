import { NextResponse } from "next/server";
import { buildMailAlerts, initialAlerts, type AlertRecord } from "@/lib/alerts";
import { apiError, privateHeaders } from "@/lib/api-error";
import { listActiveMailAccounts } from "@/lib/mail-accounts";
import { listMail } from "@/lib/mail";
import { requireCapability } from "@/lib/session";
import type { MailAccountSummary, MailMessage } from "@/lib/types";

export const maxDuration = 300;

type Coverage = {
  total: number;
  covered: number;
  failed: number;
};

function accountFailureAlert(account: MailAccountSummary, reason: unknown): AlertRecord {
  const code = reason instanceof Error ? reason.message : "MAIL_ACCOUNT_MONITOR_FAILED";
  return {
    id: "mailbox-monitor:" + account.id,
    title: "Mailbox monitoring failed",
    summary: account.label + " could not be scanned for Activity Center alerts.",
    detail: "AI-Mail could not refresh Inbox/Sent alerts for this mailbox. Review the account connection and use Test IMAP. Diagnostic code: " + code.slice(0, 120),
    source: "Mailbox monitor",
    time: "Now",
    severity: "critical",
    status: "active",
    unread: true,
    destination: "settings",
    accountId: account.id,
    accountLabel: account.label,
  };
}

async function loadAccountMessages(account: MailAccountSummary) {
  const folders = ["INBOX", "INBOX.Sent"] as const;
  const results = await Promise.allSettled(
    folders.map(async (folder) => {
      const page = await listMail(folder, 30, undefined, account.id);
      return { folder, messages: page.messages };
    }),
  );

  const messages: MailMessage[] = [];
  const failedFolders: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") messages.push(...result.value.messages);
    else failedFolders.push(folders[index]);
  });
  return { messages, failedFolders };
}

export async function GET() {
  try {
    const user = await requireCapability("mail:read");

    if (user.demo) {
      return NextResponse.json({
        alerts: initialAlerts,
        accounts: [{
          id: "primary",
          label: "Primary mailbox",
          email: user.email,
          primary: true,
          active: true,
          imapReady: true,
          smtpReady: true,
        }],
        coverage: { total: 1, covered: 1, failed: 0 } satisfies Coverage,
        demo: true,
      }, { headers: privateHeaders });
    }

    const accounts = await listActiveMailAccounts();
    const activeAccounts = accounts.filter((account) => account.active && account.imapReady);
    const messages: MailMessage[] = [];
    const failureAlerts: AlertRecord[] = [];
    let covered = 0;

    const concurrency = 4;
    for (let index = 0; index < activeAccounts.length; index += concurrency) {
      const batch = activeAccounts.slice(index, index + concurrency);
      const results = await Promise.all(batch.map(async (account) => {
        try {
          const loaded = await loadAccountMessages(account);
          return { account, messages: loaded.messages, failedFolders: loaded.failedFolders, error: null as unknown };
        } catch (error) {
          return { account, messages: [] as MailMessage[], failedFolders: ["INBOX", "INBOX.Sent"], error };
        }
      }));

      for (const result of results) {
        if (result.error || !result.messages.length && result.failedFolders.length === 2) {
          failureAlerts.push(accountFailureAlert(result.account, result.error || new Error("INBOX_AND_SENT_UNAVAILABLE")));
          continue;
        }

        covered += 1;
        messages.push(...result.messages);
        if (result.failedFolders.length) {
          failureAlerts.push({
            id: "mailbox-monitor-partial:" + result.account.id,
            title: "Mailbox monitoring is partially available",
            summary: result.account.label + " could not scan " + result.failedFolders.join(" and ") + ".",
            detail: "Activity Center is still monitoring the available folder(s) for this mailbox. Review the Sent folder name and IMAP account settings if outbound monitoring is expected.",
            source: "Mailbox monitor",
            time: "Now",
            severity: "warning",
            status: "active",
            unread: true,
            destination: "settings",
            accountId: result.account.id,
            accountLabel: result.account.label,
          });
        }
      }
    }

    const alerts = [
      ...failureAlerts,
      ...buildMailAlerts(messages),
    ].slice(0, 500);

    return NextResponse.json({
      alerts,
      accounts: activeAccounts,
      coverage: {
        total: activeAccounts.length,
        covered,
        failed: activeAccounts.length - covered,
      } satisfies Coverage,
      demo: false,
    }, { headers: privateHeaders });
  } catch (error) {
    return apiError(error, "Unable to refresh Activity Center alerts.");
  }
}
