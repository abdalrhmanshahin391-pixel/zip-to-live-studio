import { resolvePaddlePrice } from "@/utils/payments.functions";

const liveClientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
const testClientToken = import.meta.env.VITE_PAYMENTS_TEST_CLIENT_TOKEN as string | undefined;
/** While the live account is still being reviewed every checkout runs in test mode. */
const forceTest = String(import.meta.env.VITE_PAYMENTS_FORCE_TEST ?? "") === "1";

export type PayEnv = "sandbox" | "live";

declare global {
  interface Window {
    Paddle: any;
  }
}

/** The environment every payment form must open in. */
export function getPaddleEnvironment(): PayEnv {
  if (forceTest && (testClientToken || liveClientToken?.startsWith("test_"))) return "sandbox";
  return liveClientToken?.startsWith("test_") ? "sandbox" : "live";
}

function tokenFor(env: PayEnv): string | undefined {
  if (env === "sandbox") {
    if (testClientToken?.startsWith("test_")) return testClientToken;
    return liveClientToken?.startsWith("test_") ? liveClientToken : undefined;
  }
  return liveClientToken?.startsWith("live_") ? liveClientToken : undefined;
}

let scriptPromise: Promise<void> | null = null;
let initializedEnv: PayEnv | null = null;

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("The payment form can only open in your browser."));
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://cdn.paddle.com/paddle/v2/paddle.js"]',
    );
    if (existing && window.Paddle) {
      resolve();
      return;
    }
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener(
      "error",
      () => {
        scriptPromise = null;
        reject(
          new Error(
            "The secure payment form could not load. Check your connection or any ad blocker and try again.",
          ),
        );
      },
      { once: true },
    );
  });
  return scriptPromise;
}

export async function initializePaddle(env: PayEnv = getPaddleEnvironment()): Promise<void> {
  const token = tokenFor(env);
  if (!token) throw new Error("Card payments are being set up. Please try again shortly.");
  await loadScript();
  if (initializedEnv === env) return;
  window.Paddle.Environment.set(env === "sandbox" ? "sandbox" : "production");
  window.Paddle.Initialize({ token });
  initializedEnv = env;
}

/** Resolves our price id and says which environment the form must open in. */
export async function getPaddlePriceId(
  priceId: string,
): Promise<{ paddlePriceId: string; environment: PayEnv }> {
  const environment = getPaddleEnvironment();
  const result = await resolvePaddlePrice({ data: { priceId, environment } });
  if (!result.ok) throw new Error(result.error);
  return { paddlePriceId: result.paddlePriceId, environment: result.environment };
}
