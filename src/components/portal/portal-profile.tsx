import { Check } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { portalUpdateProfileFn } from "@/lib/api/portal.functions";
import { usePortal } from "./portal-context";

export function PortalProfilePage() {
  const { data, refresh } = usePortal();
  const merchant = data.merchants[0]!;
  const base = merchant?.merchant;
  const [name, setName] = useState(base?.name ?? "");
  const [tagline, setTagline] = useState(base?.tagline ?? "");
  const [description, setDescription] = useState(base?.description ?? "");
  const [logoUrl, setLogoUrl] = useState(base?.logo_url ?? "");
  const [brandColor, setBrandColor] = useState(base?.brand_color ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!merchant || !base) return null;

  function openFilePrompt() {
    inputRef.current?.click();
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLogoUrl(url);
    setError("Uploaded locally for preview — your operator can store it permanently.");
  }

  async function submit() {
    const storeId = merchant.merchant.id;
    setError(null);
    setSaving(true);
    try {
      await portalUpdateProfileFn({
        data: {
          merchantId: storeId,
          name: name.trim(),
          tagline: tagline.trim() || null,
          description: description.trim() || null,
          logo_url: logoUrl.trim() || null,
          brand_color: brandColor.trim() || null,
        },
      });
      await refresh();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Store details</CardTitle>
        <CardDescription>
          These appear at the top of your public page. Regenerate (and publish) to apply changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="portal-name">Store name</Label>
          <Input id="portal-name" value={name} onChange={(event) => setName(event.target.value)} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="portal-tagline">Tagline</Label>
          <Input
            id="portal-tagline"
            placeholder="One short line about your store"
            value={tagline}
            onChange={(event) => setTagline(event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="portal-description">Description</Label>
          <Textarea
            id="portal-description"
            rows={4}
            placeholder="What should visitors know about you?"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="portal-brand-color">Brand color</Label>
          <Input
            id="portal-brand-color"
            placeholder="#1F6FEB"
            value={brandColor}
            onChange={(event) => setBrandColor(event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label>Logo URL</Label>
          <div className="flex items-center gap-2">
            <Input
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              placeholder="https://…"
            />
            <Button type="button" variant="outline" onClick={openFilePrompt}>
              Upload
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onFile(e)}
            />
          </div>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Store logo"
              className="mt-1 h-16 w-16 rounded-md border object-cover"
            />
          ) : null}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex items-center gap-2">
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {saved ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <Check className="size-3.5" /> Saved
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
