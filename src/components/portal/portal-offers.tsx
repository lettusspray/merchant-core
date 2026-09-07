import { Plus, Tag, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { portalDeleteOfferFn, portalUpsertOfferFn } from "@/lib/api/portal.functions";
import { usePortal, type PortalMerchant } from "./portal-context";

type OfferForm = {
  id: string | null;
  title: string;
  description: string;
  discount_label: string;
  starts_at: string;
  ends_at: string;
  state: "published" | "draft";
};

function toDateInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function offerToForm(item: PortalMerchant["offers"][number]): OfferForm {
  return {
    id: item.id,
    title: item.title,
    description: item.description ?? "",
    discount_label: item.discount_label ?? "",
    starts_at: toDateInput(item.starts_at),
    ends_at: toDateInput(item.ends_at),
    state: item.state === "published" ? "published" : "draft",
  };
}

export function PortalOffersPage() {
  const { data, refresh } = usePortal();
  const merchant = data.merchants[0]!;
  const [editing, setEditing] = useState<OfferForm | null>(null);
  const [busy, setBusy] = useState(false);

  if (!merchant) return null;

  async function remove(offer: PortalMerchant["offers"][number]) {
    setBusy(true);
    try {
      await portalDeleteOfferFn({ data: { merchantId: merchant.merchant.id, offerId: offer.id } });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Offers</h1>
          <p className="text-sm text-muted-foreground">
            Deals and discounts. Published offers appear on your site after you regenerate.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() =>
            setEditing({
              id: null,
              title: "",
              description: "",
              discount_label: "",
              starts_at: "",
              ends_at: "",
              state: "published",
            })
          }
          disabled={busy || editing !== null}
        >
          <Plus className="size-4" /> Add offer
        </Button>
      </div>

      {editing ? (
        <OfferEditor
          merchant={merchant}
          form={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      ) : null}

      {merchant.offers.length === 0 && !editing ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Tag className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No offers yet. Add your first one.</p>
          </CardContent>
        </Card>
      ) : (
        merchant.offers.map((offer) => (
          <Card key={offer.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="min-w-0 space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="truncate">{offer.title}</span>
                  <Badge variant={offer.state === "published" ? "default" : "secondary"}>
                    {offer.state}
                  </Badge>
                </CardTitle>
                {offer.discount_label ? (
                  <p className="text-sm text-muted-foreground">{offer.discount_label}</p>
                ) : null}
                {offer.ends_at ? (
                  <p className="text-xs text-muted-foreground">
                    Ends {toDateInput(offer.ends_at) || offer.ends_at}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(offerToForm(offer))}
                  disabled={busy}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void remove(offer)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))
      )}
    </div>
  );
}

function OfferEditor({
  merchant,
  form,
  onCancel,
  onSaved,
}: {
  merchant: PortalMerchant;
  form: OfferForm;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, setState] = useState(form);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    if (!state.title.trim()) {
      setError("Give the offer a title.");
      return;
    }
    setSaving(true);
    try {
      await portalUpsertOfferFn({
        data: {
          merchantId: merchant.merchant.id,
          offerId: state.id,
          title: state.title.trim(),
          description: state.description.trim() || null,
          discount_label: state.discount_label.trim() || null,
          starts_at: toIso(state.starts_at),
          ends_at: toIso(state.ends_at),
          state: state.state,
        },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this offer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{state.id ? "Edit offer" : "New offer"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Title</Label>
            <Input
              value={state.title}
              onChange={(e) => setState({ ...state, title: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Discount label (e.g. 20% off)</Label>
            <Input
              value={state.discount_label}
              onChange={(e) => setState({ ...state, discount_label: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Description</Label>
          <Textarea
            rows={3}
            value={state.description}
            onChange={(e) => setState({ ...state, description: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label>Starts</Label>
            <Input
              type="date"
              value={state.starts_at}
              onChange={(e) => setState({ ...state, starts_at: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Ends</Label>
            <Input
              type="date"
              value={state.ends_at}
              onChange={(e) => setState({ ...state, ends_at: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={state.state}
              onValueChange={(value) => setState({ ...state, state: value as OfferForm["state"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex items-center gap-2">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
