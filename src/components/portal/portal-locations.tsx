import { MapPin, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { portalDeleteLocationFn, portalSaveLocationFn } from "@/lib/api/portal.functions";
import { usePortal, type PortalMerchant } from "./portal-context";
import { DAY_LABELS, formatTime } from "./portal-utils";

type HourRow = {
  day: number;
  opens: string;
  closes: string;
  closed: boolean;
};

type FormState = {
  id: string | null;
  label: string;
  address_line1: string;
  address_line2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  phone: string;
  is_primary: boolean;
  hours: HourRow[];
};

const EMPTY_FORM: FormState = {
  id: null,
  label: "",
  address_line1: "",
  address_line2: "",
  city: "",
  region: "",
  postal_code: "",
  country: "",
  phone: "",
  is_primary: false,
  hours: DAY_LABELS.map((_, day) => ({ day, opens: "09:00", closes: "17:00", closed: false })),
};

function toFormSite(
  location: PortalMerchant["locations"][number],
  hours: PortalMerchant["hours"],
): FormState {
  const rows = DAY_LABELS.map((_, day) => {
    const entry = hours.find(
      (hour) => hour.location_id === location.id && hour.day_of_week === day,
    );
    return {
      day,
      opens: entry?.opens_at ? entry.opens_at.slice(0, 5) : "09:00",
      closes: entry?.closes_at ? entry.closes_at.slice(0, 5) : "17:00",
      closed: entry ? entry.is_closed : true,
    };
  });
  return {
    id: location.id,
    label: location.label ?? "",
    address_line1: location.address_line1 ?? "",
    address_line2: location.address_line2 ?? "",
    city: location.city ?? "",
    region: location.region ?? "",
    postal_code: location.postal_code ?? "",
    country: location.country ?? "",
    phone: location.phone ?? "",
    is_primary: location.is_primary,
    hours: rows,
  };
}

function LocationEditor({
  merchant,
  form,
  busy,
  onCancel,
  onSaved,
}: {
  merchant: PortalMerchant;
  form: FormState;
  busy: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, setState] = useState(form);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setHours(day: number, patch: Partial<HourRow>) {
    setState((prev) => ({
      ...prev,
      hours: prev.hours.map((hour) => (hour.day === day ? { ...hour, ...patch } : hour)),
    }));
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await portalSaveLocationFn({
        data: {
          merchantId: merchant.merchant.id,
          locationId: state.id,
          label: state.label.trim() || "Main location",
          address_line1: state.address_line1 || null,
          address_line2: state.address_line2 || null,
          city: state.city || null,
          region: state.region || null,
          postal_code: state.postal_code || null,
          country: state.country || null,
          phone: state.phone || null,
          is_primary: state.is_primary,
          hours: state.hours.map((hour) => ({
            day_of_week: hour.day,
            opens_at: hour.closed ? null : `${hour.opens || "09:00"}:00`,
            closes_at: hour.closed ? null : `${hour.closes || "17:00"}:00`,
            is_closed: hour.closed,
          })),
        },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this location.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{state.id ? "Edit location" : "New location"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input
              value={state.label}
              onChange={(e) => setState({ ...state, label: e.target.value })}
            />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <input
              id="primary-toggle"
              type="checkbox"
              checked={state.is_primary}
              onChange={(e) => setState({ ...state, is_primary: e.target.checked })}
              className="size-4"
            />
            <Label htmlFor="primary-toggle">Primary location</Label>
          </div>
          <div className="grid gap-2">
            <Label>Address line 1</Label>
            <Input
              value={state.address_line1}
              onChange={(e) => setState({ ...state, address_line1: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Address line 2</Label>
            <Input
              value={state.address_line2}
              onChange={(e) => setState({ ...state, address_line2: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>City</Label>
            <Input
              value={state.city}
              onChange={(e) => setState({ ...state, city: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>State / region</Label>
            <Input
              value={state.region}
              onChange={(e) => setState({ ...state, region: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Postal code</Label>
            <Input
              value={state.postal_code}
              onChange={(e) => setState({ ...state, postal_code: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Country</Label>
            <Input
              value={state.country}
              onChange={(e) => setState({ ...state, country: e.target.value })}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label>Phone</Label>
            <Input
              value={state.phone}
              onChange={(e) => setState({ ...state, phone: e.target.value })}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Business hours</p>
          <div className="divide-y rounded-md border">
            {state.hours.map((hour) => (
              <div key={hour.day} className="flex items-center gap-3 px-3 py-2">
                <span className="w-28 shrink-0 text-sm">{DAY_LABELS[hour.day]}</span>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Checkbox
                    checked={hour.closed}
                    onCheckedChange={(v) => setHours(hour.day, { closed: !!v })}
                  />
                  Closed
                </label>
                <Input
                  type="time"
                  disabled={hour.closed}
                  value={hour.opens}
                  onChange={(e) => setHours(hour.day, { opens: e.target.value })}
                  className="h-8 w-28"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="time"
                  disabled={hour.closed}
                  value={hour.closes}
                  onChange={(e) => setHours(hour.day, { closes: e.target.value })}
                  className="h-8 w-28"
                />
              </div>
            ))}
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex items-center gap-2">
          <Button onClick={() => void save()} disabled={saving || busy}>
            {saving ? "Saving…" : "Save location"}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PortalLocationsPage() {
  const { data, refresh } = usePortal();
  const merchant = data.merchants[0]!;
  const [editing, setEditing] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);

  if (!merchant) return null;

  async function remove(location: PortalMerchant["locations"][number]) {
    setBusy(true);
    try {
      await portalDeleteLocationFn({
        data: { merchantId: merchant.merchant.id, locationId: location.id },
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Locations & hours</h1>
          <p className="text-sm text-muted-foreground">
            Where customers find you, and when you open. Regenerate the site after changes.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setEditing({ ...EMPTY_FORM })}
          disabled={busy || editing !== null}
        >
          <Plus className="size-4" /> Add location
        </Button>
      </div>

      {editing ? (
        <LocationEditor
          merchant={merchant}
          form={editing}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      ) : null}

      {merchant.locations.length === 0 && !editing ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <MapPin className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No locations yet. Add your first one.</p>
          </CardContent>
        </Card>
      ) : (
        merchant.locations.map((location) => {
          const hours = merchant.hours.filter((hour) => hour.location_id === location.id);
          return (
            <Card key={location.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-base">
                    {location.label ?? "Location"}
                    {location.is_primary ? <Badge className="ml-2">Primary</Badge> : null}
                  </CardTitle>
                  <CardDescription>
                    {[location.address_line1, location.city, location.region, location.postal_code]
                      .filter(Boolean)
                      .join(", ") || "No address"}
                  </CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(toFormSite(location, hours))}
                    disabled={busy}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => void remove(location)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-1 sm:grid-cols-2">
                {DAY_LABELS.map((day, index) => {
                  const entry = hours.find((hour) => hour.day_of_week === index);
                  return (
                    <div
                      key={day}
                      className="flex justify-between border-b py-1 text-sm last:border-b-0"
                    >
                      <span className="text-muted-foreground">{day}</span>
                      <span>
                        {entry && !entry.is_closed
                          ? `${formatTime(entry.opens_at) ?? "—"} – ${formatTime(entry.closes_at) ?? "—"}`
                          : "Closed"}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
