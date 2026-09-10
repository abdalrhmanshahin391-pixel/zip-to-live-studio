import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";
import { z } from "zod";

const planSchema = z.object({
  slug: z.string().min(1).max(40).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(60),
  tagline: z.string().max(200).default(""),
  price_cents: z.number().int().min(0).max(1_000_000),
  yearly_cents: z.number().int().min(0).max(10_000_000),
  currency: z.string().min(1).max(6).default("USD"),
  billing_kind: z.enum(["monthly", "lifetime"]).default("monthly"),
  once_cents: z.number().int().min(0).max(10_000_000).default(0),
  paddle_price_monthly: z.string().max(80).nullable().default(null),
  paddle_price_yearly: z.string().max(80).nullable().default(null),
  paddle_price_once: z.string().max(80).nullable().default(null),
  cta_label: z.string().max(40).nullable().default(null),
  max_flashcards: z.number().int().min(0).nullable(),
  max_ai_questions: z.number().int().min(0).nullable(),
  max_summaries: z.number().int().min(0).nullable(),
  max_todo_tasks: z.number().int().min(0).nullable().default(null),
  max_calendar_items: z.number().int().min(0).nullable().default(null),
  max_groups: z.number().int().min(0).nullable().default(null),
  max_all_in_one_lectures: z.number().int().min(0).nullable().default(null),
  max_all_in_one_questions: z.number().int().min(0).nullable().default(null),
  max_archive_questions: z.number().int().min(0).nullable().default(null),
  todo_full: z.boolean(),
  rich_cards: z.boolean(),
  feature_ai_import: z.boolean(),
  feature_review: z.boolean(),
  feature_lecture_qgen: z.boolean().default(true),
  feature_archive_qgen: z.boolean().default(true),
  feature_all_in_one: z.boolean().default(true),
  perks: z.array(z.string().max(120)).max(12).default([]),
  published: z.boolean(),
  highlight: z.boolean(),
  sort: z.number().int().min(0).max(999),
  /* Offer / discount */
  ribbon_label: z.string().max(24).nullable().default(null),
  ribbon_color: z.string().max(16).nullable().default(null),
  compare_cents: z.number().int().min(0).max(10_000_000).nullable().default(null),
  offer_ends_at: z.string().nullable().default(null),
});

export type AdminPlan = z.infer<typeof planSchema>;

async function assertAdmin(context: unknown) {
  const ctx = context as { supabase: any; userId: string };
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

/** Every plan, published or not — admin only. */
export const adminListPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
    const { data, error } = await (supabaseAdmin as any).from("plans").select("*").order("sort");
    if (error) throw new Error(error.message);
    return (data ?? []) as AdminPlan[];
  });

type Env = "sandbox" | "live";

async function pay(env: Env, path: string, init?: RequestInit) {
  const { gatewayFetch } = await import("@/lib/paddle.server");
  const res = await gatewayFetch(env, path, init);
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    throw new Error(body?.error?.detail || `Payment catalog request failed (${res.status})`);
  }
  return body;
}

/**
 * Pushes a plan's name and prices to the payment catalog so the amount a
 * student is charged always matches what the pricing page shows. Students who
 * already bought keep the price they signed up on.
 */
async function syncPlanToPaddle(plan: AdminPlan, env: Env) {
  const targets: { externalId: string | null; cents: number }[] = [
    { externalId: plan.paddle_price_monthly, cents: plan.price_cents },
    { externalId: plan.paddle_price_yearly, cents: plan.yearly_cents },
    { externalId: plan.paddle_price_once, cents: plan.once_cents },
  ];
  const done: string[] = [];
  const failed: string[] = [];
  let productSynced = false;

  for (const t of targets) {
    if (!t.externalId || !t.cents) continue;
    try {
      const found = await pay(env, `/prices?external_id=${encodeURIComponent(t.externalId)}`);
      const price = found?.data?.[0];
      if (!price) {
        failed.push(t.externalId);
        continue;
      }
      await pay(env, `/prices/${price.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          unit_price: { amount: String(t.cents), currency_code: plan.currency.toUpperCase() },
        }),
      });
      done.push(t.externalId);

      if (!productSynced && price.product_id) {
        await pay(env, `/products/${price.product_id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: plan.name,
            description: plan.tagline || plan.name,
          }),
        }).catch(() => null);
        productSynced = true;
      }
    } catch {
      failed.push(t.externalId);
    }
  }
  return { done, failed };
}

/** Create or update one plan, and keep the payment catalog in step. */
export const adminSavePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => planSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
    const { error } = await (supabaseAdmin as any)
      .from("plans")
      .upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: "slug" });
    if (error) throw new Error(error.message);

    // Best effort: saving the plan must never fail because the catalog is busy.
    let sync: { done: string[]; failed: string[] } = { done: [], failed: [] };
    try {
      sync = await syncPlanToPaddle(data, "sandbox");
    } catch {
      sync = { done: [], failed: ["catalog unreachable"] };
    }
    return { ok: true, sync };
  });

/** Re-send one plan's prices to the payment catalog on demand. */
export const adminSyncPlanPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ slug: z.string().min(1), environment: z.enum(["sandbox", "live"]).default("sandbox") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
    const { data: row, error } = await (supabaseAdmin as any)
      .from("plans")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That plan no longer exists.");
    return await syncPlanToPaddle(row as AdminPlan, data.environment);
  });

/** Delete a plan; students on it fall back to Starter. */
export const adminDeletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.slug === "starter") throw new Error("The Starter plan cannot be deleted.");
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
    const admin = supabaseAdmin as any;
    await admin.from("user_plans").update({ plan_slug: "starter" }).eq("plan_slug", data.slug);
    const { error } = await admin.from("plans").delete().eq("slug", data.slug);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Put one student on a plan, found by email or username. */
export const adminAssignPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ query: z.string().min(2), slug: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/legacy-client.server");
    const admin = supabaseAdmin as any;
    const q = data.query.trim();
    const { data: rows } = await admin
      .from("profiles")
      .select("id, email, username")
      .or(`email.ilike.${q},username.ilike.${q}`)
      .limit(1);
    const target = rows?.[0];
    if (!target) throw new Error(`No student found for “${q}”.`);
    const { error } = await admin
      .from("user_plans")
      .upsert({ user_id: target.id, plan_slug: data.slug }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true, who: target.email ?? target.username ?? q };
  });
