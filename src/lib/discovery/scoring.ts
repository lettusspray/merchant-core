/**
 * Discovery scoring — deterministic and explainable.
 *
 * The final score is a weighted mean of observable acquisition signals. Every
 * component is stored alongside the total (`discovery_candidates.score_components`)
 * so an operator can see WHY a candidate scored the way it did. Scoring never
 * invents facts: each field is derived from the normalized source record or
 * from pipeline metadata (source confidence, retrieval freshness, duplicates).
 */
import type { NormalizedCandidate } from "./normalize";
import { DISCOVERY_SOURCES } from "./sources";

export type ScoreComponent = {
  key: string;
  label: string;
  score: number;
  weight: number;
  note: string;
};

export type ScoreResult = {
  score: number;
  components: ScoreComponent[];
  signals: string[];
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

const SOURCE_CONFIDENCE: Record<string, number> = {
  openstreetmap: 0.75,
  "google-places": 0.9,
  "local-demo": 0.45,
};

export function sourceConfidence(provider: string): number {
  return SOURCE_CONFIDENCE[provider] ?? 0.5;
}

export type ScoreOptions = {
  provider?: string;
  retrievedAt?: string | null;
  /** 0..1 — how confident the pipeline is this is a distinct, non-duplicate record. */
  duplicateConfidence?: number;
  /** True when an operator-supplied vertical hint matched. */
  verticalHintMatched?: boolean;
};

export function computeScore(
  normalized: NormalizedCandidate,
  options: ScoreOptions = {},
): ScoreResult {
  const components: ScoreComponent[] = [];
  const signals = new Set<string>();

  const nameScore = normalized.name.length >= 2 ? 1 : 0;
  components.push({
    key: "identity_completeness",
    label: "Business name present",
    score: nameScore,
    weight: 3,
    note: nameScore ? "Recognisable business name." : "Missing or unusable name.",
  });
  if (nameScore) signals.add("has_name");

  const hasWebsite = Boolean(normalized.website);
  components.push({
    key: "website_presence",
    label: "Website present",
    score: hasWebsite ? 1 : 0,
    weight: 1,
    note: hasWebsite ? "Source lists a website." : "No website recorded by the source.",
  });
  if (hasWebsite) signals.add("has_website");
  else signals.add("no_website");

  if (hasWebsite && normalized.domain) {
    components.push({
      key: "domain_quality",
      label: "Domain quality",
      score: 1,
      weight: 1,
      note: `Usable registrable domain: ${normalized.domain}.`,
    });
    signals.add("has_domain");
  } else if (hasWebsite) {
    components.push({
      key: "domain_quality",
      label: "Domain quality",
      score: 0.4,
      weight: 1,
      note: "Website URL present but no clean domain could be derived.",
    });
  }

  const hasPhone = Boolean(normalized.phoneE164 ?? normalized.phone);
  components.push({
    key: "phone_presence",
    label: "Phone present",
    score: hasPhone ? 1 : 0,
    weight: 1,
    note: hasPhone ? "Source lists a phone number." : "No phone number recorded.",
  });
  if (hasPhone) signals.add("has_phone");

  const hasStreetAddress = Boolean(normalized.addressLine1 || normalized.postalCode);
  components.push({
    key: "address_completeness",
    label: "Street address present",
    score: hasStreetAddress ? 1 : 0,
    weight: 1,
    note: hasStreetAddress ? "Street-level address recorded." : "No street-level address.",
  });
  if (hasStreetAddress) signals.add("has_address");

  const hasLocation =
    Boolean(normalized.city || normalized.region) ||
    (normalized.latitude !== null && normalized.longitude !== null);
  components.push({
    key: "location_completeness",
    label: "Location present",
    score: hasLocation ? 1 : 0,
    weight: 1,
    note: hasLocation ? "City, region or coordinates recorded." : "No location context.",
  });
  if (hasLocation) signals.add("has_location");

  const confidence = sourceConfidence(options.provider ?? "unknown");
  components.push({
    key: "source_confidence",
    label: "Source confidence",
    score: confidence,
    weight: 2,
    note: `Trusted source weight for ${options.provider ?? "unknown"}.`,
  });

  let freshness = 0.5;
  if (options.retrievedAt) {
    const ageDays = (Date.now() - new Date(options.retrievedAt).getTime()) / 86_400_000;
    if (Number.isFinite(ageDays)) freshness = clamp01(1 - ageDays / 90);
  }
  const freshnessNote =
    options.retrievedAt == null
      ? "No retrieval timestamp — half freshness assumed."
      : freshness >= 0.9
        ? "Record retrieved recently."
        : "Record is older; freshness decays over 90 days.";
  components.push({
    key: "freshness",
    label: "Freshness",
    score: freshness,
    weight: 1,
    note: freshnessNote,
  });
  if (freshness >= 0.75) signals.add("fresh");

  const verticalFit = normalized.vertical !== "other" ? 1 : 0.25;
  components.push({
    key: "category_fit",
    label: "Category / vertical fit",
    score: verticalFit,
    weight: 1,
    note:
      normalized.vertical === "other"
        ? "Vertical could not be inferred from source categories."
        : `Vertical classified as ${normalized.vertical}.`,
  });
  if (normalized.vertical !== "other") signals.add(`vertical:${normalized.vertical}`);

  if (options.verticalHintMatched) signals.add("vertical_hint_matched");

  // Digital-gap opportunity: a legitimate business with no web presence is a
  // prime acquisition target (the platform builds them a site). Apply only when
  // the rest of the identity is populated, so we never reward blank records.
  if (!hasWebsite && nameScore && (hasPhone || hasStreetAddress)) {
    components.push({
      key: "digital_gap",
      label: "Digital-gap opportunity",
      score: 1,
      weight: 1,
      note: "No website but otherwise identifiable — likely a build opportunity.",
    });
    signals.add("digital_gap");
  } else if (hasWebsite) {
    components.push({
      key: "digital_gap",
      label: "Digital-gap opportunity",
      score: 0,
      weight: 1,
      note: "Website already present.",
    });
  }

  const duplicate = clamp01(options.duplicateConfidence ?? 1);
  components.push({
    key: "duplicate_confidence",
    label: "Distinct-record confidence",
    score: duplicate,
    weight: 1,
    note:
      duplicate >= 0.9
        ? "No conflicting duplicate detected."
        : "Candidate overlaps with another record and lost the dedupe.",
  });
  if (duplicate < 0.9) signals.add("duplicate");

  const totalWeight = components.reduce((sum, component) => sum + component.weight, 0);
  const weighted = components.reduce(
    (sum, component) => sum + component.score * component.weight,
    0,
  );
  const score = Math.round(clamp01(weighted / totalWeight) * 100 * 10) / 10;

  return {
    score,
    components,
    signals: [...signals].sort(),
  };
}

/** Provider label used across the console (safe default for unknown ids). */
export function providerLabel(provider: string): string {
  return DISCOVERY_SOURCES.find((source) => source.provider === provider)?.label ?? provider;
}
