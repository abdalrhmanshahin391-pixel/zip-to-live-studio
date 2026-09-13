import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";

export type OfferCenterOffer = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  accent: string;
  badge: string;
  bullets: string[];
  plan_slug: string;
  duration_days: number;
  requires_code: boolean;
  is_active: boolean;
  sort: number;
};

export type OfferCenterPlan = {
  slug: string;
  name: string;
  price_cents: number;
  currency: string;
  sort: number;
};

export type OfferCenterCode = {
  id: string;
  code: string;
  plan_slug: string;
  label: string | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  offer_id: string | null;
  created_at: string;
};

export type OfferCenterAnnouncement = {
  id?: string;
  enabled: boolean;
  title: string;
  body: string;
  button_label: string;
  style: "ribbon" | "strip" | "floating" | "toast" | "spotlight";
  accent: string;
};

export type OfferCenterData = {
  offers: OfferCenterOffer[];
  plans: OfferCenterPlan[];
  codes: OfferCenterCode[];
  announcement: OfferCenterAnnouncement;
  offersPageEnabled: boolean;
};

async function assertAdmin(context: any) {
  const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (roleErr || !isAdmin) throw new Error("Forbidden: Admin access required");
}

/** Admin-only: Load all offer center details (offers, plans, codes, announcement, settings) */
export const getOfferCenterData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OfferCenterData> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");

    const [offersRes, plansRes, codesRes, annRes, settingsRes] = await Promise.all([
      (supabaseAdmin.from as any)("special_offers").select("*").order("sort"),
      (supabaseAdmin.from as any)("plans").select("slug,name,price_cents,currency,sort").order("sort"),
      (supabaseAdmin.from as any)("toolkit_codes").select("*").order("created_at", { ascending: false }),
      (supabaseAdmin.from as any)("announcements")
        .select("*")
        .or("href.eq./offers,href.eq.https://www.ritajet.com/offers")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      (supabaseAdmin.from as any)("site_settings").select("offers_page_enabled").maybeSingle(),
    ]);

    const rawAnn = annRes.data;
    const announcement: OfferCenterAnnouncement = {
      id: rawAnn?.id,
      enabled: !!rawAnn?.active,
      title: rawAnn?.title || "🎁 Special Offer Available: The Rita Study Toolkit is free!",
      body: rawAnn?.body || "Claim your free 3 months access with promo code.",
      button_label: rawAnn?.href_label || rawAnn?.button_label || "Claim offer →",
      style: (rawAnn?.style as any) || "ribbon",
      accent: rawAnn?.accent || "#2f7d55",
    };

    return {
      offers: (offersRes.data ?? []) as OfferCenterOffer[],
      plans: (plansRes.data ?? []) as OfferCenterPlan[],
      codes: (codesRes.data ?? []) as OfferCenterCode[],
      announcement,
      offersPageEnabled: settingsRes.data?.offers_page_enabled ?? true,
    };
  });

/** Admin-only: Save offer configuration, promo code, background placeholder setting, and announcement */
export const saveOfferCenterConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      offer: Partial<OfferCenterOffer> & { id: string };
      primaryCode: {
        code: string;
        showPlaceholder: boolean;
        maxUses?: number | null;
      };
      announcement: OfferCenterAnnouncement;
      offersPageEnabled?: boolean;
    }) => {
      if (!data?.offer?.id) throw new Error("Offer ID is required");
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");

    // 1. Update the special_offer in database
    const { offer, primaryCode, announcement, offersPageEnabled } = data;
    const offerPatch: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (offer.title !== undefined) offerPatch.title = offer.title.trim();
    if (offer.subtitle !== undefined) offerPatch.subtitle = offer.subtitle ? offer.subtitle.trim() : null;
    if (offer.badge !== undefined) offerPatch.badge = offer.badge.trim();
    if (offer.bullets !== undefined) offerPatch.bullets = offer.bullets;
    if (offer.plan_slug !== undefined) offerPatch.plan_slug = offer.plan_slug;
    if (offer.duration_days !== undefined) offerPatch.duration_days = Number(offer.duration_days);
    if (offer.requires_code !== undefined) offerPatch.requires_code = !!offer.requires_code;
    if (offer.is_active !== undefined) offerPatch.is_active = !!offer.is_active;
    if (offer.accent !== undefined) offerPatch.accent = offer.accent;
    if (offer.image_url !== undefined) offerPatch.image_url = offer.image_url;

    const { error: offerErr } = await (supabaseAdmin.from as any)("special_offers")
      .update(offerPatch)
      .eq("id", offer.id);
    if (offerErr) throw offerErr;

    // 2. Sync / Upsert primary promo code in toolkit_codes
    const codeClean = (primaryCode.code || "").trim().toUpperCase();
    if (codeClean) {
      const codeLabel = primaryCode.showPlaceholder ? "show_placeholder" : "hide_placeholder";

      // Check if there is already a code for this offer
      const { data: existingCode } = await (supabaseAdmin.from as any)("toolkit_codes")
        .select("id, code, offer_id")
        .eq("offer_id", offer.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingCode) {
        // Update existing code record
        await (supabaseAdmin.from as any)("toolkit_codes")
          .update({
            code: codeClean,
            plan_slug: offer.plan_slug,
            label: codeLabel,
            is_active: true,
            max_uses: primaryCode.maxUses ?? null,
          })
          .eq("id", existingCode.id);
      } else {
        // Insert new code record
        await (supabaseAdmin.from as any)("toolkit_codes").insert({
          code: codeClean,
          offer_id: offer.id,
          plan_slug: offer.plan_slug,
          label: codeLabel,
          is_active: true,
          max_uses: primaryCode.maxUses ?? null,
        });
      }
    }

    // 3. Sync Announcement in public.announcements
    const { data: existingAnn } = await (supabaseAdmin.from as any)("announcements")
      .select("id")
      .or("href.eq./offers,href.eq.https://www.ritajet.com/offers")
      .limit(1)
      .maybeSingle();

    if (announcement.enabled) {
      const annPayload = {
        title: announcement.title.trim(),
        body: announcement.body.trim(),
        href: "/offers",
        href_label: announcement.button_label.trim() || "Claim offer →",
        style: announcement.style || "ribbon",
        accent: announcement.accent || "#2f7d55",
        active: true,
        pinned: true,
        urgent: false,
        sort: 0,
        updated_at: new Date().toISOString(),
      };

      if (existingAnn?.id) {
        await (supabaseAdmin.from as any)("announcements")
          .update(annPayload)
          .eq("id", existingAnn.id);
      } else {
        await (supabaseAdmin.from as any)("announcements").insert(annPayload);
      }
    } else if (existingAnn?.id) {
      // Deactivate the announcement if toggled off
      await (supabaseAdmin.from as any)("announcements")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("id", existingAnn.id);
    }

    // 4. Update site_settings offers_page_enabled if supplied
    if (offersPageEnabled !== undefined) {
      await (supabaseAdmin.from as any)("site_settings")
        .upsert({ id: true, offers_page_enabled: !!offersPageEnabled }, { onConflict: "id" });
    }

    return { ok: true };
  });

/** Public endpoint: Returns metadata for public `/offers` cards (placeholder code if enabled, etc.) */
export const getPublicOfferMeta = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<string, { code: string | null; showPlaceholder: boolean }>> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
      const { data: codes } = await (supabaseAdmin.from as any)("toolkit_codes")
        .select("offer_id, code, label, is_active")
        .eq("is_active", true);

      const result: Record<string, { code: string | null; showPlaceholder: boolean }> = {};
      if (Array.isArray(codes)) {
        for (const c of codes) {
          if (!c.offer_id) continue;
          const show = c.label === "show_placeholder";
          // If already mapped and this one is show_placeholder, give preference to it
          if (!result[c.offer_id] || show) {
            result[c.offer_id] = {
              code: show ? c.code : null,
              showPlaceholder: show,
            };
          }
        }
      }
      return result;
    } catch {
      return {};
    }
  },
);
