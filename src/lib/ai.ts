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

type OpenAiResponsePayload = {
  status?: string;
  model?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string } | null;
};

type OpenAiModelsPayload = {
  data?: Array<{ id?: string; created?: number; owned_by?: string }>;
  error?: { message?: string } | null;
};

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

async function openAiError(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => null) as OpenAiResponsePayload | OpenAiModelsPayload | null;
  const providerMessage = payload?.error?.message?.trim();
  const detail = providerMessage && providerMessage.length <= 500 ? providerMessage : fallback;
  return new Error(`OpenAI verification failed (${response.status}): ${detail}`);
}

export async function listOpenAiModels(): Promise<string[]> {
  const configuration = await aiConfiguration();
  if (!configuration.apiKey) throw new Error("OpenAI API key is not configured.");

  const response = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${configuration.apiKey}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw await openAiError(response, "Unable to list models for this API key.");

  const payload = await response.json() as OpenAiModelsPayload;
  const excluded = /(audio|realtime|image|embedding|moderation|tts|transcri|whisper|search|computer-use|codex|live|rosalind|daybreak|sora)/i;
  const models = (payload.data || [])
    .filter((item) => typeof item.id === "string")
    .filter((item) => {
      const id = item.id as string;
      const textFamily = id.startsWith("gpt-") || /^o\d(?:-|$)/.test(id) || id === "chat-latest" || id.startsWith("chatgpt");
      return textFamily && !excluded.test(id);
    })
    .sort((a, b) => Number(b.created || 0) - Number(a.created || 0) || String(a.id).localeCompare(String(b.id)))
    .map((item) => item.id as string);

  if (configuration.model && !models.includes(configuration.model)) models.unshift(configuration.model);
  return [...new Set(models)];
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

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: configuration.model,
      input: "Reply with exactly: OK",
      max_output_tokens: 16,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw await openAiError(response, "The configured model or API key was rejected.");

  const payload = await response.json() as OpenAiResponsePayload;
  const text = (payload.output || [])
    .flatMap((item) => item.content || [])
    .find((item) => item.type === "output_text")
    ?.text?.trim();

  if (payload.status !== "completed" || !text) {
    throw new Error("OpenAI verification failed: the provider did not return a completed text response.");
  }

  return {
    ok: true,
    model: configuration.model,
    providerModel: payload.model || configuration.model,
    response: text,
  };
}
