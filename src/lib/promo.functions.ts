import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";

const envSchema = z.enum(["sandbox", "live"]).default("sandbox");

type Env = "sandbox" | "live";

type Discount = {
  id: string;
  status: string;
  description: string;
  code: string | null;
  type: "percentage" | "flat" | "flat_per_seat";
  amount: string;
  currency_code: string | null;
  recur: boolean;
  maximum_recurring_intervals: number | null;
  usage_limit: number | null;
  times_used: number;
  restrict_to: string[] | null;
  expires_at: string | null;
  enabled_for_checkout: boolean;
  created_at: string;
};

async function api(env: Env, path: string, init?: RequestInit) {
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
    const fieldErrors = Array.isArray(body?.error?.errors)
      ? body.error.errors
          .map((e: any) => (e.field ? `${e.field}: ${e.message}` : e.message))
          .join("; ")
      : null;
    const detail =
      fieldErrors || body?.error?.detail || body?.error?.code || `Request failed (${res.status})`;
    throw new Error(detail);
  }
  return body;
}

async function assertAdmin(context: unknown) {
  const ctx = context as { supabase: any; userId: string };
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

/* ------------------------------------------------------------- customer */

/**
 * Checks a promo code the student typed at checkout and works out what the
 * new total would be. The real discount is still applied by the payment
 * provider — this is only so we can show an honest price first.
 */
export const checkPromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        code: z.string().trim().min(1).max(32),
        environment: envSchema,
        paddlePriceId: z.string().min(1),
        cents: z.number().int().min(0),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const body = await api(
      data.environment,
      `/discounts?code=${encodeURIComponent(data.code.toUpperCase())}&status=active`,
    );
    const found = (body?.data ?? []) as Discount[];
    const d = found.find((x) => (x.code ?? "").toUpperCase() === data.code.trim().toUpperCase());
    if (!d) throw new Error("That code is not valid — check the spelling and try again.");
    if (!d.enabled_for_checkout) throw new Error("That code cannot be used at checkout.");
    if (d.expires_at && new Date(d.expires_at) < new Date())
      throw new Error("That code has expired.");
    if (d.usage_limit !== null && d.times_used >= d.usage_limit)
      throw new Error("That code has already been fully used.");
    if (d.restrict_to?.length && !d.restrict_to.includes(data.paddlePriceId))
      throw new Error("That code does not apply to this plan.");

    const amount = Number(d.amount || 0);
    const off =
      d.type === "percentage" ? Math.round((data.cents * amount) / 100) : Math.round(amount);
    const discountCents = Math.min(off, data.cents);

    return {
      code: (d.code ?? data.code).toUpperCase(),
      label: d.description,
      type: d.type,
      discountCents,
      totalCents: data.cents - discountCents,
      recurring: d.recur,
    };
  });

/* ---------------------------------------------------------------- admin */

export const adminListDiscounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ environment: envSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const body = await api(
      data.environment,
      "/discounts?status=active,archived&per_page=200&order_by=created_at[DESC]",
    );
    return (body?.data ?? []) as Discount[];
  });

const createSchema = z.object({
  environment: envSchema,
  description: z.string().trim().min(1).max(200),
  code: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9]+$/, "Codes can only use letters and numbers"),
  type: z.enum(["percentage", "flat"]),
  amount: z.number().min(0.01),
  currency_code: z.string().length(3).default("USD"),
  recur: z.boolean().default(false),
  maximum_recurring_intervals: z.number().int().min(1).max(60).nullable().default(null),
  usage_limit: z.number().int().min(1).max(1_000_000).nullable().default(null),
  expires_at: z.string().nullable().default(null),
  restrict_to: z.array(z.string()).default([]),
});

/** Creates a real discount in the payment provider. */
export const adminCreateDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload: Record<string, unknown> = {
      description: data.description,
      code: data.code.toUpperCase(),
      type: data.type,
      amount:
        data.type === "percentage"
          ? String(data.amount)
          : String(Math.round(data.amount * 100)),
      enabled_for_checkout: true,
      recur: data.recur,
    };
    if (data.type !== "percentage") {
      payload.currency_code = data.currency_code.toUpperCase();
    }
    if (data.recur && data.maximum_recurring_intervals) {
      payload.maximum_recurring_intervals = data.maximum_recurring_intervals;
    }
    if (data.usage_limit) {
      payload.usage_limit = data.usage_limit;
    }
    if (data.expires_at) {
      payload.expires_at = data.expires_at;
    }
    if (data.restrict_to && data.restrict_to.length > 0) {
      payload.restrict_to = data.restrict_to;
    }
    const body = await api(data.environment, "/discounts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return body?.data as Discount;
  });

/** Turns a code on or off, or archives it for good. */
export const adminUpdateDiscount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        environment: envSchema,
        id: z.string().min(1),
        enabled_for_checkout: z.boolean().optional(),
        status: z.enum(["active", "archived"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { environment, id, ...patch } = data;
    const body = await api(environment, `/discounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    return body?.data as Discount;
  });

/** Prices in the payment catalog, so a code can be limited to some plans. */
export const adminListPaddlePrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ environment: envSchema }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const body = await api(data.environment, "/prices?per_page=200&status=active");
    return ((body?.data ?? []) as any[]).map((p) => ({
      id: p.id as string,
      externalId: (p.import_meta?.external_id ?? null) as string | null,
      description: p.description as string,
      amount: p.unit_price?.amount as string,
      currency: p.unit_price?.currency_code as string,
      interval: (p.billing_cycle?.interval ?? null) as string | null,
    }));
  });
