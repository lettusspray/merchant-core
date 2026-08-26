/**
 * Provider adapter contracts.
 *
 * These types are client-safe (no runtime imports). Every external provider is
 * reached through one of these interfaces so the platform never depends on a
 * vendor SDK directly. Mock implementations live in `*.server.ts` siblings and
 * live implementations plug in behind the same shape.
 */

export type AdapterMode = "mock" | "live";

export type AdapterStatus = {
  provider: string;
  category: string;
  mode: AdapterMode;
  configured: boolean;
  detail: string;
};

/** Thrown when a live provider is selected but credentials are absent. */
export class ProviderNotConfiguredError extends Error {
  constructor(
    public provider: string,
    message?: string,
  ) {
    super(message ?? `${provider} is not configured. Add its credentials in Settings → Integrations.`);
    this.name = "ProviderNotConfiguredError";
  }
}

/* ------------------------------ AI Visibility ----------------------------- */

/** MercerCroft-compatible visibility payload (see /api/public/v1/visibility). */
export type VisibilityProbe = {
  engine: string;
  prompt: string;
  score: number;
  rank: number | null;
  mentioned: boolean;
  sentiment: "positive" | "neutral" | "negative" | null;
  citations: { url: string; title: string }[];
  captured_at: string;
};

export type VisibilityAdapter = {
  readonly provider: string;
  status(): AdapterStatus;
  probe(input: { merchantName: string; prompts: string[]; engines: string[] }): Promise<VisibilityProbe[]>;
};

/* -------------------------------- Discovery ------------------------------- */

export type DiscoveryResult = {
  name: string;
  vertical: string;
  city: string;
  region: string;
  website: string | null;
  phone: string | null;
  score: number;
  signals: string[];
};

export type DiscoveryAdapter = {
  readonly provider: string;
  status(): AdapterStatus;
  search(input: { query: string; vertical?: string; city?: string; limit?: number }): Promise<DiscoveryResult[]>;
};

/* ---------------------------------- AI ------------------------------------ */

export type AiAdapter = {
  readonly provider: string;
  status(): AdapterStatus;
  summarize(input: { instruction: string; content: string }): Promise<{ text: string; model: string }>;
};

/* -------------------------------- Payments -------------------------------- */

export type PaymentsAdapter = {
  readonly provider: string;
  status(): AdapterStatus;
  charge(input: { reference: string; amountCents: number }): Promise<{ id: string; status: string }>;
  refund(input: { reference: string }): Promise<{ id: string; status: string }>;
};

/* -------------------------------- Workflow -------------------------------- */

export type WorkflowStep = { name: string; status: "succeeded" | "failed"; detail?: string };

export type WorkflowAdapter = {
  readonly provider: string;
  status(): AdapterStatus;
  execute(input: {
    workflow: string;
    payload: Record<string, unknown>;
  }): Promise<{ steps: WorkflowStep[]; output: Record<string, unknown> }>;
};

/* -------------------------------- Sources --------------------------------- */

export type SourcePayload = {
  externalId: string;
  payload: Record<string, unknown>;
  observations: { fieldPath: string; observedValue: string; confidence: number }[];
};

export type SourceAdapter = {
  readonly provider: string;
  status(): AdapterStatus;
  fetch(input: { merchantName: string; merchantSlug: string }): Promise<SourcePayload[]>;
};
