import "server-only";

import { getSettings } from "@/lib/admin-data";
import { getServiceSecret } from "@/lib/service-secrets";
import {
  ATTACHMENT_LIMITS,
  createCloudmersiveScanner,
  type AttachmentPolicy,
} from "../security/attachment-scan";

export async function getAttachmentPolicy(): Promise<AttachmentPolicy> {
  const settings = await getSettings();
  if (!settings.attachmentScanningRequired) return { mode: "disabled" };

  const apiKey = await getServiceSecret("ai_mail_cloudmersive_api_key")
    || process.env.CLOUDMERSIVE_API_KEY
    || "";

  if (!apiKey) return { mode: "required" };
  return {
    mode: "required",
    scanner: createCloudmersiveScanner(apiKey),
    timeoutMs: ATTACHMENT_LIMITS.timeoutMs,
  };
}

export async function attachmentPolicyStatus() {
  const policy = await getAttachmentPolicy();
  return {
    required: policy.mode === "required",
    configured: Boolean(policy.scanner),
    provider: policy.scanner?.id ?? null,
    limits: ATTACHMENT_LIMITS,
  };
}
