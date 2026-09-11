import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/legacy-auth-middleware";

export type SubscriptionRow = {
  id: string;
  user_id: string;
  paddle_subscription_id: string;
  paddle_customer_id: string | null;
  product_id: string | null;
  price_id: string | null;
  plan_slug: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  environment: string;
  created_at: string;
  updated_at: string;
};

/** Retrieves the authenticated student's latest subscription. */
export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as any).userId as string;
    const client = (context as any).supabase as any;

    const { data, error } = await client
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("getMySubscription query error:", error);
      return null;
    }
    return data as SubscriptionRow | null;
  });

/** Creates a secure Paddle Customer Portal session to manage/remove payment methods and view receipts. */
export const createCustomerPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = (context as any).userId as string;
    const client = (context as any).supabase as any;

    const { data: sub } = await client
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const env: "sandbox" | "live" = (sub?.environment as any) === "live" ? "live" : "sandbox";
    const customerId = sub?.paddle_customer_id;

    if (customerId) {
      try {
        const { gatewayFetch } = await import("@/lib/paddle.server");
        const bodyPayload: Record<string, unknown> = {};
        if (sub?.paddle_subscription_id) {
          bodyPayload.subscription_ids = [sub.paddle_subscription_id];
        }
        const res = await gatewayFetch(env, `/customers/${customerId}/portal-sessions`, {
          method: "POST",
          body: JSON.stringify(bodyPayload),
        });

        if (res.ok) {
          const body = await res.json();
          const portalUrl =
            body?.data?.urls?.general?.overview ||
            body?.data?.urls?.subscriptions?.[0]?.update_payment_method;
          if (portalUrl) {
            return { url: portalUrl };
          }
        } else {
          console.warn("Portal session creation error:", res.status, await res.text());
        }
      } catch (err) {
        console.warn("createCustomerPortalSession failed:", err);
      }
    }

    // Default fallback: official Paddle customer self-service hub
    return { url: "https://paddle.net" };
  });

/** Cancels a subscription at the end of its current billing period. */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        paddleSubscriptionId: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = (context as any).userId as string;
    const client = (context as any).supabase as any;

    const { data: sub, error } = await client
      .from("subscriptions")
      .select("*")
      .eq("paddle_subscription_id", data.paddleSubscriptionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !sub) {
      throw new Error("Subscription not found on your account.");
    }

    const env: "sandbox" | "live" = (sub.environment as any) === "live" ? "live" : "sandbox";

    // Call Paddle cancellation API
    try {
      const { gatewayFetch } = await import("@/lib/paddle.server");
      const res = await gatewayFetch(env, `/subscriptions/${sub.paddle_subscription_id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ effective_from: "next_billing_period" }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.warn("Paddle cancel API error:", res.status, text);
      }
    } catch (err) {
      console.warn("Paddle cancel API call failed:", err);
    }

    // Update in database using RPC or admin
    const { error: rpcErr } = await client.rpc("cancel_user_subscription", {
      _user_id: userId,
      _paddle_sub_id: data.paddleSubscriptionId,
    });

    if (rpcErr) {
      console.warn("cancel_user_subscription RPC error:", rpcErr);
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await (supabaseAdmin as any)
          .from("subscriptions")
          .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
          .eq("paddle_subscription_id", data.paddleSubscriptionId);
      } catch (adminErr) {
        console.warn("supabaseAdmin update error:", adminErr);
      }
    }

    return { ok: true, message: "Your subscription will cancel at the end of your billing cycle." };
  });
