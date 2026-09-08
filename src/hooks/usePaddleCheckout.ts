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
    /** id of the element the inline payment form is rendered into */
    frameTarget?: string;
  }) => {
    setLoading(true);
    try {
      const { paddlePriceId, environment } = await getPaddlePriceId(options.priceId);
      await initializePaddle(environment);

      const inline = !!options.frameTarget;
      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: options.customerEmail ? { email: options.customerEmail } : undefined,
        customData: options.customData,
        settings: {
          displayMode: inline ? "inline" : "overlay",
          ...(inline
            ? {
                frameTarget: options.frameTarget,
                frameInitialHeight: 460,
                frameStyle:
                  "width:100%; min-width:312px; background-color:transparent; border:none;",
              }
            : {}),
          successUrl: options.successUrl || `${window.location.origin}/pricing?checkout=success`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
