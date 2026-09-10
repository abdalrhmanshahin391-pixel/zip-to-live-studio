import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";

/**
 * Opens the hosted checkout for one price.
 * Pass `frameTarget` to embed the payment form inside our own page
 * (the branded /checkout screen) instead of the provider overlay.
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
  }) => {
    setLoading(true);
    try {
      const { paddlePriceId, environment } = await getPaddlePriceId(options.priceId);
      await initializePaddle(environment);

      const inline = !!options.frameTarget;
      const frameTarget = options.frameTarget;
      if (inline && (!frameTarget || !document.getElementsByClassName(frameTarget)[0])) {
        throw new Error("The payment form could not start. Please refresh the page.");
      }
      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: options.customData,
        discountCode: options.discountCode || undefined,
        allowedPaymentMethods: ["card"],
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
          variant: "one-page",
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
