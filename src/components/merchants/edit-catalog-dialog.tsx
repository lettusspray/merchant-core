import { useServerFn } from "@tanstack/react-start";
import { Package, Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { upsertCatalogItemFn } from "@/lib/api/console.functions";

const PUBLISH_STATE_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
] as const;

export type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  state: string;
  sku?: string | null;
  currency?: string;
  duration_minutes?: number | null;
};

export function EditCatalogDialog({
  merchantId,
  kind,
  item,
  onSaved,
}: {
  merchantId: string;
  kind: "product" | "service";
  /** Pass an existing item to edit it; omit to add a new one. */
  item?: CatalogItem;
  onSaved: () => void | Promise<void>;
}) {
  const save = useServerFn(upsertCatalogItemFn);
  const editing = Boolean(item);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(item?.name ?? "");
  const [sku, setSku] = useState(item?.sku ?? "");
  const [currency, setCurrency] = useState(item?.currency ?? "usd");
  const [description, setDescription] = useState(item?.description ?? "");
  const [priceInput, setPriceInput] = useState(
    item?.price_cents != null ? String(item.price_cents / 100) : "",
  );
  const [durationInput, setDurationInput] = useState(
    item?.duration_minutes != null ? String(item.duration_minutes) : "",
  );
  const [state, setState] = useState(item?.state ?? "draft");

  function reset() {
    setError(null);
    setName(item?.name ?? "");
    setSku(item?.sku ?? "");
    setCurrency(item?.currency ?? "usd");
    setDescription(item?.description ?? "");
    setPriceInput(item?.price_cents != null ? String(item.price_cents / 100) : "");
    setDurationInput(item?.duration_minutes != null ? String(item.duration_minutes) : "");
    setState(item?.state ?? "draft");
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset();
  }

  async function submit() {
    setError(null);
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    const parsedPrice = priceInput.trim() === "" ? null : Number(priceInput);
    if (parsedPrice !== null && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      setError("Price must be a positive number.");
      return;
    }
    const parsedDuration =
      kind === "service" && durationInput.trim() !== "" ? Number(durationInput) : null;
    if (
      kind === "service" &&
      parsedDuration !== null &&
      (!Number.isInteger(parsedDuration) || parsedDuration < 0)
    ) {
      setError("Duration must be a whole number of minutes.");
      return;
    }

    const priceCents = parsedPrice === null ? null : Math.round(parsedPrice * 100);

    setSaving(true);
    try {
      const base = {
        merchantId,
        ...(editing && item ? { itemId: item.id } : {}),
        name: trimmedName,
        description: description.trim() || null,
        price_cents: priceCents,
        state: state as "draft" | "published" | "archived",
      };
      await save({
        data:
          kind === "product"
            ? {
                ...base,
                kind: "product",
                sku: sku.trim() || null,
                currency: currency.trim() || "usd",
              }
            : { ...base, kind: "service", duration_minutes: parsedDuration },
      });
      await onSaved();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save item.");
    } finally {
      setSaving(false);
    }
  }

  const title = editing
    ? kind === "product"
      ? "Edit product"
      : "Edit service"
    : kind === "product"
      ? "Add product"
      : "Add service";

  const trigger = editing ? (
    <Button size="sm" variant="ghost" className="size-8 p-0">
      <Pencil className="size-3.5" />
      <span className="sr-only">Edit</span>
    </Button>
  ) : (
    <Button size="sm" variant="outline">
      <Plus className="size-3.5" />
      {kind === "product" ? "Add product" : "Add service"}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-4" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Canonical catalog entry. Saving records a merchant.{kind} event.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="item-name">Name</Label>
            <Input id="item-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>

          {kind === "product" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="item-sku">SKU</Label>
                <Input id="item-sku" value={sku} onChange={(event) => setSku(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="item-currency">Currency</Label>
                <Input
                  id="item-currency"
                  placeholder="usd"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="item-description">Description</Label>
            <Textarea
              id="item-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="item-price">Price (USD)</Label>
              <Input
                id="item-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={priceInput}
                onChange={(event) => setPriceInput(event.target.value)}
              />
            </div>
            {kind === "service" ? (
              <div className="grid gap-2">
                <Label htmlFor="item-duration">Duration (minutes)</Label>
                <Input
                  id="item-duration"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="30"
                  value={durationInput}
                  onChange={(event) => setDurationInput(event.target.value)}
                />
              </div>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label>State</Label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PUBLISH_STATE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <FooterButtons
            saving={saving}
            onCancel={() => setOpen(false)}
            onSave={() => void submit()}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FooterButtons({
  saving,
  onCancel,
  onSave,
}: {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <>
      <Button variant="ghost" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      <Button onClick={onSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
    </>
  );
}
