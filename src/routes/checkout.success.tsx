import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { ProHeader } from "@/components/home/procreate/ProHeader";
import { supabase } from "@/integrations/supabase/legacy-client";
import { useAuth } from "@/hooks/useAuth";
import { SUPPORT_EMAIL } from "@/lib/legal-content";

export const Route = createFileRoute("/checkout/success")({
  head: () => ({
    meta: [
      { title: "Payment successful — RitaJet" },
      {
        name: "description",
        content: "Your RitaJet purchase is confirmed and your study plan is being activated.",
      },
      { property: "og:title", content: "Payment successful — RitaJet" },
      { property: "og:description", content: "Your RitaJet purchase is confirmed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    plan: typeof search.plan === "string" ? search.plan : "",
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const { plan: slug } = Route.useSearch();
  const { user } = useAuth();
  const [polling, setPolling] = useState(true);
  const [granted, setGranted] = useState(false);

  // The payment provider tells our server the moment the money clears; the
  // plan appears on the account a second or two later, so we poll for it.
  useEffect(() => {
    if (!user) {
      setPolling(false);
      return;
    }
    let cancelled = false;
    let attempts = 0;

    const tick = async () => {
      if (cancelled) return;
      attempts++;
      const { data } = await (supabase.from as any)("user_plans")
        .select("plan_slug")
        .eq("user_id", user.id)
        .maybeSingle();
      const ok = slug ? (data as any)?.plan_slug === slug : !!(data as any)?.plan_slug;
      if (cancelled) return;
      if (ok) {
        setGranted(true);
        setPolling(false);
        return;
      }
      if (attempts < 15) setTimeout(tick, 1500);
      else setPolling(false);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [user, slug]);

  return (
    <div
      className="rita-cream min-h-screen bg-black text-white"
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <ProHeader variant="solid" />

      <main className="mx-auto max-w-[560px] px-6 pb-28 pt-28 text-center md:px-10">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-white/10 bg-white/[0.06]">
          <CheckCircle2 className="rita-accent h-8 w-8" />
        </div>
        <h1 className="mt-7 text-[34px] font-bold leading-[1.06] md:text-[40px]">
          Payment received
        </h1>
        <p className="mt-4 text-[16px] leading-[1.6] text-white/50">
          Thank you — a receipt is on its way to your email from Paddle, our payment partner.
        </p>

        <div className="mt-9 rounded-[28px] border border-white/10 bg-[#131313] p-7 text-left">
          {polling && !granted ? (
            <p className="flex items-center gap-3 text-[15px] font-semibold text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" /> Activating your plan…
            </p>
          ) : granted ? (
            <div className="grid gap-4">
              <p className="text-[15.5px] font-semibold text-white">Your plan is ready.</p>
              <Link to="/study" className="rita-btn rita-btn-primary gap-2 self-start">
                Start studying <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 text-[15px] text-white/55">
              <p>
                Your payment went through. The plan can take a few seconds to appear — refresh this
                page in a moment, or open your account.
              </p>
              <Link to="/my-plan" className="rita-btn rita-btn-secondary gap-2 self-start">
                My plan <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>

        <p className="mt-6 text-[13px] text-white/35">
          Need help?{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="rita-accent hover:underline">
            {SUPPORT_EMAIL}
          </a>{" "}
          — we reply within 2 working days.
        </p>
      </main>
    </div>
  );
}
