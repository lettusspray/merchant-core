/**
 * Discovery source registry (client-safe).
 *
 * One place that describes every source an operator can run discovery against:
 * capabilities the run form should expose, whether the source is an external
 * provider or an explicit local demo, and which credentials (if any) gate it.
 * The server pipeline consumes the same registry so the UI and the backend
 * never disagree about what a source supports.
 */

export type DiscoverySourceCapability = "city" | "region" | "vertical" | "limit";

export type DiscoverySourceMeta = {
  /** Named provider key used by the adapters (`openstreetmap`, `google-places`, `local-demo`). */
  provider: string;
  label: string;
  description: string;
  /** Real external provider vs explicit local/demo data. */
  kind: "external" | "demo";
  /** Env var names an operator must set for this source to go live. Empty = keyless. */
  requires: string[];
  capabilities: DiscoverySourceCapability[];
  /** Whether the adapter can actually return provider-scoped stable external IDs. */
  supportsExternalId: boolean;
  /** Location input is required to bound the source query (e.g. Overpass). */
  requiresLocation?: boolean;
};

export const DISCOVERY_SOURCES: DiscoverySourceMeta[] = [
  {
    provider: "openstreetmap",
    label: "OpenStreetMap (Overpass)",
    description:
      "Real keyless business data from OpenStreetMap via the public Overpass API. Internet access required; rate limits apply. A city or region is required to bound the search.",
    kind: "external",
    requires: [],
    capabilities: ["city", "region", "vertical", "limit"],
    supportsExternalId: true,
    requiresLocation: true,
  },
  {
    provider: "google-places",
    label: "Google Places",
    description:
      "Real business data from Google Places Text Search. Needs a GOOGLE_PLACES_API_KEY to run; without one the source reports not configured.",
    kind: "external",
    requires: ["GOOGLE_PLACES_API_KEY"],
    capabilities: ["city", "vertical", "limit"],
    supportsExternalId: true,
  },
  {
    provider: "local-demo",
    label: "Local demo directory",
    description:
      "Deterministic demo businesses labelled as local/demo. Never dials an external provider — useful for walking the pipeline offline.",
    kind: "demo",
    requires: [],
    capabilities: ["city", "vertical", "limit"],
    supportsExternalId: true,
  },
];

export const DISCOVERY_SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  DISCOVERY_SOURCES.map((source) => [source.provider, source.label]),
);

export const DISCOVERY_SOURCE_KINDS: Record<string, DiscoverySourceMeta["kind"]> =
  Object.fromEntries(DISCOVERY_SOURCES.map((source) => [source.provider, source.kind]));

export function discoverySourceMeta(provider: string): DiscoverySourceMeta | null {
  return DISCOVERY_SOURCES.find((source) => source.provider === provider) ?? null;
}
