import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import { getEnv, hasAnthropicCredentials } from "@/lib/env";
import { extractJsonPayload } from "@/lib/json-extract";

const MAX_INPUT_CHARS = 60_000;
const MAX_ATTEMPTS = 2;

export class AnthropicNotConfiguredError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY is not configured.");
    this.name = "AnthropicNotConfiguredError";
  }
}

export class AnthropicResponseError extends Error {}

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!hasAnthropicCredentials()) throw new AnthropicNotConfiguredError();
  if (!cachedClient) cachedClient = new Anthropic({ apiKey: getEnv().ANTHROPIC_API_KEY });
  return cachedClient;
}

function truncateForLimit(text: string): string {
  return text.length > MAX_INPUT_CHARS ? `${text.slice(0, MAX_INPUT_CHARS)}\n...[truncated]` : text;
}

/**
 * Sends a prompt to Anthropic and validates the reply against `schema`, retrying once
 * with a corrective instruction if the model returns malformed or non-conforming JSON.
 * Never logs the API key or full request/response bodies — only truncated diagnostics.
 */
export async function callAnthropicStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const client = getClient();
  const env = getEnv();
  const boundedPrompt = truncateForLimit(userPrompt);

  let lastIssue = "";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const messageContent =
      attempt === 0
        ? boundedPrompt
        : `${boundedPrompt}\n\nYour previous reply could not be parsed (${lastIssue}). Reply again with ONLY valid JSON matching the required shape, no markdown fences, no commentary.`;

    let responseText: string;
    try {
      const response = await client.messages.create({
        model: env.ANTHROPIC_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: messageContent }],
      });
      const textBlock = response.content.find((block) => block.type === "text");
      responseText = textBlock && "text" in textBlock ? textBlock.text : "";
    } catch (error) {
      throw new AnthropicResponseError(
        `Anthropic API request failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }

    try {
      const json = JSON.parse(extractJsonPayload(responseText));
      return schema.parse(json);
    } catch (error) {
      lastIssue = error instanceof Error ? error.message.slice(0, 200) : "unknown parse error";
      console.warn(`[anthropic] malformed structured response on attempt ${attempt + 1}: ${lastIssue}`);
    }
  }

  throw new AnthropicResponseError(`Anthropic returned malformed JSON after ${MAX_ATTEMPTS} attempts: ${lastIssue}`);
}
