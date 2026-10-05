import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listActiveMailAccounts, resolveMailAccount } from "@/lib/mail-accounts";
import { mailConfiguration } from "@/lib/mail";
import { runMailResearch } from "@/lib/mail-research";
import { saveResearchHistory } from "@/lib/mail-research-history";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";

const accountIdSchema = z.union([
  z.literal("all"),
  z.literal("primary"),
  z.string().uuid(),
]);

const requestSchema = z.object({
  query: z.string().trim().min(3).max(2000),
  scope: z.enum(["inbox", "sent", "both"]),
  accountId: accountIdSchema.optional().default("all"),
});

export const maxDuration = 300;

type ResearchResult = Awaited<ReturnType<typeof runMailResearch>>;

async function runForAllAccounts(query: string, scope: "inbox" | "sent" | "both") {
  const accounts = await listActiveMailAccounts();
  if (!accounts.length) throw new Error("MAIL_ACCOUNT_NOT_CONFIGURED");

  const completed: Array<{ account: (typeof accounts)[number]; result: ResearchResult }> = [];
  const concurrency = 4;
  for (let index = 0; index < accounts.length; index += concurrency) {
    const batch = accounts.slice(index, index + concurrency);
    const results = await Promise.all(batch.map(async (account) => ({
      account,
      result: await runMailResearch(query, scope, account.id),
    })));
    completed.push(...results);
  }

  const matched = completed.reduce((sum, item) => sum + item.result.matched, 0);
  const included = completed.reduce((sum, item) => sum + item.result.included, 0);
  const excluded = completed.reduce((sum, item) => sum + item.result.excluded, 0);
  const capped = completed.some((item) => item.result.capped);
  const mode = completed.some((item) => item.result.mode === "report") ? "report" as const : "collection" as const;
  const model = completed.map((item) => item.result.model).find((value): value is string => Boolean(value)) || null;
  const warnings = completed.flatMap((item) => item.result.warnings.map((warning) => item.account.label + ": " + warning));
  const title = "Multi-account — " + (completed[0]?.result.title || "Mailbox Research");

  const lines = [
    "# " + title,
    "",
    "## Account Coverage",
    "",
    "- **Accounts searched:** " + completed.length,
    "- **Matching emails found:** " + matched,
    "- **Emails included:** " + included,
    "- **Emails excluded:** " + excluded,
    "",
  ];

  completed.forEach((item, index) => {
    lines.push(
      "## Account: " + item.account.label,
      "",
      "- **Mailbox:** " + item.account.email,
      "- **Matching emails:** " + item.result.matched,
      "- **Included:** " + item.result.included,
      "",
      item.result.markdown.replace(/^#\s+.+$/m, "### " + item.result.title),
    );
    if (index < completed.length - 1) lines.push("", "---", "");
  });

  return {
    title,
    markdown: lines.join("\n"),
    scope,
    mode,
    matched,
    included,
    excluded,
    capped,
    model,
    warnings,
    accountId: "all",
    accountLabel: "All accounts",
  };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireCapability("ai:use", request);
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a mailbox research instruction and select a valid scope/account." }, { status: 400, headers: privateHeaders });
    }
    if (user.demo) {
      return NextResponse.json({ error: "Mailbox research requires the live mailbox." }, { status: 409, headers: privateHeaders });
    }
    const accountId = parsed.data.accountId;
    if (!(await mailConfiguration(accountId === "all" ? undefined : accountId)).imap) {
      return NextResponse.json({ error: "Incoming mail is not configured for the selected account." }, { status: 503, headers: privateHeaders });
    }

    let result;
    if (accountId === "all") {
      result = await runForAllAccounts(parsed.data.query, parsed.data.scope);
    } else {
      const account = await resolveMailAccount(accountId);
      result = {
        ...(await runMailResearch(parsed.data.query, parsed.data.scope, accountId)),
        accountId,
        accountLabel: account.label,
      };
    }

    let history: { id: string; createdAt: string } | null = null;
    try {
      history = await saveResearchHistory(user, parsed.data.query, parsed.data.scope, result);
    } catch (historyError) {
      const historyMessage = historyError instanceof Error ? historyError.message : "";
      console.error("[mail-research-history] save failed", {
        name: historyError instanceof Error ? historyError.name : "UnknownError",
        code: historyMessage.slice(0, 120),
      });
    }
    return NextResponse.json({
      ...result,
      historySaved: Boolean(history),
      historyId: history?.id || null,
      historyCreatedAt: history?.createdAt || null,
    }, { headers: privateHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("[mail-research] request failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      code: message.slice(0, 180),
    });
    if (message === "MAIL_ACCOUNT_NOT_FOUND") {
      return NextResponse.json({ error: "The selected mail account is no longer available." }, { status: 404, headers: privateHeaders });
    }
    if (message === "MAIL_ACCOUNT_NOT_CONFIGURED") {
      return NextResponse.json({ error: "No active mail account is configured for research." }, { status: 503, headers: privateHeaders });
    }
    if (message === "OpenAI is not configured.") {
      return NextResponse.json({ error: "OpenAI is not configured for mailbox research." }, { status: 503, headers: privateHeaders });
    }
    if (message.startsWith("OpenAI research request failed")) {
      return NextResponse.json({ error: "OpenAI could not complete the mailbox research step. Retry the request or choose another configured model." }, { status: 502, headers: privateHeaders });
    }
    if (message.includes("safe mailbox search")) {
      return NextResponse.json({ error: "The AI could not interpret this mailbox query reliably. Try naming the people, addresses, phrase, or date range more explicitly." }, { status: 422, headers: privateHeaders });
    }
    return apiError(error, "Mailbox research could not be completed.");
  }
}
