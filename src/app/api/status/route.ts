import { NextResponse } from "next/server";
import { aiConfiguration } from "@/lib/ai";
import { authenticationConfigured, demoLoginEnabled } from "@/lib/auth";
import { databaseConfigured } from "@/lib/admin-data";
import { mailConfiguration } from "@/lib/mail";
import { requireCapability } from "@/lib/session";
import { apiError, privateHeaders } from "@/lib/api-error";
import { attachmentVaultStatus } from "@/lib/attachment-content";
import { attachmentPolicyStatus } from "@/lib/attachment-policy";
import type { AppStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireCapability("mail:read");
    const [mail, ai, attachmentVault, attachmentScan] = await Promise.all([
      mailConfiguration(),
      aiConfiguration(),
      attachmentVaultStatus().catch(() => ({ bucketsReady: false, storageApiConfigured: false, databaseFallback: true })),
      attachmentPolicyStatus(),
    ]);
    const status: AppStatus = {
      mode: mail.imap && !user.demo ? "live" : "demo",
      authentication: authenticationConfigured(),
      database: databaseConfigured(),
      demoLogin: demoLoginEnabled(),
      imap: mail.imap,
      smtp: mail.smtp,
      openai: ai.configured,
      model: ai.model,
      aiTone: ai.tone,
      aiAutoSummarize: ai.autoSummarize,
      aiPriorityDetection: ai.priorityDetection,
      attachmentVault,
      attachmentScanning: {
        required: attachmentScan.required,
        configured: attachmentScan.configured,
        provider: attachmentScan.provider,
        maxBytes: attachmentScan.limits.maxBytes,
        maxTotalBytes: attachmentScan.limits.maxTotalBytes,
        maxFiles: attachmentScan.limits.maxFiles,
      },
    };
    return NextResponse.json(status, { headers: privateHeaders });
  } catch (error) {
    return apiError(error);
  }
}
