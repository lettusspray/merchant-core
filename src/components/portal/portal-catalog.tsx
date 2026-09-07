import { Package, Plus, Trash2, Wrench } from "lucide-react";
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
import { portalDeleteCatalogItemFn, portalUpsertCatalogItemFn } from "@/lib/api/portal.functions";
import { usePortal, type PortalMerchant } from "./portal-context";
import { priceToCents } from "./portal-utils";

type ItemKind = "service" | "product";

type ItemForm = {
  id: string | null;
  name: string;
  description: string;
  price: string;
  state: "published" | "draft";
  sku: string;
  duration: string;
};

function emptyForm(): ItemForm {
  return {
    id: null,
    name: "",
    description: "",
    price: "",
    state: "published",
    sku: "",
    duration: "",
  };
}

function serviceToForm(item: PortalMerchant["services"][number]): ItemForm {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    price: item.price_cents != null ? (item.price_cents / 100).toString() : "",
    state: item.state === "published" ? "published" : "draft",
    sku: "",
    duration: item.duration_minutes != null ? String(item.duration_minutes) : "",
  };
}

function productToForm(item: PortalMerchant["products"][number]): ItemForm {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    price: item.price_cents != null ? (item.price_cents / 100).toString() : "",
    state: item.state === "published" ? "published" : "draft",
    sku: item.sku ?? "",
    duration: "",
  };
}

function CatalogEditor({
  kind,
  merchant,
  form,
  onCancel,
  onSaved,
}: {
  kind: ItemKind;
  merchant: PortalMerchant;
  form: ItemForm;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, setState] = useState(form);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    const name = state.name.trim();
    if (!name) {
      setError("Give it a name.");
      return;
    }
    setSaving(true);
    try {
      await portalUpsertCatalogItemFn({
        data: {
          merchantId: merchant.merchant.id,
          itemId: state.id,
          kind,
          name,
          description: state.description.trim() || null,
          price_cents: priceToCents(state.price),
          state: state.state,
          ...(kind === "product"
            ? { sku: state.sku.trim() || null, currency: "USD" }
            : { duration_minutes: state.duration ? Number(state.duration) : null }),
        },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{state.id ? `Edit ${kind}` : `New ${kind}`}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input
              value={state.name}
              onChange={(e) => setState({ ...state, name: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Price (e.g. 25.00)</Label>
            <Input
              value={state.price}
              placeholder="Free"
              onChange={(e) => setState({ ...state, price: e.target.value })}
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
            <Label>Status</Label>
            <Select
              value={state.state}
              onValueChange={(value) => setState({ ...state, state: value as ItemForm["state"] })}
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
          {kind === "service" ? (
            <div className="grid gap-2">
              <Label>Duration (minutes)</Label>
              <Input
                value={state.duration}
                onChange={(e) => setState({ ...state, duration: e.target.value })}
              />
            </div>
          ) : (
            <div className="grid gap-2">
              <Label>SKU</Label>
              <Input
                value={state.sku}
                onChange={(e) => setState({ ...state, sku: e.target.value })}
              />
            </div>
          )}
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

function CatalogPage({ kind }: { kind: ItemKind }) {
  const { data, refresh } = usePortal();
  const merchant = data.merchants[0]!;
  const [editing, setEditing] = useState<ItemForm | null>(null);
  const [busy, setBusy] = useState(false);

  if (!merchant) return null;

  const items = kind === "service" ? merchant.services : merchant.products;

  async function remove(id: string) {
    setBusy(true);
    try {
      await portalDeleteCatalogItemFn({
        data: { merchantId: merchant.merchant.id, kind, itemId: id },
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
          <h1 className="text-lg font-semibold capitalize">{kind}s</h1>
          <p className="text-sm text-muted-foreground">
            {kind === "service"
              ? "What you offer. Published items appear on your site after you regenerate."
              : "What you sell. Published items appear on your site after you regenerate."}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setEditing(emptyForm())}
          disabled={busy || editing !== null}
        >
          <Plus className="size-4" /> Add {kind}
        </Button>
      </div>

      {editing ? (
        <CatalogEditor
          kind={kind}
          merchant={merchant}
          form={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      ) : null}

      {items.length === 0 && !editing ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            {kind === "service" ? (
              <Wrench className="size-8 text-muted-foreground" />
            ) : (
              <Package className="size-8 text-muted-foreground" />
            )}
            <p className="text-sm text-muted-foreground">No {kind}s yet. Add the first one.</p>
          </CardContent>
        </Card>
      ) : (
        items.map((item) => (
          <Card key={item.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="min-w-0 space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="truncate">{item.name}</span>
                  <Badge variant={item.state === "published" ? "default" : "secondary"}>
                    {item.state}
                  </Badge>
                </CardTitle>
                {item.description ? (
                  <p className="truncate text-sm text-muted-foreground">{item.description}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setEditing(
                      kind === "service"
                        ? serviceToForm(item as PortalMerchant["services"][number])
                        : productToForm(item as PortalMerchant["products"][number]),
                    )
                  }
                  disabled={busy}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void remove(item.id)}
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

export function PortalServicesPage() {
  return <CatalogPage kind="service" />;
}

export function PortalProductsPage() {
  return <CatalogPage kind="product" />;
}
