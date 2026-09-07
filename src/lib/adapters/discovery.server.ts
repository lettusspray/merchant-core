/**
 * Discovery adapters (server-only).
 *
 * Every adapter returns provider-native `SourceBusinessRecord`s. Normalization
 * and scoring happen later in the pipeline so candidates stay traceable to raw
 * source payloads.
 *
 * Sources:
 *  - `openstreetmap`  — real, keyless, via the public Overpass API.
 *  - `google-places`  — real, needs GOOGLE_PLACES_API_KEY; reports a truthful
 *                       "not configured" state (and throws) when the key is absent.
 *  - `local-demo`     — explicit deterministic demo directory, never external.
 *  - `website-probe`  — always-available enrichment; not a search source.
 */
import type { AdapterStatus, DiscoveryAdapter } from "./contracts";
import { GOOGLE_PLACES_ENV, readEnv } from "@/lib/config.server";
import { httpJson, newCorrelationId } from "./http.server";
import type { SourceBusinessRecord } from "@/lib/discovery/normalize";
import { slugify } from "@/lib/discovery/normalize";
import { ProviderNotConfiguredError } from "./contracts";

function now() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Google Places adapter
// ---------------------------------------------------------------------------

type GooglePlaceComponent = { longText?: string; shortText?: string; types?: string[] };
type GooglePlace = {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  addressComponents?: GooglePlaceComponent[];
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  priceLevel?: string;
};

type GooglePlacesSearchResponse = {
  places?: GooglePlace[];
  nextPageToken?: string;
};

function componentByType(
  components: GooglePlaceComponent[] | undefined,
  kind: string,
): string | null {
  if (!components) return null;
  const found = components.find((component) => (component.types ?? []).includes(kind));
  return found?.longText ?? found?.shortText ?? null;
}

function googlePlaceToRecord(place: GooglePlace): SourceBusinessRecord {
  const addressLine1 = place.formattedAddress ?? null;
  return {
    externalId:
      place.id ?? addressLine1 ?? `place-${slugify(place.displayName?.text ?? "unknown")}`,
    name: place.displayName?.text ?? "Unknown",
    categories: place.types ?? [],
    addressLine1,
    city: componentByType(place.addressComponents, "locality"),
    region: componentByType(place.addressComponents, "administrative_area_level_1"),
    postalCode: componentByType(place.addressComponents, "postal_code"),
    country: componentByType(place.addressComponents, "country"),
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    phone: place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? null,
    website: place.websiteUri ?? null,
    hours: null,
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? null,
    sourceUrl: null,
    sourceObservedAt: null,
    retrievedAt: now(),
    raw: {
      id: place.id,
      displayName: place.displayName,
      formattedAddress: place.formattedAddress,
      addressComponents: place.addressComponents,
      businessStatus: place.businessStatus,
      priceLevel: place.priceLevel,
      types: place.types,
    },
  };
}

function googlePlacesAdapter(apiKey: string | undefined): DiscoveryAdapter {
  const configured = Boolean(apiKey);
  return {
    provider: "google-places",
    status(): AdapterStatus {
      return configured
        ? {
            provider: "google-places",
            category: "discovery",
            mode: "live",
            configured: true,
            detail: "Connected to Google Places Text Search.",
          }
        : {
            provider: "google-places",
            category: "discovery",
            mode: "live",
            configured: false,
            detail:
              "Not configured — set GOOGLE_PLACES_API_KEY in project secrets. No Google results were fetched.",
          };
    },
    async search({ query, vertical, city, limit = 20 }): Promise<SourceBusinessRecord[]> {
      if (!apiKey) {
        throw new ProviderNotConfiguredError("google-places");
      }
      const correlationId = newCorrelationId("disc");
      const textQuery =
        city && !query.toLowerCase().includes(city.toLowerCase()) ? `${query} in ${city}` : query;

      const fieldMask = [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.addressComponents",
        "places.internationalPhoneNumber",
        "places.nationalPhoneNumber",
        "places.websiteUri",
        "places.rating",
        "places.userRatingCount",
        "places.businessStatus",
        "places.types",
        "places.priceLevel",
        "places.location",
      ].join(",");

      const body: Record<string, unknown> = {
        textQuery,
        maxResultCount: Math.min(limit, 20),
        ...(vertical ? { includedType: verticalToGoogleType(vertical) } : {}),
      };

      const { data } = await httpJson<GooglePlacesSearchResponse>({
        provider: "google-places",
        url: "https://places.googleapis.com/v1/places:searchText",
        method: "POST",
        correlationId,
        timeoutMs: 15_000,
        retries: 1,
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
        body,
      });

      return (data.places ?? []).map(googlePlaceToRecord);
    },
  };
}

/** Best-effort Google `includedType` from a vertical enum value. */
function verticalToGoogleType(vertical: string): string | undefined {
  switch (vertical) {
    case "restaurant":
      return "restaurant";
    case "beauty":
      return "beauty_salon";
    case "pet_service":
      return "veterinary_care";
    case "automotive":
      return "car_repair";
    case "home_service":
      return "plumber";
    case "local_retail":
      return "store";
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// OpenStreetMap / Overpass adapter (keyless)
// ---------------------------------------------------------------------------

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = { elements?: OverpassElement[] };

/** Unions returned by Overpass for a name regex + optional vertical. */
function overpassUnionBody(query: string, vertical?: string): string {
  const q = query.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const nameFilter = `["name"~"${q}",i]`;
  const v = vertical ?? "";
  switch (v) {
    case "restaurant":
      return `nwr${nameFilter}["amenity"~"restaurant|cafe|bar|pub|fast_food|food_court|ice_cream",i];
    nwr${nameFilter}["shop"~"bakery|cafe|confectionery|deli",i];`;
    case "home_service":
      return `nwr${nameFilter}["craft"~"plumber|electrician|carpenter|hvac|roofer|painter|handyman|cleaning",i];
    nwr${nameFilter}["shop"~"electrical|plumbing|hardware|hvac|cleaning",i];
    nwr${nameFilter}["office"~"contractor",i];`;
    case "beauty":
      return `nwr${nameFilter}["shop"~"hairdresser|beauty|cosmetics|tattoo|nail_salon",i];
    nwr${nameFilter}["amenity"~"barber",i];`;
    case "pet_service":
      return `nwr${nameFilter}["amenity"~"veterinary|animal_boarding",i];
    nwr${nameFilter}["shop"~"pet|pet_grooming",i];`;
    case "automotive":
      return `nwr${nameFilter}["shop"~"car_repair|car|car_parts|tyres|motorcycle",i];
    nwr${nameFilter}["amenity"~"car_wash|fuel",i];`;
    case "local_retail":
      return `nwr${nameFilter}["shop"~"supermarket|convenience|grocery|clothes|boutique|books|furniture|florist|hardware",i];`;
    default:
      return `nwr${nameFilter}["shop"];
    nwr${nameFilter}["amenity"];
    nwr${nameFilter}["craft"];
    nwr${nameFilter}["office"];
    nwr${nameFilter}["tourism"]["name"];
    nwr${nameFilter}["leisure"];`;
  }
}

function overpassQuery(query: string, vertical: string | undefined, bbox: string | null): string {
  const unions = overpassUnionBody(query, vertical);
  return `[out:json][timeout:25];
${bbox ? `[bbox:${bbox}];\n` : ""}(
${unions}
);
out center tags;`;
}

function osmElementToRecord(element: OverpassElement): SourceBusinessRecord | null {
  const tags = element.tags ?? {};
  const name = tags["name"] ?? tags["name:en"];
  if (!name) return null;
  const lat = element.lat ?? element.center?.lat ?? null;
  const lon = element.lon ?? element.center?.lon ?? null;

  const categories: string[] = [];
  for (const key of ["shop", "amenity", "craft", "office", "tourism", "leisure"]) {
    if (tags[key]) categories.push(`${key}:${tags[key]}`);
  }

  const street = tags["addr:street"] ?? null;
  const houseNumber = tags["addr:housenumber"] ?? null;
  const addressLine1 =
    houseNumber && street ? `${houseNumber} ${street}` : (houseNumber ?? street ?? null);

  const website = tags["website"] ?? tags["contact:website"] ?? tags["contact:web"] ?? null;
  const phone = tags["phone"] ?? tags["contact:phone"] ?? tags["contact:mobile"] ?? null;

  return {
    externalId: `${element.type}/${element.id}`,
    name,
    categories,
    addressLine1,
    city: tags["addr:city"] ?? null,
    region: tags["addr:state"] ?? tags["addr:province"] ?? null,
    postalCode: tags["addr:postcode"] ?? null,
    country: tags["addr:country"] ?? null,
    latitude: lat,
    longitude: lon,
    phone,
    website,
    hours: tags["opening_hours"] ?? null,
    rating: null,
    reviewCount: null,
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    sourceObservedAt: null,
    retrievedAt: now(),
    raw: { type: element.type, id: element.id, lat, lon, tags },
  };
}

type NominatimHit = {
  lat?: string;
  lon?: string;
  boundingbox?: string[];
};

async function geocodeLocation(city?: string, region?: string): Promise<{ bbox: string }> {
  const parts = [city, region].filter(Boolean).join(", ");
  if (!parts) {
    throw new Error("A city or region is required to bound an OpenStreetMap search.");
  }
  const correlationId = newCorrelationId("geo");
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(parts)}`;
  const { data } = await httpJson<NominatimHit[]>({
    provider: "nominatim",
    url,
    method: "GET",
    correlationId,
    timeoutMs: 10_000,
    retries: 1,
    headers: {
      "user-agent": "MerchantCore/1.0 (merchant-discovery)",
      "Accept-Language": "en",
    },
  });
  const hit = data[0];
  if (!hit?.boundingbox || hit.boundingbox.length < 4) {
    throw new Error(`Could not geocode "${parts}". Try a more specific location.`);
  }
  const [south, north, west, east] = hit.boundingbox;
  return { bbox: `${south},${west},${north},${east}` };
}

function osmAdapter(): DiscoveryAdapter {
  return {
    provider: "openstreetmap",
    status(): AdapterStatus {
      return {
        provider: "openstreetmap",
        category: "discovery",
        mode: "live",
        configured: true,
        detail: "Keyless. Queries public OpenStreetMap data via the Overpass API.",
      };
    },
    async search({ query, vertical, city, region, limit = 20 }): Promise<SourceBusinessRecord[]> {
      if (!city && !region) {
        throw new Error(
          "OpenStreetMap searches need a city or region to bound the query. Provide a location in the run form.",
        );
      }
      const correlationId = newCorrelationId("osm");
      const { bbox } = await geocodeLocation(city, region);
      const body = overpassQuery(query, vertical, bbox);

      const { data } = await httpJson<OverpassResponse>({
        provider: "openstreetmap",
        url: "https://overpass-api.de/api/interpreter",
        method: "POST",
        correlationId,
        timeoutMs: 30_000,
        retries: 1,
        encoding: "form",
        body: { data: body },
      });

      const records = (data.elements ?? [])
        .map(osmElementToRecord)
        .filter((record): record is SourceBusinessRecord => record !== null)
        .slice(0, Math.max(1, Math.min(limit, 50)));

      return records;
    },
  };
}

// ---------------------------------------------------------------------------
// Website probe adapter (built-in enrichment, always available)
// ---------------------------------------------------------------------------

export type ProbeTiming = {
  responseMs: number;
};

export type WebsiteProbeResult = {
  url: string;
  reachable: boolean;
  statusCode: number | null;
  finalUrl: string | null;
  responseMs: number;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  structuredDataTypes: string[];
  detectedPhone: string | null;
  detectedAddress: string | null;
  detectedPages: string[];
  lang: string | null;
  error: string | null;
};

function extractAttr(html: string, tag: string, attr: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*${attr}\\s*=\\s*(["'])(.*?)\\1`, "i");
  const match = regex.exec(html);
  return match ? decodeEntities(match[2]!).slice(0, 500) : null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}

async function fetchText(
  url: string,
  signal: AbortSignal,
): Promise<{ text: string; finalUrl: string }> {
  const response = await fetch(url, {
    method: "GET",
    signal,
    redirect: "follow",
    headers: { "user-agent": "MerchantCore/1.0 (discovery-probe)" },
  });
  const finalUrl = response.url || url;
  if (!response.ok) {
    throw new Error(`GET failed with status ${response.status}`);
  }
  const text = await response.text();
  if (text.length > 500_000) {
    throw new Error("Page too large to probe");
  }
  return { text, finalUrl };
}

/** Lightweight digital-gap probe: one GET, no crawling. */
export async function probeSite(url: string, timeoutMs = 10_000): Promise<WebsiteProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const { text, finalUrl } = await fetchText(url, controller.signal);
    const responseMs = Date.now() - start;

    const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(text);
    const title = titleMatch ? decodeEntities(titleMatch[1]!).trim().slice(0, 200) : null;

    const metaDescription = extractAttr(text, "meta", "content") ?? null;

    const canonical = extractAttr(text, "link", "href") ?? null;

    const jsonLd =
      text.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
    const structuredDataTypes = [
      ...new Set(jsonLd.map((block) => detectStructuredType(block))),
    ].filter((value): value is string => Boolean(value));

    const telMatches = [...text.matchAll(/tel:([+()\d\s-]{7,})/gi)].map((m) => m[1]!.trim());
    const detectedPhone = telMatches[0] ?? null;

    const detectedAddress = detectAddress(text);
    const detectedPages = detectPagePresence(text);

    const langMatch = /<html[^>]*lang=["']([a-zA-Z-]+)["']/i.exec(text);

    return {
      url,
      reachable: true,
      statusCode: 200,
      finalUrl,
      responseMs,
      title,
      metaDescription,
      canonical,
      structuredDataTypes,
      detectedPhone,
      detectedAddress,
      detectedPages,
      lang: langMatch?.[1] ?? null,
      error: null,
    };
  } catch (err) {
    return {
      url,
      reachable: false,
      statusCode: null,
      finalUrl: null,
      responseMs: Date.now() - start,
      title: null,
      metaDescription: null,
      canonical: null,
      structuredDataTypes: [],
      detectedPhone: null,
      detectedAddress: null,
      detectedPages: [],
      lang: null,
      error: err instanceof Error ? err.message : "Probe failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

function detectStructuredType(block: string): string | null {
  const match = block.match(/"@type"\s*:\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

const PAGE_HINTS: Array<{ key: string; patterns: string[] }> = [
  {
    key: "contact",
    patterns: [">contact", 'href="#contact', "/contact", "contact-us", "get-in-touch"],
  },
  { key: "location", patterns: ["/location", "find-us", "store-locator"] },
  { key: "services", patterns: ["/services", 'services">', "what-we-do"] },
  { key: "product", patterns: ["/products", "/shop", 'shop">', "/menu"] },
  { key: "menu", patterns: ["/menu", 'menu">'] },
  { key: "booking", patterns: ["/booking", "book-a", "/appointment", "book-online"] },
  { key: "about", patterns: ["/about", "about-us", 'about">'] },
];

function detectPagePresence(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const hint of PAGE_HINTS) {
    if (hint.patterns.some((pattern) => lower.includes(pattern))) found.push(hint.key);
  }
  return found;
}

function detectAddress(text: string): string | null {
  const lower = text.slice(0, 50_000);
  const postal = /\b\d{4,5}\b\s+[A-Z][a-zA-Z]+/.exec(lower);
  if (postal) return postal[0] ?? null;
  return null;
}

export function websiteProbeAdapter(): DiscoveryAdapter & {
  probeSite(url: string): Promise<WebsiteProbeResult>;
} {
  const handle: DiscoveryAdapter & { probeSite(url: string): Promise<WebsiteProbeResult> } = {
    provider: "website-probe",
    status(): AdapterStatus {
      return {
        provider: "website-probe",
        category: "discovery",
        mode: "live",
        configured: true,
        detail:
          "Built-in. Performs real reachability and digital-gap checks against candidate URLs.",
      };
    },
    async search(): Promise<SourceBusinessRecord[]> {
      return [];
    },
    probeSite,
  };
  return handle;
}

// ---------------------------------------------------------------------------
// Local / demo adapter (explicit local-demo, deterministic)
// ---------------------------------------------------------------------------

const VERTICAL_DEMO_NAMES: Record<string, string[]> = {
  restaurant: [
    "Harborline Grill",
    "The Gilded Skillet",
    "Marlow's Pasta Bar",
    "Ember & Oak Kitchen",
    "Saffron Street Eatery",
    "Brine & Branch",
  ],
  home_service: [
    "TrueNorth Plumbing",
    "Brightline Electric",
    "Pine & Copper Renovation",
    "Summit Appliance Repair",
    "Cedar Brook Heating",
    "Crestpoint Roofing",
  ],
  beauty: [
    "Lumen Beauty Bar",
    "Copper Fox Salon",
    "Pureform Skin Studio",
    "Mirror & Muse Nails",
    "Vela Hair Collective",
    "Bloom & Tonic Spa",
  ],
  pet_service: [
    "Wagstone Pet Co.",
    "Pawprint Boarding",
    "Fetch & Feather Grooming",
    "Happy Tail Training",
    "Velvet Pup Daycare",
    "Treadwell Mobile Vet",
  ],
  automotive: [
    "Monarch Auto Works",
    "Redline Brake & Tire",
    "Slate City Motors",
    "Hardline Detailing",
    "Cornerstone Lube",
    "Ironworks Garage",
  ],
  local_retail: [
    "Maple & Thread",
    "Harbor Row Supply",
    "Granite Street Market",
    "Blue Door General",
    "Pilion Books & Goods",
    "Anchor & Grain",
  ],
  other: [
    "Westfield Traders",
    "Grandview Services",
    "Fieldstone Studio",
    "Ridgeline Supplies",
    "Marlowe & Co.",
    "Cedar Post Goods",
  ],
};

function seededRand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function demoAdapter(): DiscoveryAdapter {
  return {
    provider: "local-demo",
    status(): AdapterStatus {
      return {
        provider: "local-demo",
        category: "discovery",
        mode: "mock",
        configured: true,
        detail:
          "Local demo directory. No external provider was called — all records are explicitly labelled demo.",
      };
    },
    async search({ query, vertical, city, limit = 20 }): Promise<SourceBusinessRecord[]> {
      const vert = Object.keys(VERTICAL_DEMO_NAMES).includes(vertical ?? "") ? vertical! : "other";
      const pool = VERTICAL_DEMO_NAMES[vert] ?? VERTICAL_DEMO_NAMES["other"]!;
      const rand = seededRand(hashString(`${query}|${city ?? ""}|${vert}`));
      const order = [...pool];
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j]!, order[i]!];
      }

      return order.slice(0, Math.min(limit, order.length)).map((name, index) => {
        const id = `${slugify(name)}-${hashString(`${city ?? ""}|${vert}`).toString(36)}`;
        return {
          externalId: `demo/${id}`,
          name,
          categories: vertical ? [vertical] : ["local business"],
          addressLine1: `${100 + index} Demo Avenue`,
          city: city?.trim() || null,
          region: null,
          postalCode: "99999",
          country: "US",
          latitude: null,
          longitude: null,
          phone: `+1-415-555-01${index.toString().padStart(2, "0")}`,
          website: `https://www.${slugify(name).replace(/-/g, "")}.demo`,
          hours: null,
          rating: null,
          reviewCount: null,
          sourceUrl: null,
          sourceObservedAt: null,
          retrievedAt: now(),
          raw: {
            provider: "local-demo",
            note: "Deterministic demo record — labelled local/demo, not a real business.",
          },
        };
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Returns the adapter for a named provider. Every source is explicit about its
 * configuration state — a Google Places adapter without a key is configured:false
 * and throws `ProviderNotConfiguredError` from `search`.
 */
export function discoveryAdapter(provider: string): DiscoveryAdapter {
  switch (provider) {
    case "openstreetmap":
      return osmAdapter();
    case "google-places":
      return googlePlacesAdapter(readEnv(GOOGLE_PLACES_ENV.apiKey));
    case "local-demo":
      return demoAdapter();
    default:
      throw new Error(`Unknown discovery source: ${provider}`);
  }
}
