import { CalendarDays, Plus, Trash2 } from "lucide-react";
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
import { portalDeleteHappeningFn, portalUpsertHappeningFn } from "@/lib/api/portal.functions";
import { usePortal, type PortalMerchant } from "./portal-context";
import { formatDate } from "./portal-utils";

const KINDS = ["event", "promotion", "announcement", "menu_change", "hours_change"] as const;

const KIND_LABELS: Record<string, string> = {
  event: "Event",
  promotion: "Promotion",
  announcement: "Announcement",
  menu_change: "Menu change",
  hours_change: "Hours change",
};

type HappeningForm = {
  id: string | null;
  kind: string;
  title: string;
  body: string;
  starts_at: string | null;
  ends_at: string | null;
  status: "published" | "draft";
};

function happeningToForm(item: PortalMerchant["happenings"][number]): HappeningForm {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    body: item.body ?? "",
    starts_at: item.starts_at ?? null,
    ends_at: item.ends_at ?? null,
    status: item.status === "published" ? "published" : "draft",
  };
}

export function PortalHappeningsPage() {
  const { data, refresh } = usePortal();
  const merchant = data.merchants[0]!;
  const [editing, setEditing] = useState<HappeningForm | null>(null);
  const [busy, setBusy] = useState(false);

  if (!merchant) return null;

  async function remove(happening: PortalMerchant["happenings"][number]) {
    setBusy(true);
    try {
      await portalDeleteHappeningFn({
        data: { merchantId: merchant.merchant.id, happeningId: happening.id },
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
          <h1 className="text-lg font-semibold">Announcements</h1>
          <p className="text-sm text-muted-foreground">
            Events, promotions and updates about your store.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() =>
            setEditing({
              id: null,
              kind: "announcement",
              title: "",
              body: "",
              starts_at: "",
              ends_at: "",
              status: "draft",
            })
          }
          disabled={busy || editing !== null}
        >
          <Plus className="size-4" /> Add announcement
        </Button>
      </div>

      {editing ? (
        <HappeningEditor
          merchant={merchant}
          form={editing}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      ) : null}

      {merchant.happenings.length === 0 && !editing ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <CalendarDays className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          </CardContent>
        </Card>
      ) : (
        merchant.happenings.map((happening) => (
          <Card key={happening.id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="min-w-0 space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="truncate">{happening.title}</span>
                  <Badge variant="secondary">{KIND_LABELS[happening.kind] ?? happening.kind}</Badge>
                  <Badge variant={happening.status === "published" ? "default" : "secondary"}>
                    {happening.status}
                  </Badge>
                </CardTitle>
                {happening.body ? (
                  <p className="truncate text-sm text-muted-foreground">{happening.body}</p>
                ) : null}
                {happening.starts_at ? (
                  <p className="text-xs text-muted-foreground">{formatDate(happening.starts_at)}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(happeningToForm(happening))}
                  disabled={busy}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void remove(happening)}
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

function HappeningEditor({
  merchant,
  form,
  onCancel,
  onSaved,
}: {
  merchant: PortalMerchant;
  form: HappeningForm;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, setState] = useState(form);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    if (!state.title.trim()) {
      setError("Give it a title.");
      return;
    }
    setSaving(true);
    try {
      await portalUpsertHappeningFn({
        data: {
          merchantId: merchant.merchant.id,
          happeningId: state.id,
          kind: state.kind as (typeof KINDS)[number],
          title: state.title.trim(),
          body: state.body.trim() || null,
          starts_at: state.starts_at || null,
          ends_at: state.ends_at || null,
          status: state.status,
        },
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this announcement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {state.id ? "Edit announcement" : "New announcement"}
        </CardTitle>
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
            <Label>Kind</Label>
            <Select
              value={state.kind}
              onValueChange={(value) => setState({ ...state, kind: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {KIND_LABELS[kind] ?? kind}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Details</Label>
          <Textarea
            rows={4}
            value={state.body}
            onChange={(e) => setState({ ...state, body: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label>Starts</Label>
            <Input
              type="datetime-local"
              value={state.starts_at ? state.starts_at.slice(0, 16) : ""}
              onChange={(e) => setState({ ...state, starts_at: e.target.value || null })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Ends</Label>
            <Input
              type="datetime-local"
              value={state.ends_at ? state.ends_at.slice(0, 16) : ""}
              onChange={(e) => setState({ ...state, ends_at: e.target.value || null })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select
              value={state.status}
              onValueChange={(value) =>
                setState({ ...state, status: value as HappeningForm["status"] })
              }
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
