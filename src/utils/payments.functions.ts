import { createServerFn } from "@tanstack/react-start";
import { gatewayFetch, type PaddleEnv } from "@/lib/paddle.server";

async function lookup(environment: PaddleEnv, priceId: string): Promise<string | null> {
  const response = await gatewayFetch(
    environment,
    `/prices?external_id=${encodeURIComponent(priceId)}`,
  );
  const bodyText = await response.text();
  if (!response.ok) {
    // A missing catalog in this environment must not kill the whole checkout —
    // the caller falls back to the test catalog.
    console.error(`Payments lookup failed (${response.status}) in ${environment}: ${bodyText.slice(0, 200)}`);
    return null;
  }
  try {
    const result = JSON.parse(bodyText) as { data?: Array<{ id: string }> };
    return result.data?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolves our human-readable price id to the provider's internal id.
 * While the live account is still being verified the catalog only exists in
 * the test environment, so we fall back to it and tell the caller which
 * environment the payment form has to open in.
 */
export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: { priceId: string; environment: PaddleEnv }) => data)
  .handler(async ({ data }): Promise<{ paddlePriceId: string; environment: PaddleEnv }> => {
    const first = await lookup(data.environment, data.priceId);
    if (first) return { paddlePriceId: first, environment: data.environment };

    if (data.environment !== "sandbox") {
      const fallback = await lookup("sandbox", data.priceId);
      if (fallback) return { paddlePriceId: fallback, environment: "sandbox" };
    }

    throw new Error(
      "This plan is not on sale yet. Please try again in a few minutes or contact support.",
    );
  });
