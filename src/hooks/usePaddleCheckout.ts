import { useEffect, useRef, useState, useCallback } from "react";
import {
  initializePaddle,
  getPaddlePriceId,
  addPaddleEventListener,
  type PayEnv,
} from "@/lib/paddle";

export type CheckoutStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "closed"
  | "completed"
  | "error";

export type PaymentMethodSelection = "all" | "card_only" | "card_and_paypal";

export interface OpenCheckoutOptions {
  priceId: string;
  customerEmail?: string;
  customData?: Record<string, string>;
  successUrl?: string;
  discountCode?: string;
  frameTarget?: string;
  displayMode?: "inline" | "overlay";
  /** Payment method restriction. "card_only" strictly allows only credit/debit cards. */
  methodRestriction?: PaymentMethodSelection;
  /** Backwards compatible alias */
  cardsOnly?: boolean;
}

export function usePaddleCheckout() {
  const [status, setStatus] = useState<CheckoutStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const activeSessionRef = useRef<number>(0);

  // Subscribe to global Paddle event bus
  useEffect(() => {
    const unsubscribe = addPaddleEventListener((event) => {
      const name = event.name;
      const data = event.data;

      if (name === "checkout.loaded") {
        setStatus("loaded");
        setError(null);
      } else if (name === "checkout.closed") {
        setStatus("closed");
      } else if (name === "checkout.completed") {
        setStatus("completed");
      } else if (name === "checkout.error") {
        setStatus("error");
        const msg =
          data?.detail ||
          data?.error?.detail ||
          data?.message ||
          "Paddle encountered an error opening the payment form.";
        setError(msg);
      } else if (name === "checkout.payment.failed") {
        const msg =
          data?.error?.detail ||
          data?.detail ||
          "Payment was declined or cancelled. Please check your card details or try another method.";
        setError(msg);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const openCheckout = useCallback(async (options: OpenCheckoutOptions) => {
    const sessionId = ++activeSessionRef.current;
    setStatus("loading");
    setError(null);

    try {
      const { paddlePriceId, environment } = await getPaddlePriceId(options.priceId);
      await initializePaddle(environment);

      if (activeSessionRef.current !== sessionId) return;

      const hasTarget =
        !!options.frameTarget &&
        typeof document !== "undefined" &&
        !!document.getElementsByClassName(options.frameTarget)[0];

      // Use inline if requested and target exists; otherwise overlay
      const isInline = options.displayMode === "inline" || (!options.displayMode && hasTarget);

      if (isInline && !hasTarget) {
        throw new Error("Payment container is not ready. Please refresh the page.");
      }

      // Strictly map allowedPaymentMethods based on user's choice
      let allowedPaymentMethods: string[] | undefined = undefined;
      if (options.cardsOnly || options.methodRestriction === "card_only") {
        // Strictly card only — no PayPal or others
        allowedPaymentMethods = ["card"];
      } else if (options.methodRestriction === "card_and_paypal") {
        allowedPaymentMethods = ["card", "paypal"];
      }
      // If "all" or omitted, allowedPaymentMethods remains undefined so Paddle decides based on dashboard & device.

      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: options.customData,
        discountCode: options.discountCode || undefined,
        settings: {
          displayMode: isInline ? "inline" : "overlay",
          ...(isInline && options.frameTarget
            ? {
                frameTarget: options.frameTarget,
                frameInitialHeight: 460,
                frameStyle:
                  "width:100%; min-width:312px; background-color:transparent; border:none;",
              }
            : {}),
          successUrl: options.successUrl || `${window.location.origin}/pricing?checkout=success`,
          allowLogout: false,
          showAddTaxId: false,
          showAddDiscounts: false,
          variant: "one-page",
          ...(allowedPaymentMethods ? { allowedPaymentMethods } : {}),
        },
      });
    } catch (err: any) {
      if (activeSessionRef.current === sessionId) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Could not open checkout.");
        throw err;
      }
    }
  }, []);

  const closeCheckout = useCallback(() => {
    try {
      window.Paddle?.Checkout?.close?.();
      setStatus("closed");
    } catch {
      /* nothing open */
    }
  }, []);

  return {
    openCheckout,
    closeCheckout,
    status,
    loading: status === "loading",
    isLoaded: status === "loaded",
    isClosed: status === "closed",
    isCompleted: status === "completed",
    error,
  };
}
