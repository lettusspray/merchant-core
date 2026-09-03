/**
 * AI gateway — one internal interface for every LLM provider.
 *
 * Domain services call `generateText()` and never a vendor SDK. Provider choice
 * is configuration, not code: the first configured provider in `ROUTES` wins
 * unless the caller pins one. When nothing is configured the gateway returns a
 * truthful `configured: false` result and callers fall back to deterministic
 * templates — it never fabricates a provider response.
 */
import { readEnv } from "@/lib/config.server";
import { httpJson, newCorrelationId } from "./http.server";

export type AiProvider = "lovable" | "openai" | "anthropic" | "google" | "openrouter" | "deepseek";

export type AiRequest = {
  /** Stable identifier of the prompt template, persisted with the output. */
  promptId: string;
  promptVersion: string;
  system: string;
  user: string;
  provider?: AiProvider;
  temperature?: number;
  correlationId?: string;
};

export type AiResult =
  | {
      configured: true;
      text: string;
      provider: AiProvider;
      model: string;
      promptId: string;
      promptVersion: string;
      inputTokens: number | null;
      outputTokens: number | null;
      correlationId: string;
    }
  | {
      configured: false;
      reason: string;
      /** Providers the operator could enable, for the integrations screen. */
      candidates: AiProvider[];
    };

type Route = {
  provider: AiProvider;
  envKey: string;
  model: string;
  call: (input: { apiKey: string; model: string; req: AiRequest; correlationId: string }) => Promise<{
    text: string;
    inputTokens: number | null;
    outputTokens: number | null;
  }>;
};

/** OpenAI-compatible chat completions (Lovable gateway, OpenAI, OpenRouter, DeepSeek). */
async function openAiCompatible(
  baseUrl: string,
  provider: string,
  { apiKey, model, req, correlationId }: { apiKey: string; model: string; req: AiRequest; correlationId: string },
) {
  const { data } = await httpJson<{
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  }>({
    provider,
    url: `${baseUrl}/chat/completions`,
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    correlationId,
    body: {
      model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
    },
  });
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
  };
}

const ROUTES: Route[] = [
  {
    provider: "lovable",
    envKey: "LOVABLE_API_KEY",
    // Pinned platform model for the Lovable AI Gateway.
    model: "openai/gpt-5.6-sol",
    call: (input) => openAiCompatible("https://ai.gateway.lovable.dev/v1", "lovable-ai", input),
  },
  {
    provider: "openai",
    envKey: "OPENAI_API_KEY",
    model: "gpt-4.1-mini",
    call: (input) => openAiCompatible("https://api.openai.com/v1", "openai", input),
  },
  {
    provider: "anthropic",
    envKey: "ANTHROPIC_API_KEY",
    model: "claude-sonnet-4-20250514",
    call: async ({ apiKey, model, req, correlationId }) => {
      const { data } = await httpJson<{
        content?: { text?: string }[];
        usage?: { input_tokens?: number; output_tokens?: number };
      }>({
        provider: "anthropic",
        url: "https://api.anthropic.com/v1/messages",
        method: "POST",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        correlationId,
        body: {
          model,
          max_tokens: 1600,
          system: req.system,
          messages: [{ role: "user", content: req.user }],
        },
      });
      return {
        text: data.content?.map((part) => part.text ?? "").join("") ?? "",
        inputTokens: data.usage?.input_tokens ?? null,
        outputTokens: data.usage?.output_tokens ?? null,
      };
    },
  },
  {
    provider: "google",
    envKey: "GOOGLE_AI_API_KEY",
    model: "gemini-2.5-flash",
    call: async ({ apiKey, model, req, correlationId }) => {
      const { data } = await httpJson<{
        candidates?: { content?: { parts?: { text?: string }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      }>({
        provider: "google-ai",
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        method: "POST",
        correlationId,
        body: {
          systemInstruction: { parts: [{ text: req.system }] },
          contents: [{ role: "user", parts: [{ text: req.user }] }],
        },
      });
      return {
        text: data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "",
        inputTokens: data.usageMetadata?.promptTokenCount ?? null,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
      };
    },
  },
  {
    provider: "openrouter",
    envKey: "OPENROUTER_API_KEY",
    model: "qwen/qwen-2.5-72b-instruct",
    call: (input) => openAiCompatible("https://openrouter.ai/api/v1", "openrouter", input),
  },
  {
    provider: "deepseek",
    envKey: "DEEPSEEK_API_KEY",
    model: "deepseek-chat",
    call: (input) => openAiCompatible("https://api.deepseek.com/v1", "deepseek", input),
  },
];

export function aiProviderAvailability(): { provider: AiProvider; configured: boolean; model: string }[] {
  return ROUTES.map((route) => ({
    provider: route.provider,
    configured: readEnv(route.envKey) !== undefined,
    model: route.model,
  }));
}

export async function generateText(req: AiRequest): Promise<AiResult> {
  const candidates = req.provider ? ROUTES.filter((r) => r.provider === req.provider) : ROUTES;
  const route = candidates.find((r) => readEnv(r.envKey) !== undefined);
  if (!route) {
    return {
      configured: false,
      reason: req.provider
        ? `${req.provider} is not configured.`
        : "No AI provider is configured. Add a provider key in Project Settings → Secrets.",
      candidates: candidates.map((r) => r.provider),
    };
  }

  const correlationId = req.correlationId ?? newCorrelationId("ai");
  const out = await route.call({
    apiKey: readEnv(route.envKey)!,
    model: route.model,
    req,
    correlationId,
  });
  return {
    configured: true,
    text: out.text.trim(),
    provider: route.provider,
    model: route.model,
    promptId: req.promptId,
    promptVersion: req.promptVersion,
    inputTokens: out.inputTokens,
    outputTokens: out.outputTokens,
    correlationId,
  };
}
