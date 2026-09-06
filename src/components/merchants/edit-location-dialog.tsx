import { useServerFn } from "@tanstack/react-start";
import { MapPin, Pencil, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertLocationFn } from "@/lib/api/console.functions";

export type LocationFormLocation = {
  id: string;
  label: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  is_primary: boolean;
};

export function EditLocationDialog({
  merchantId,
  location,
  onSaved,
}: {
  merchantId: string;
  /** Pass an existing location to edit it; omit to add a new location. */
  location?: LocationFormLocation;
  onSaved: () => void | Promise<void>;
}) {
  const save = useServerFn(upsertLocationFn);
  const editing = Boolean(location);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState(location?.label ?? "");
  const [addressLine1, setAddressLine1] = useState(location?.address_line1 ?? "");
  const [addressLine2, setAddressLine2] = useState(location?.address_line2 ?? "");
  const [city, setCity] = useState(location?.city ?? "");
  const [region, setRegion] = useState(location?.region ?? "");
  const [postalCode, setPostalCode] = useState(location?.postal_code ?? "");
  const [country, setCountry] = useState(location?.country ?? "");
  const [phone, setPhone] = useState(location?.phone ?? "");
  const [isPrimary, setIsPrimary] = useState(location?.is_primary ?? true);

  function reset() {
    setError(null);
    setLabel(location?.label ?? "");
    setAddressLine1(location?.address_line1 ?? "");
    setAddressLine2(location?.address_line2 ?? "");
    setCity(location?.city ?? "");
    setRegion(location?.region ?? "");
    setPostalCode(location?.postal_code ?? "");
    setCountry(location?.country ?? "");
    setPhone(location?.phone ?? "");
    setIsPrimary(location?.is_primary ?? true);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset();
  }

  async function submit() {
    setError(null);
    const trimmedLabel = label.trim();
    if (trimmedLabel.length < 2) {
      setError("Label must be at least 2 characters.");
      return;
    }
    setSaving(true);
    try {
      await save({
        data: {
          merchantId,
          ...(location ? { locationId: location.id } : {}),
          label: trimmedLabel,
          address_line1: addressLine1.trim() || null,
          address_line2: addressLine2.trim() || null,
          city: city.trim() || null,
          region: region.trim() || null,
          postal_code: postalCode.trim() || null,
          country: country.trim() || null,
          phone: phone.trim() || null,
          is_primary: isPrimary,
        },
      });
      await onSaved();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save location.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost" className="size-8 p-0">
            <Pencil className="size-3.5" />
            <span className="sr-only">Edit location</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <LocationFormFields
            title="Edit location"
            saving={saving}
            error={error}
            onCancel={() => setOpen(false)}
            onSave={() => void submit()}
          >
            <LocationInputs
              label={label}
              setLabel={setLabel}
              addressLine1={addressLine1}
              setAddressLine1={setAddressLine1}
              addressLine2={addressLine2}
              setAddressLine2={setAddressLine2}
              city={city}
              setCity={setCity}
              region={region}
              setRegion={setRegion}
              postalCode={postalCode}
              setPostalCode={setPostalCode}
              country={country}
              setCountry={setCountry}
              phone={phone}
              setPhone={setPhone}
              isPrimary={isPrimary}
              setIsPrimary={setIsPrimary}
            />
          </LocationFormFields>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-3.5" />
          Add location
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <LocationFormFields
          title="Add location"
          saving={saving}
          error={error}
          onCancel={() => setOpen(false)}
          onSave={() => void submit()}
        >
          <LocationInputs
            label={label}
            setLabel={setLabel}
            addressLine1={addressLine1}
            setAddressLine1={setAddressLine1}
            addressLine2={addressLine2}
            setAddressLine2={setAddressLine2}
            city={city}
            setCity={setCity}
            region={region}
            setRegion={setRegion}
            postalCode={postalCode}
            setPostalCode={setPostalCode}
            country={country}
            setCountry={setCountry}
            phone={phone}
            setPhone={setPhone}
            isPrimary={isPrimary}
            setIsPrimary={setIsPrimary}
          />
        </LocationFormFields>
      </DialogContent>
    </Dialog>
  );
}

function LocationFormFields({
  title,
  saving,
  error,
  onCancel,
  onSave,
  children,
}: {
  title: string;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <MapPin className="size-4" />
          {title}
        </DialogTitle>
        <DialogDescription>
          Canonical merchant location. Saving records a merchant.location event.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">{children}</div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save location"}
        </Button>
      </DialogFooter>
    </>
  );
}

function LocationInputs({
  label,
  setLabel,
  addressLine1,
  setAddressLine1,
  addressLine2,
  setAddressLine2,
  city,
  setCity,
  region,
  setRegion,
  postalCode,
  setPostalCode,
  country,
  setCountry,
  phone,
  setPhone,
  isPrimary,
  setIsPrimary,
}: {
  label: string;
  setLabel: (value: string) => void;
  addressLine1: string;
  setAddressLine1: (value: string) => void;
  addressLine2: string;
  setAddressLine2: (value: string) => void;
  city: string;
  setCity: (value: string) => void;
  region: string;
  setRegion: (value: string) => void;
  postalCode: string;
  setPostalCode: (value: string) => void;
  country: string;
  setCountry: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  isPrimary: boolean;
  setIsPrimary: (value: boolean) => void;
}) {
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor="location-label">Label</Label>
        <Input
          id="location-label"
          placeholder="Main branch"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="location-address-1">Address line 1</Label>
        <Input
          id="location-address-1"
          value={addressLine1}
          onChange={(event) => setAddressLine1(event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="location-address-2">Address line 2</Label>
        <Input
          id="location-address-2"
          value={addressLine2}
          onChange={(event) => setAddressLine2(event.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="location-city">City</Label>
          <Input
            id="location-city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="location-region">Region</Label>
          <Input
            id="location-region"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="location-postal">Postal code</Label>
          <Input
            id="location-postal"
            value={postalCode}
            onChange={(event) => setPostalCode(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="location-country">Country</Label>
          <Input
            id="location-country"
            placeholder="US"
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="location-phone">Phone</Label>
        <Input
          id="location-phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="location-primary"
          checked={isPrimary}
          onCheckedChange={(checked) => setIsPrimary(checked === true)}
        />
        <Label htmlFor="location-primary" className="text-sm font-normal">
          Make this the primary location
        </Label>
      </div>
    </>
  );
}
