import { resolvePaddlePrice } from "@/utils/payments.functions";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
const testClientToken = import.meta.env.VITE_PAYMENTS_TEST_CLIENT_TOKEN as string | undefined;

export type PayEnv = "sandbox" | "live";

declare global {
  interface Window {
    Paddle: any;
  }
}

export function getPaddleEnvironment(): PayEnv {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

function tokenFor(env: PayEnv): string | undefined {
  if (env === getPaddleEnvironment()) return clientToken;
  // Fallback path: the live catalog is not ready yet, so pay in test mode.
  return env === "sandbox" ? (testClientToken ?? clientToken) : clientToken;
}

let scriptPromise: Promise<void> | null = null;
let initializedEnv: PayEnv | null = null;

function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Paddle can only be initialized in the browser"));
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
    script.addEventListener("error", () => reject(new Error("Paddle.js failed to load")), {
      once: true,
    });
  });
  return scriptPromise;
}

export async function initializePaddle(env: PayEnv = getPaddleEnvironment()): Promise<void> {
  const token = tokenFor(env);
  if (!token) throw new Error("Payments are not configured");
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
  return resolvePaddlePrice({ data: { priceId, environment } });
}
