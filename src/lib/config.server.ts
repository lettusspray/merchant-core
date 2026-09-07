/**
 * Server-only configuration surface.
 *
 * Every external provider is optional. Nothing here throws at module scope:
 * configuration is read lazily inside handlers because the edge runtime injects
 * env per request. When a credential is missing the platform reports a truthful
 * "not configured" state instead of simulating the provider.
 */

export type ProviderConfigStatus = {
  provider: string;
  category:
    | "visibility"
    | "ai"
    | "payments"
    | "discovery"
    | "storage"
    | "cache"
    | "observability"
    | "workflow";
  label: string;
  configured: boolean;
  /** Env var names an operator must set for this provider to go live. */
  requires: string[];
  /** Names that are present right now (never the values). */
  present: string[];
  detail: string;
};

/** Extra runtime health for discovery sources, surfaced from persisted state. */
export type DiscoveryRuntimeHealth = {
  provider: string;
  status: "not_configured" | "configured" | "syncing" | "error" | "never_run";
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  totalRuns: number;
  recordsReceived: number | null;
  recordsIngested: number | null;
};

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function readEnv(name: string): string | undefined {
  return env(name);
}

function status(
  spec: Omit<ProviderConfigStatus, "configured" | "present" | "detail">,
  detailWhenLive: string,
): ProviderConfigStatus {
  const present = spec.requires.filter((key) => env(key) !== undefined);
  const configured = present.length === spec.requires.length;
  return {
    ...spec,
    configured,
    present,
    detail: configured
      ? detailWhenLive
      : `Not configured — add ${spec.requires.filter((k) => !present.includes(k)).join(", ")} in Project Settings → Secrets.`,
  };
}

export const MERCERCROFT_ENV = {
  baseUrl: "MERCERCROFT_BASE_URL",
  apiKey: "MERCERCROFT_API_KEY",
  webhookSecret: "MERCERCROFT_WEBHOOK_SECRET",
} as const;

export const GOOGLE_PLACES_ENV = {
  apiKey: "GOOGLE_PLACES_API_KEY",
} as const;

export function providerStatuses(): ProviderConfigStatus[] {
  return [
    status(
      {
        provider: "mercercroft",
        category: "visibility",
        label: "MercerCroft AI Visibility",
        requires: [MERCERCROFT_ENV.baseUrl, MERCERCROFT_ENV.apiKey],
      },
      "Connected. Visibility runs are dispatched to the MercerCroft API.",
    ),
    status(
      {
        provider: "mercercroft-webhook",
        category: "visibility",
        label: "MercerCroft webhook signature",
        requires: [MERCERCROFT_ENV.webhookSecret],
      },
      "Inbound run callbacks are signature-verified.",
    ),
    status(
      {
        provider: "lovable-ai",
        category: "ai",
        label: "Lovable AI Gateway",
        requires: ["LOVABLE_API_KEY"],
      },
      "Default LLM route (Gemini / GPT families) is available.",
    ),
    status(
      { provider: "openai", category: "ai", label: "OpenAI", requires: ["OPENAI_API_KEY"] },
      "Available.",
    ),
    status(
      {
        provider: "anthropic",
        category: "ai",
        label: "Anthropic",
        requires: ["ANTHROPIC_API_KEY"],
      },
      "Available.",
    ),
    status(
      { provider: "google", category: "ai", label: "Google AI", requires: ["GOOGLE_AI_API_KEY"] },
      "Available.",
    ),
    status(
      {
        provider: "openrouter",
        category: "ai",
        label: "OpenRouter (aggregator)",
        requires: ["OPENROUTER_API_KEY"],
      },
      "Available — routes to OpenAI/Anthropic/Qwen/DeepSeek models.",
    ),
    status(
      { provider: "deepseek", category: "ai", label: "DeepSeek", requires: ["DEEPSEEK_API_KEY"] },
      "Available.",
    ),
    status(
      {
        provider: "stripe",
        category: "payments",
        label: "Stripe Connect",
        requires: ["STRIPE_SECRET_KEY"],
      },
      "Checkout sessions and refunds are created against Stripe.",
    ),
    status(
      {
        provider: "stripe-webhook",
        category: "payments",
        label: "Stripe webhook signature",
        requires: ["STRIPE_WEBHOOK_SECRET"],
      },
      "Inbound Stripe events are signature-verified.",
    ),
    status(
      {
        provider: "paystack",
        category: "payments",
        label: "Paystack",
        requires: ["PAYSTACK_SECRET_KEY"],
      },
      "Transactions are initialised against Paystack.",
    ),
    status(
      {
        provider: "google-places",
        category: "discovery",
        label: "Google Places",
        requires: ["GOOGLE_PLACES_API_KEY"],
      },
      "Place search discovery is live.",
    ),
    status(
      {
        provider: "website-probe",
        category: "discovery",
        label: "Website presence probe",
        requires: [],
      },
      "Built-in. Performs real HTTPS reachability and digital-gap checks.",
    ),
    status(
      {
        provider: "s3",
        category: "storage",
        label: "S3-compatible object storage",
        requires: ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"],
      },
      "Asset uploads and signed reads are live.",
    ),
    status(
      {
        provider: "redis",
        category: "cache",
        label: "Redis (Upstash REST)",
        requires: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
      },
      "Idempotency keys and rate limits are stored in Redis.",
    ),
    status(
      {
        provider: "sentry",
        category: "observability",
        label: "Sentry-compatible error capture",
        requires: ["SENTRY_DSN"],
      },
      "Server errors are forwarded to Sentry.",
    ),
    status(
      {
        provider: "temporal",
        category: "workflow",
        label: "Temporal",
        requires: ["TEMPORAL_ADDRESS", "TEMPORAL_NAMESPACE"],
      },
      "Workflows are dispatched to Temporal.",
    ),
  ];
}

export function providerStatus(provider: string): ProviderConfigStatus {
  const found = providerStatuses().find((entry) => entry.provider === provider);
  if (!found) throw new Error(`Unknown provider: ${provider}`);
  return found;
}
