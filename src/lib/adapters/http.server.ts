/**
 * Shared outbound HTTP primitives for every provider adapter: timeouts,
 * bounded retries with jittered backoff, correlation IDs and structured errors.
 * Adapters never call `fetch` directly so this behaviour stays uniform.
 */

export class ProviderHttpError extends Error {
  constructor(
    public provider: string,
    public status: number,
    public body: string,
    public correlationId: string,
  ) {
    super(`${provider} responded ${status}: ${body.slice(0, 500)}`);
    this.name = "ProviderHttpError";
  }
}

export type HttpRequest = {
  provider: string;
  url: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  /** application/json (default) or form-encoded (Stripe / Paystack legacy). */
  encoding?: "json" | "form";
  timeoutMs?: number;
  retries?: number;
  correlationId?: string;
};

export type HttpResult<T> = { data: T; status: number; correlationId: string };

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

export function newCorrelationId(prefix = "mc"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function encodeForm(body: unknown): string {
  const params = new URLSearchParams();
  const walk = (prefix: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(`${prefix}[${index}]`, item));
    } else if (typeof value === "object") {
      for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
        walk(prefix ? `${prefix}[${key}]` : key, inner);
      }
    } else {
      params.set(prefix, String(value));
    }
  };
  walk("", body);
  return params.toString();
}

export async function httpJson<T>(request: HttpRequest): Promise<HttpResult<T>> {
  const {
    provider,
    url,
    method = "GET",
    headers = {},
    body,
    encoding = "json",
    timeoutMs = 15_000,
    retries = 2,
  } = request;
  const correlationId = request.correlationId ?? newCorrelationId();

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "x-correlation-id": correlationId,
          ...(body !== undefined
            ? { "content-type": encoding === "form" ? "application/x-www-form-urlencoded" : "application/json" }
            : {}),
          ...headers,
        },
        ...(body !== undefined
          ? { body: encoding === "form" ? encodeForm(body) : JSON.stringify(body) }
          : {}),
      });

      const text = await response.text();
      if (!response.ok) {
        if (RETRYABLE.has(response.status) && attempt < retries) {
          lastError = new ProviderHttpError(provider, response.status, text, correlationId);
          await sleep(backoff(attempt));
          continue;
        }
        throw new ProviderHttpError(provider, response.status, text, correlationId);
      }
      const data = (text.length > 0 ? JSON.parse(text) : {}) as T;
      return { data, status: response.status, correlationId };
    } catch (error) {
      lastError = error;
      const retryable = !(error instanceof ProviderHttpError) || RETRYABLE.has(error.status);
      if (attempt >= retries || !retryable) break;
      await sleep(backoff(attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`${provider} request failed (correlation ${correlationId})`);
}

function backoff(attempt: number): number {
  return Math.min(2_000, 200 * 2 ** attempt) + Math.floor(Math.random() * 150);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Timing-safe comparison for webhook signatures (no Node Buffer dependency). */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
