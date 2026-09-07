import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deleteCatalogItem,
  deleteHappeningRow,
  deleteLocationRow,
  deleteOfferRow,
  ensureWebsiteForMerchant,
  findWebsiteForMerchant,
  generateHomePageFromGraph,
  HAPPENING_KINDS,
  merchantPortalContext,
  publishPage,
  recordEvent,
  resolveManageableMerchant,
  saveLocationWithHours,
  unpublishPage,
  updateMerchantProfile,
  upsertCatalogItem,
  upsertHappeningRow,
  upsertOffer,
} from "./console.server";

const merchantIdSchema = z.object({ merchantId: z.string().uuid() });

const nullableString = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => value ?? null);

const isoDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

const publishStateSchema = z.enum(["draft", "published"]);

export type PortalData = Awaited<ReturnType<typeof merchantPortalContext>>;

export const myPortalDataFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return merchantPortalContext(context.supabase, context.userId);
  });

export const portalUpdateProfileFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        merchantId: z.string().uuid(),
        name: z.string().min(2),
        tagline: nullableString,
        description: nullableString,
        logo_url: nullableString,
        brand_color: nullableString,
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { tenantId } = await resolveManageableMerchant(supabase, context.userId, data.merchantId);
    const merchant = await updateMerchantProfile(supabase, tenantId, data.merchantId, {
      name: data.name,
      tagline: data.tagline,
      description: data.description,
      logo_url: data.logo_url,
      brand_color: data.brand_color,
    });
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "merchant.portal.profile_updated",
      subjectType: "merchant",
      subjectId: data.merchantId,
      payload: { name: data.name },
    });
    return { merchant };
  });

const hoursSchema = z
  .array(
    z.object({
      day_of_week: z.number().int().min(0).max(6),
      opens_at: z.string().nullable(),
      closes_at: z.string().nullable(),
      is_closed: z.boolean(),
    }),
  )
  .default([]);

export const portalSaveLocationFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        merchantId: z.string().uuid(),
        locationId: z.string().uuid().nullable().optional(),
        label: z.string().min(1),
        address_line1: nullableString,
        address_line2: nullableString,
        city: nullableString,
        region: nullableString,
        postal_code: nullableString,
        country: nullableString,
        phone: nullableString,
        is_primary: z.boolean(),
        hours: hoursSchema,
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { tenantId } = await resolveManageableMerchant(supabase, context.userId, data.merchantId);
    const { location } = await saveLocationWithHours(
      supabase,
      tenantId,
      data.merchantId,
      data.locationId ?? null,
      {
        label: data.label,
        address_line1: data.address_line1,
        address_line2: data.address_line2,
        city: data.city,
        region: data.region,
        postal_code: data.postal_code,
        country: data.country,
        phone: data.phone,
        is_primary: data.is_primary,
      },
      data.hours.map((hour) => ({
        day_of_week: hour.day_of_week,
        opens_at: hour.opens_at,
        closes_at: hour.closes_at,
        is_closed: hour.is_closed,
      })),
    );
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "merchant.portal.location_saved",
      subjectType: "location",
      subjectId: location.id,
      payload: { label: data.label, created: !data.locationId },
    });
    return { location };
  });

export const portalDeleteLocationFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        merchantId: z.string().uuid(),
        locationId: z.string().uuid(),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { tenantId } = await resolveManageableMerchant(supabase, context.userId, data.merchantId);
    await deleteLocationRow(supabase, tenantId, data.merchantId, data.locationId);
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "merchant.portal.location_deleted",
      subjectType: "location",
      subjectId: data.locationId,
      payload: {},
    });
    return { ok: true };
  });

export const portalUpsertCatalogItemFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        merchantId: z.string().uuid(),
        itemId: z.string().uuid().nullable().optional(),
        kind: z.enum(["product", "service"]),
        name: z.string().min(1),
        description: nullableString,
        price_cents: z.number().int().nullable().optional(),
        state: publishStateSchema,
        sku: nullableString,
        currency: z.string().min(1).max(8).optional(),
        duration_minutes: z.number().int().nullable().optional(),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { tenantId } = await resolveManageableMerchant(supabase, context.userId, data.merchantId);
    const { item, created } = await upsertCatalogItem(
      supabase,
      tenantId,
      data.merchantId,
      data.itemId ?? null,
      data.kind === "product"
        ? {
            kind: "product",
            name: data.name,
            description: data.description,
            price_cents: data.price_cents ?? null,
            state: data.state,
            sku: data.sku,
            currency: data.currency ?? "USD",
          }
        : {
            kind: "service",
            name: data.name,
            description: data.description,
            price_cents: data.price_cents ?? null,
            state: data.state,
            duration_minutes: data.duration_minutes ?? null,
          },
    );
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "merchant.portal.catalog_saved",
      subjectType: data.kind,
      subjectId: item.id,
      payload: { kind: data.kind, name: data.name, created },
    });
    return { item };
  });

export const portalDeleteCatalogItemFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        merchantId: z.string().uuid(),
        kind: z.enum(["product", "service"]),
        itemId: z.string().uuid(),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { tenantId } = await resolveManageableMerchant(supabase, context.userId, data.merchantId);
    await deleteCatalogItem(supabase, tenantId, data.merchantId, data.kind, data.itemId);
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "merchant.portal.catalog_deleted",
      subjectType: data.kind,
      subjectId: data.itemId,
      payload: { kind: data.kind },
    });
    return { ok: true };
  });

export const portalUpsertOfferFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        merchantId: z.string().uuid(),
        offerId: z.string().uuid().nullable().optional(),
        title: z.string().min(1),
        description: nullableString,
        discount_label: nullableString,
        starts_at: isoDate,
        ends_at: isoDate,
        state: publishStateSchema,
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { tenantId } = await resolveManageableMerchant(supabase, context.userId, data.merchantId);
    const { offer, created } = await upsertOffer(
      supabase,
      tenantId,
      data.merchantId,
      data.offerId ?? null,
      {
        title: data.title,
        description: data.description,
        discount_label: data.discount_label,
        starts_at: data.starts_at,
        ends_at: data.ends_at,
        state: data.state,
      },
    );
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "merchant.portal.offer_saved",
      subjectType: "offer",
      subjectId: offer.id,
      payload: { title: data.title, created },
    });
    return { offer };
  });

export const portalDeleteOfferFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        merchantId: z.string().uuid(),
        offerId: z.string().uuid(),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { tenantId } = await resolveManageableMerchant(supabase, context.userId, data.merchantId);
    await deleteOfferRow(supabase, tenantId, data.merchantId, data.offerId);
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "merchant.portal.offer_deleted",
      subjectType: "offer",
      subjectId: data.offerId,
      payload: {},
    });
    return { ok: true };
  });

export const portalUpsertHappeningFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        merchantId: z.string().uuid(),
        happeningId: z.string().uuid().nullable().optional(),
        kind: z.enum(HAPPENING_KINDS),
        title: z.string().min(1),
        body: nullableString,
        starts_at: isoDate,
        ends_at: isoDate,
        status: z.enum(["draft", "published"]),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { tenantId } = await resolveManageableMerchant(supabase, context.userId, data.merchantId);
    const { happening, created } = await upsertHappeningRow(
      supabase,
      tenantId,
      data.merchantId,
      data.happeningId ?? null,
      {
        kind: data.kind,
        title: data.title,
        body: data.body,
        starts_at: data.starts_at,
        ends_at: data.ends_at,
        status: data.status,
      },
    );
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "merchant.portal.happening_saved",
      subjectType: "happening",
      subjectId: happening.id,
      payload: { kind: data.kind, title: data.title, status: data.status, created },
    });
    return { happening };
  });

export const portalDeleteHappeningFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        merchantId: z.string().uuid(),
        happeningId: z.string().uuid(),
      })
      .parse(input),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { tenantId } = await resolveManageableMerchant(supabase, context.userId, data.merchantId);
    await deleteHappeningRow(supabase, tenantId, data.merchantId, data.happeningId);
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "merchant.portal.happening_deleted",
      subjectType: "happening",
      subjectId: data.happeningId,
      payload: {},
    });
    return { ok: true };
  });

// =============== website lifecycle ===============

export const portalGenerateHomeFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => merchantIdSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { tenantId } = await resolveManageableMerchant(supabase, context.userId, data.merchantId);
    const websiteId = await ensureWebsiteForMerchant(supabase, tenantId, data.merchantId);
    const result = await generateHomePageFromGraph(supabase, tenantId, websiteId, context.userId);
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "website.generated",
      subjectType: "website_page",
      subjectId: result.page.id,
      payload: {
        websiteId,
        merchantId: result.merchantId,
        path: "/",
        version: result.version,
        sections: result.sectionCount,
        state: "draft",
      },
    });
    return { result };
  });

export const portalPublishFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => merchantIdSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { tenantId } = await resolveManageableMerchant(supabase, context.userId, data.merchantId);
    const websiteId = await ensureWebsiteForMerchant(supabase, tenantId, data.merchantId);
    const result = await publishPage(supabase, tenantId, websiteId);
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "website.published",
      subjectType: "website",
      subjectId: websiteId,
      payload: { merchantId: result.merchantId, publishedVersion: result.publishedVersion },
    });
    return { result };
  });

export const portalUnpublishFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => merchantIdSchema.parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const supabase = context.supabase;
    const { tenantId } = await resolveManageableMerchant(supabase, context.userId, data.merchantId);
    const website = await findWebsiteForMerchant(supabase, tenantId, data.merchantId);
    if (!website) return { result: null };
    const result = await unpublishPage(supabase, tenantId, website.id);
    await recordEvent(supabase, {
      tenantId,
      actorId: context.userId,
      kind: "website.unpublished",
      subjectType: "website",
      subjectId: website.id,
      payload: {},
    });
    return { result };
  });
