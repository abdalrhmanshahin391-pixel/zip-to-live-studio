import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Clock3, Loader2, LockKeyhole, RefreshCcw } from "lucide-react";
import { ProHeader } from "@/components/home/procreate/ProHeader";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { supabase } from "@/integrations/supabase/legacy-client";
import { useAuth } from "@/hooks/useAuth";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { SUPPORT_EMAIL } from "@/lib/legal-content";

export const Route = createFileRoute("/checkout/")({
  head: () => ({
    meta: [
      { title: "Secure checkout — RitaJet" },
      {
        name: "description",
        content:
          "Finish your RitaJet purchase on a secure page: see exactly what your plan or credit pack includes before you pay.",
      },
      { property: "og:title", content: "Secure checkout — RitaJet" },
      {
        property: "og:description",
        content: "Pay securely for your RitaJet plan or one-time credit pack.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    plan: typeof s.plan === "string" ? s.plan : "",
    billing:
      s.billing === "yearly" || s.billing === "once" ? (s.billing as "yearly" | "once") : "monthly",
  }),
  component: CheckoutPage,
});

const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JOD: "JD " };
const money = (cents: number, currency = "USD") =>
  `${SYMBOL[currency] ?? `${currency} `}${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
const cap = (n: number | null | undefined, unit: string) =>
  n === null || n === undefined ? `Unlimited ${unit}` : `${n.toLocaleString()} ${unit}`;

function CheckoutPage() {
  const { plan: slug, billing } = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { openCheckout } = usePaddleCheckout();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const started = useRef(false);

  const { data: plan, isLoading } = useQuery({
    queryKey: ["checkout-plan", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error: e } = await (supabase.from as any)("plans")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (e) throw new Error(e.message);
      return data as any;
    },
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({
        to: "/login",
        search: { next: `/checkout?plan=${slug}&billing=${billing}` } as any,
      });
    }
  }, [authLoading, user, navigate, slug, billing]);

  const priceId: string | null = plan
    ? billing === "once"
      ? plan.paddle_price_once
      : billing === "yearly"
        ? plan.paddle_price_yearly
        : plan.paddle_price_monthly
    : null;

  const cents: number = plan
    ? billing === "once"
      ? (plan.once_cents ?? 0)
      : billing === "yearly"
        ? (plan.yearly_cents ?? 0)
        : (plan.price_cents ?? 0)
    : 0;

  useEffect(() => {
    if (!plan || !user || started.current) return;
    if (!priceId) {
      setError("This plan is not on sale yet. Please try another one or contact support.");
      return;
    }
    started.current = true;
    openCheckout({
      priceId,
      customerEmail: user.email ?? undefined,
      customData: { userId: user.id, planSlug: plan.slug },
      successUrl: `${window.location.origin}/checkout/success?plan=${plan.slug}`,
      frameTarget: "rita-checkout-frame",
    })
      .then(() => setReady(true))
      .catch((e) =>
        setError(
          e instanceof Error && e.message
            ? e.message
            : "We could not open the payment form. Please refresh the page and try again.",
        ),
      );
  }, [plan, user, priceId, openCheckout]);

  const perks = plan
    ? [
        { on: plan.max_flashcards !== 0, text: cap(plan.max_flashcards, "flashcards") },
        { on: plan.max_summaries !== 0, text: cap(plan.max_summaries, "PDF summaries") },
        { on: plan.max_ai_questions !== 0, text: cap(plan.max_ai_questions, "lecture questions") },
        {
          on: plan.max_all_in_one_lectures !== 0,
          text: cap(plan.max_all_in_one_lectures, "All-in-One lectures"),
        },
        {
          on: plan.max_archive_questions !== 0,
          text: cap(plan.max_archive_questions, "Archive questions"),
        },
      ].filter((p) => p.on)
    : [];

  return (
    <div
      className="rita-cream min-h-screen bg-black text-white"
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <PaymentTestModeBanner />
      <ProHeader variant="solid" />

      <main className="mx-auto max-w-[1120px] px-6 pb-28 pt-24 md:px-10 md:pt-28">
        <Link
          to="/pricing"
          className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-white/45 transition-colors hover:text-white"
        >
          <ArrowLeft size={15} /> Back to plans
        </Link>

        <p className="mt-8 text-[19px] font-bold md:text-[21px]">
          RitaJet <span className="rita-accent font-normal">Study</span>
        </p>
        <h1 className="mt-4 text-[34px] font-bold leading-[1.06] md:text-[43px]">
          Secure checkout
        </h1>
        <p className="mt-5 max-w-[30rem] text-[16px] leading-[1.6] text-white/50 md:text-[17px]">
          You pay inside RitaJet. Your card details go straight to our payment partner — we never
          see or store them.
        </p>

        <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
          {/* ---------------------------------------------- payment form */}
          <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#131313] p-6 md:rounded-[34px] md:p-9">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">
              Pay securely
            </p>

            {error && (
              <p className="mt-5 rounded-[20px] border border-[#a4321f]/40 bg-[#a4321f]/10 px-5 py-4 text-[15px] font-semibold text-[#ff9f8f]">
                {error}{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
                  Email support
                </a>{" "}
                and we will sort it out.
              </p>
            )}

            {!error && (isLoading || !ready) && (
              <p className="mt-6 flex items-center gap-2 text-[15px] font-semibold text-white/45">
                <Loader2 size={16} className="animate-spin" /> Preparing your secure payment form…
              </p>
            )}

            <div id="rita-checkout-frame" className="mt-5 min-h-[26rem]" />

            <p className="mt-6 border-t border-white/10 pt-5 text-[13px] leading-relaxed text-white/40">
              By paying you agree to our{" "}
              <Link to="/terms" className="rita-accent hover:underline">
                Terms
              </Link>
              ,{" "}
              <Link to="/privacy-policy" className="rita-accent hover:underline">
                Privacy notice
              </Link>{" "}
              and{" "}
              <Link to="/refund-policy" className="rita-accent hover:underline">
                Refund policy
              </Link>
              . Our order process is conducted by our online reseller Paddle.com, the Merchant of
              Record for all our orders; Paddle handles billing enquiries and returns. Questions?{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="rita-accent hover:underline">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </section>

          {/* --------------------------------------------- order summary */}
          <aside className="rounded-[28px] border border-white/10 bg-[#131313] p-7 md:rounded-[34px] lg:sticky lg:top-24">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">
              Order summary
            </p>

            {isLoading && <div className="mt-5 h-24 animate-pulse rounded-[20px] bg-white/[0.07]" />}

            {!isLoading && !plan && (
              <p className="mt-4 text-[15px] font-semibold text-white/50">
                We could not find that plan.{" "}
                <Link to="/pricing" className="rita-accent underline">
                  Choose one here
                </Link>
                .
              </p>
            )}

            {plan && (
              <>
                <p className="mt-4 text-[26px] font-bold leading-tight">{plan.name}</p>
                {plan.tagline && (
                  <p className="mt-2 text-[14.5px] text-white/45">{plan.tagline}</p>
                )}

                <div className="mt-5 flex items-end gap-2 border-y border-white/10 py-5">
                  <span className="text-[40px] font-bold leading-none">
                    {money(cents, plan.currency)}
                  </span>
                  <span className="pb-1 text-[13.5px] font-semibold text-white/40">
                    {billing === "once" ? "one-time" : billing === "yearly" ? "/ year" : "/ month"}
                  </span>
                </div>

                <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">
                  What you get
                </p>
                <ul className="mt-3 grid gap-2">
                  {perks.map((p) => (
                    <li key={p.text} className="text-[14.5px] font-medium text-white/70">
                      • {p.text}
                    </li>
                  ))}
                </ul>

                {billing === "once" && (
                  <p className="mt-5 rounded-[20px] border border-white/10 bg-white/[0.05] px-5 py-4 text-[13.5px] font-medium text-white/60">
                    Yours for life — use the credits at your own pace. When the pack runs out you
                    can buy it again and the credits add on top.
                  </p>
                )}
              </>
            )}

            <ul className="mt-7 grid gap-3 border-t border-white/10 pt-6 text-[13.5px] font-medium text-white/55">
              <li className="flex items-center gap-2">
                <LockKeyhole size={15} className="rita-accent" /> Secure payment, encrypted
              </li>
              <li className="flex items-center gap-2">
                <RefreshCcw size={15} className="rita-accent" /> 30-day money-back guarantee
              </li>
              <li className="flex items-center gap-2">
                <BadgeCheck size={15} className="rita-accent" /> Cancel a subscription any time
              </li>
              <li className="flex items-center gap-2">
                <Clock3 size={15} className="rita-accent" /> Support replies in 2 working days
              </li>
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
}
