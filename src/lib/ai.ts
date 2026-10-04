import "server-only";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getSettings } from "@/lib/admin-data";
import { getServiceSecret } from "@/lib/service-secrets";
import { prepareAiDisclosure, validateAiOutput, type AiTask, type AiMailInput } from "../security/ai-disclosure";

const toneGuidance = {
  concise: "Be concise, executive-oriented, and direct. Prefer short paragraphs and only essential detail.",
  balanced: "Be clear and complete while staying efficient. Include enough context to support decisions.",
  detailed: "Provide a thorough, structured response with relevant context, implications, and next actions.",
} as const;

export async function aiConfiguration() {
  const settings = await getSettings();
  const apiKey = await getServiceSecret("ai_mail_openai_api_key") || process.env.OPENAI_API_KEY || "";
  const model = settings.aiModel || process.env.OPENAI_MODEL || null;
  return {
    configured: Boolean(apiKey && model),
    apiKey,
    model,
    tone: settings.aiTone,
    autoSummarize: settings.aiAutoSummarize,
    priorityDetection: settings.aiPriorityDetection,
  };
}

export async function analyzeMail(action: AiTask, message: AiMailInput, extraInstructions?: string) {
  const prepared = prepareAiDisclosure(action, message, extraInstructions);
  const configuration = await aiConfiguration();
  if (!configuration.configured || !configuration.model || !configuration.apiKey) throw new Error("OpenAI is not configured.");
  const provider = createOpenAI({ apiKey: configuration.apiKey });
  const result = await generateText({
    model: provider(configuration.model),
    system: `${prepared.system}\n\nResponse style: ${toneGuidance[configuration.tone]}`,
    prompt: prepared.prompt,
    maxOutputTokens: 1000,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(20_000),
  });
  return { text: validateAiOutput(result.text), usage: result.usage, truncated: prepared.truncated };
}

export async function testAiConnection() {
  const configuration = await aiConfiguration();
  if (!configuration.configured || !configuration.model || !configuration.apiKey) throw new Error("OpenAI is not configured.");
  const provider = createOpenAI({ apiKey: configuration.apiKey });
  const result = await generateText({
    model: provider(configuration.model),
    prompt: "Reply with exactly: OK",
    maxOutputTokens: 8,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(15_000),
  });
  return { ok: Boolean(result.text.trim()), model: configuration.model };
}
