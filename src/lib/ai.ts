import "server-only";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { prepareAiDisclosure, validateAiOutput, type AiTask, type AiMailInput } from "../security/ai-disclosure";

export function aiConfiguration() {
  return { configured:Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL), model:process.env.OPENAI_MODEL || null };
}
export async function analyzeMail(action:AiTask,message:AiMailInput,extraInstructions?:string) {
  const prepared=prepareAiDisclosure(action,message,extraInstructions);
  const configuration=aiConfiguration();
  if(!configuration.configured || !configuration.model)throw new Error("OpenAI is not configured.");
  const result=await generateText({
    model:openai(configuration.model), system:prepared.system, prompt:prepared.prompt,
    maxOutputTokens:1000, maxRetries:0, abortSignal:AbortSignal.timeout(20_000),
  });
  return {text:validateAiOutput(result.text),usage:result.usage,truncated:prepared.truncated};
}
