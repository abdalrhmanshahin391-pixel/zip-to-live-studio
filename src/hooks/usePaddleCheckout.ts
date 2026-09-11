import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";

/**
 * Returns true when Paddle inline checkout is reliable — desktop browsers.
 * iOS Safari and Android WebView can't host cross-origin inline iframes
 * properly, so we fall back to Paddle's native overlay on mobile.
 */
export function canUseInline(): boolean {
  if (typeof window === "undefined") return false;
  // Any touch-primary device gets the overlay (covers all phones + iPads)
  if (window.matchMedia("(pointer: coarse)").matches) return false;
  return true;
}

/**
 * Opens the hosted checkout for one price.
 * Pass `frameTarget` to embed the payment form inside our own page
 * (the branded /checkout screen) instead of the provider overlay.
 * On mobile/iOS the inline iframe is unreliable, so we always use overlay.
 */
export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  const openCheckout = async (options: {
    priceId: string;
    customerEmail?: string;
    customData?: Record<string, string>;
    successUrl?: string;
    /** promo code typed by the student */
    discountCode?: string;
    /** CSS class of the element the inline payment form is rendered into */
    frameTarget?: string;
    /** If true, skips Apple Pay merchant check to prevent iPad crashes when domain is unverified */
    cardsOnly?: boolean;
  }) => {
    setLoading(true);
    try {
      const { paddlePriceId, environment } = await getPaddlePriceId(options.priceId);
      await initializePaddle(environment);

      // On mobile/iOS the inline iframe is unreliable — always use overlay there.
      const inline = !!options.frameTarget && canUseInline();
      const frameTarget = options.frameTarget;
      if (inline && (!frameTarget || !document.getElementsByClassName(frameTarget)[0])) {
        throw new Error("The payment form could not start. Please refresh the page.");
      }
      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: options.customData,
        discountCode: options.discountCode || undefined,
        settings: {
          displayMode: inline ? "inline" : "overlay",
          ...(inline
            ? {
                frameTarget,
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
          ...(options.cardsOnly ? { allowedPaymentMethods: ["card", "paypal"] } : {}),
        },
      });
    } finally {
      setLoading(false);
    }
  };

  /** Closes the open payment form so it can be reopened with a promo code. */
  const closeCheckout = () => {
    try {
      window.Paddle?.Checkout?.close?.();
    } catch {
      /* nothing open */
    }
  };

  return { openCheckout, closeCheckout, loading };
}
