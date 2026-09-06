import { useServerFn } from "@tanstack/react-start";
import { Pencil } from "lucide-react";
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
import { updateMerchantIdentityFn } from "@/lib/api/console.functions";

const VERTICALS = [
  { value: "restaurant", label: "Restaurant" },
  { value: "home_service", label: "Home service" },
  { value: "beauty", label: "Beauty" },
  { value: "pet_service", label: "Pet service" },
  { value: "automotive", label: "Automotive" },
  { value: "local_retail", label: "Local retail" },
  { value: "other", label: "Other" },
] as const;

const STATUSES = [
  { value: "prospect", label: "Prospect" },
  { value: "onboarding", label: "Onboarding" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
] as const;

const NO_CATEGORY = "__none__";

export type IdentityMerchant = {
  id: string;
  name: string;
  slug: string;
  vertical: string;
  status: string;
  tagline: string | null;
  description: string | null;
  brand_color: string | null;
  logo_url: string | null;
  primary_category_id: string | null;
};

export function EditIdentityDialog({
  merchant,
  categories,
  onSaved,
}: {
  merchant: IdentityMerchant;
  categories: { id: string; name: string }[];
  onSaved: () => void | Promise<void>;
}) {
  const save = useServerFn(updateMerchantIdentityFn);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(merchant.status);
  const [vertical, setVertical] = useState(merchant.vertical);
  const [categoryId, setCategoryId] = useState(merchant.primary_category_id ?? NO_CATEGORY);
  const [name, setName] = useState(merchant.name);
  const [slug, setSlug] = useState(merchant.slug);
  const [tagline, setTagline] = useState(merchant.tagline ?? "");
  const [description, setDescription] = useState(merchant.description ?? "");
  const [brandColor, setBrandColor] = useState(merchant.brand_color ?? "");
  const [logoUrl, setLogoUrl] = useState(merchant.logo_url ?? "");

  function reset() {
    setError(null);
    setStatus(merchant.status);
    setVertical(merchant.vertical);
    setCategoryId(merchant.primary_category_id ?? NO_CATEGORY);
    setName(merchant.name);
    setSlug(merchant.slug);
    setTagline(merchant.tagline ?? "");
    setDescription(merchant.description ?? "");
    setBrandColor(merchant.brand_color ?? "");
    setLogoUrl(merchant.logo_url ?? "");
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset();
  }

  async function submit() {
    setError(null);
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim().toLowerCase();
    if (trimmedName.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug)) {
      setError("Slug must use lowercase letters, numbers and single hyphens.");
      return;
    }
    setSaving(true);
    try {
      await save({
        data: {
          merchantId: merchant.id,
          name: trimmedName,
          slug: trimmedSlug,
          vertical: vertical as (typeof VERTICALS)[number]["value"],
          status: status as (typeof STATUSES)[number]["value"],
          tagline,
          description,
          brand_color: brandColor,
          logo_url: logoUrl,
          primary_category_id: categoryId === NO_CATEGORY ? "" : categoryId,
        },
      });
      await onSaved();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="size-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit identity</DialogTitle>
          <DialogDescription>
            Canonical merchant fields. Saving records a merchant.updated event.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="merchant-name">Name</Label>
            <Input
              id="merchant-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="merchant-slug">Slug</Label>
            <Input
              id="merchant-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Vertical</Label>
              <Select value={vertical} onValueChange={setVertical}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VERTICALS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Primary category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="No category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="merchant-tagline">Tagline</Label>
            <Input
              id="merchant-tagline"
              value={tagline}
              onChange={(event) => setTagline(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="merchant-description">Description</Label>
            <Textarea
              id="merchant-description"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="merchant-brand-color">Brand color</Label>
              <Input
                id="merchant-brand-color"
                placeholder="#1F6FEB"
                value={brandColor}
                onChange={(event) => setBrandColor(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="merchant-logo-url">Logo URL</Label>
              <Input
                id="merchant-logo-url"
                placeholder="https://…"
                value={logoUrl}
                onChange={(event) => setLogoUrl(event.target.value)}
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
