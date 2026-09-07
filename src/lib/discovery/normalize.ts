/**
 * Discovery normalization — pure, provider-neutral, client-safe.
 *
 * Converts source-native business records into the canonical discovery
 * representation. Normalization NEVER invents facts: every output field is
 * derived mechanically from the source payload so provenance stays truthful.
 * Raw source facts, normalized facts, observations and derived scores are kept
 * conceptually separate (see pipeline.server.ts).
 */

export const DISCOVERY_VERTICALS = [
  "restaurant",
  "home_service",
  "beauty",
  "pet_service",
  "automotive",
  "local_retail",
  "other",
] as const;

export type DiscoveryVertical = (typeof DISCOVERY_VERTICALS)[number];

/** A single business record exactly as a provider returned it (adapter output). */
export type SourceBusinessRecord = {
  /** Stable, provider-scoped identifier. Required — it anchors idempotency. */
  externalId: string;
  name: string;
  categories: string[];
  addressLine1: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  rating: number | null;
  reviewCount: number | null;
  sourceUrl: string | null;
  /** Provider-reported timestamp when available, else retrieval time. */
  sourceObservedAt: string | null;
  retrievedAt: string;
  raw: Record<string, unknown>;
};

export type NormalizedCandidate = {
  name: string;
  slug: string;
  vertical: DiscoveryVertical;
  categoryLabel: string | null;
  addressLine1: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  phoneE164: string | null;
  website: string | null;
  domain: string | null;
  hours: string | null;
  sourceUrl: string | null;
  externalId: string;
  matchName: string;
};

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/** Collapses a business name to a comparison key (no punctuation, no suffixes). */
export function normalizeName(value: string): string {
  const stripped = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const noise = new Set([
    "the",
    "inc",
    "llc",
    "ltd",
    "co",
    "company",
    "corp",
    "limited",
    "plc",
    "gmbh",
    "and",
  ]);
  return stripped
    .split(" ")
    .filter((word) => word.length > 0 && !noise.has(word))
    .join(" ");
}

/**
 * Best-effort E.164 normalization. Only digits and a leading `+` survive; when
 * the number has no country code and looks like NANP we prefix +1, otherwise we
 * keep the digits unprefixed rather than guessing a country.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+") || trimmed.startsWith("00");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (hasPlus) {
    const cleaned = trimmed.startsWith("00") ? digits.replace(/^00/, "") : digits;
    return `+${cleaned}`;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits;
}

/** Normalizes a website URL to an absolute https-preferring URL. */
export function normalizeWebsite(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value.replace(/^\/+/, "")}`;
  try {
    const url = new URL(value);
    if (!url.hostname.includes(".")) return null;
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** Registrable-ish domain for dedupe: lowercase host without `www.`. */
export function normalizeDomain(raw: string | null | undefined): string | null {
  const website = normalizeWebsite(raw);
  if (!website) return null;
  try {
    return new URL(website).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Comparison form of an address line: lowercase, no punctuation, collapsed. */
export function normalizeAddress(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw
    .toLowerCase()
    .replace(/[.,#]/g, " ")
    .replace(/\b(street|str)\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\broad\b/g, "rd")
    .replace(/\bboulevard\b/g, "blvd")
    .replace(/\bsuite\b/g, "ste")
    .replace(/\s+/g, " ")
    .trim();
  return value.length > 0 ? value : null;
}

const VERTICAL_KEYWORDS: Array<{ vertical: DiscoveryVertical; words: string[] }> = [
  {
    vertical: "restaurant",
    words: [
      "restaurant",
      "cafe",
      "coffee",
      "bakery",
      "bar",
      "pub",
      "pizza",
      "food",
      "bistro",
      "grill",
      "diner",
      "deli",
      "fast_food",
      "ice_cream",
      "catering",
    ],
  },
  {
    vertical: "home_service",
    words: [
      "plumb",
      "electric",
      "hvac",
      "roof",
      "contractor",
      "handyman",
      "cleaning",
      "landscap",
      "pest",
      "locksmith",
      "painter",
      "builder",
      "carpenter",
      "moving",
    ],
  },
  {
    vertical: "beauty",
    words: [
      "salon",
      "beauty",
      "hair",
      "nail",
      "spa",
      "barber",
      "massage",
      "cosmetic",
      "skin",
      "tattoo",
      "lash",
    ],
  },
  {
    vertical: "pet_service",
    words: ["pet", "veterinar", "vet", "groom", "kennel", "dog", "animal", "boarding"],
  },
  {
    vertical: "automotive",
    words: ["car", "auto", "tyre", "tire", "mechanic", "garage", "vehicle", "motor", "detailing"],
  },
  {
    vertical: "local_retail",
    words: [
      "shop",
      "store",
      "retail",
      "boutique",
      "market",
      "grocery",
      "supermarket",
      "books",
      "florist",
      "hardware",
      "clothes",
      "convenience",
    ],
  },
];

/**
 * Maps free-form provider categories (plus an optional operator-supplied
 * vertical hint) onto the platform vertical enum. Falls back to `other` rather
 * than guessing, so the pipeline stays vertical-agnostic.
 */
export function inferVertical(
  categories: string[],
  hint?: string | null,
): { vertical: DiscoveryVertical; matched: string | null } {
  if (hint && (DISCOVERY_VERTICALS as readonly string[]).includes(hint)) {
    return { vertical: hint as DiscoveryVertical, matched: "operator hint" };
  }
  const haystack = categories.join(" ").toLowerCase();
  for (const entry of VERTICAL_KEYWORDS) {
    const hit = entry.words.find((word) => haystack.includes(word));
    if (hit) return { vertical: entry.vertical, matched: hit };
  }
  return { vertical: "other", matched: null };
}

export function normalizeRecord(
  record: SourceBusinessRecord,
  verticalHint?: string | null,
): NormalizedCandidate {
  const { vertical } = inferVertical(record.categories, verticalHint);
  const name = record.name.trim().replace(/\s+/g, " ");
  const website = normalizeWebsite(record.website);
  return {
    name,
    slug: slugify(name),
    vertical,
    categoryLabel: record.categories[0] ?? null,
    addressLine1: record.addressLine1?.trim() || null,
    city: record.city?.trim() || null,
    region: record.region?.trim() || null,
    postalCode: record.postalCode?.trim() || null,
    country: record.country?.trim() || null,
    latitude: Number.isFinite(record.latitude as number) ? (record.latitude as number) : null,
    longitude: Number.isFinite(record.longitude as number) ? (record.longitude as number) : null,
    phone: record.phone?.trim() || null,
    phoneE164: normalizePhone(record.phone),
    website,
    domain: normalizeDomain(website),
    hours: record.hours?.trim() || null,
    sourceUrl: record.sourceUrl?.trim() || null,
    externalId: record.externalId,
    matchName: normalizeName(name),
  };
}

/** Field-level view used to build observations and to diff refreshes. */
export function normalizedFields(
  normalized: NormalizedCandidate,
): Array<{ path: string; value: string | null }> {
  return [
    { path: "name", value: normalized.name },
    { path: "vertical", value: normalized.vertical },
    { path: "category", value: normalized.categoryLabel },
    { path: "address_line1", value: normalized.addressLine1 },
    { path: "city", value: normalized.city },
    { path: "region", value: normalized.region },
    { path: "postal_code", value: normalized.postalCode },
    { path: "country", value: normalized.country },
    { path: "latitude", value: normalized.latitude === null ? null : String(normalized.latitude) },
    {
      path: "longitude",
      value: normalized.longitude === null ? null : String(normalized.longitude),
    },
    { path: "phone", value: normalized.phoneE164 ?? normalized.phone },
    { path: "website", value: normalized.website },
    { path: "hours", value: normalized.hours },
  ];
}
