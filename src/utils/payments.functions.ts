import { createServerFn } from "@tanstack/react-start";
import { gatewayFetch, type PaddleEnv } from "@/lib/paddle.server";

export type ResolvedPrice =
  | { ok: true; paddlePriceId: string; environment: PaddleEnv }
  | { ok: false; error: string };

async function lookup(environment: PaddleEnv, priceId: string): Promise<string | null> {
  try {
    const response = await gatewayFetch(
      environment,
      `/prices?external_id=${encodeURIComponent(priceId)}`,
    );
    const bodyText = await response.text();
    if (!response.ok) {
      // A missing catalog in this environment must not kill the whole checkout —
      // the caller falls back to the test catalog.
      console.error(
        `Payments lookup failed (${response.status}) in ${environment}: ${bodyText.slice(0, 200)}`,
      );
      return null;
    }
    const result = JSON.parse(bodyText) as { data?: Array<{ id: string }> };
    return result.data?.[0]?.id ?? null;
  } catch (error) {
    console.error(`Payments lookup crashed in ${environment}:`, error);
    return null;
  }
}

/**
 * Resolves our human-readable price id to the provider's internal id.
 * Never throws: the checkout page shows a calm message instead of breaking.
 */
export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }): Promise<ResolvedPrice> => {
    const first = await lookup(data.environment, data.priceId);
    if (first) return { ok: true, paddlePriceId: first, environment: data.environment };

    const other: PaddleEnv = data.environment === "sandbox" ? "live" : "sandbox";
    const fallback = await lookup(other, data.priceId);
    if (fallback) return { ok: true, paddlePriceId: fallback, environment: other };

    return {
      ok: false,
      error: "This plan is not on sale yet. Please try again in a few minutes or contact support.",
    };
  });
