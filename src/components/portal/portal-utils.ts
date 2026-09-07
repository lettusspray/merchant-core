export const VERTICAL_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  home_service: "Home service",
  beauty: "Beauty",
  pet_service: "Pet service",
  automotive: "Automotive",
  local_retail: "Local retail",
  other: "Other",
};

export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatMoney(cents: number | null): string | null {
  if (cents == null) return null;
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function formatTime(value: string | null): string | null {
  if (!value) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (hour == null || Number.isNaN(hour) || minute == null || Number.isNaN(minute)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function priceToCents(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}
