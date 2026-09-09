import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Clock3, Loader2, LockKeyhole, RefreshCcw } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/legacy-client";
import { useAuth } from "@/hooks/useAuth";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";

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
        setError(e instanceof Error ? e.message : "We could not open the payment form."),
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
    <div className="min-h-screen bg-[#fbf5e9] text-[#23201d]">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-8 md:px-8">
        <Link
          to="/pricing"
          className="inline-flex items-center gap-2 text-[13.5px] font-black text-[#7a736a] hover:text-[#23201d]"
        >
          <ArrowLeft size={15} /> Back to plans
        </Link>

        <h1 className="mt-4 font-display text-[32px] font-black leading-tight md:text-[40px]">
          Secure checkout
        </h1>
        <p className="mt-2 max-w-xl text-[15.5px] text-[#5c554b]">
          You are paying inside RitaJet. Your card details go straight to our payment partner —
          we never see or store them.
        </p>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          {/* ---------------------------------------------- payment form */}
          <section className="rounded-[28px] border border-black/[0.07] bg-white p-5 shadow-[0_30px_60px_-50px_rgba(35,32,29,0.9)] md:p-7">
            <h2 className="text-[12px] font-black uppercase tracking-[0.18em] text-[#a29a8d]">
              Pay securely
            </h2>

            {error && (
              <p className="mt-4 rounded-2xl bg-[#fdeeea] px-4 py-3 text-[14.5px] font-bold text-[#a4423a]">
                {error}
              </p>
            )}

            {!error && (isLoading || !ready) && (
              <p className="mt-6 flex items-center gap-2 text-[14.5px] font-bold text-[#7a736a]">
                <Loader2 size={16} className="animate-spin" /> Preparing your secure payment form…
              </p>
            )}

            <div id="rita-checkout-frame" className="mt-4 min-h-[26rem]" />
          </section>

          {/* --------------------------------------------- order summary */}
          <aside className="rounded-[28px] border border-black/[0.07] bg-white p-6 shadow-[0_30px_60px_-50px_rgba(35,32,29,0.9)] lg:sticky lg:top-6">
            <h2 className="text-[12px] font-black uppercase tracking-[0.18em] text-[#a29a8d]">
              Order summary
            </h2>

            {isLoading && <div className="mt-4 h-24 animate-pulse rounded-2xl bg-[#fbf5e9]" />}

            {!isLoading && !plan && (
              <p className="mt-4 text-[14.5px] font-bold text-[#7a736a]">
                We could not find that plan.{" "}
                <Link to="/pricing" className="underline">
                  Choose one here
                </Link>
                .
              </p>
            )}

            {plan && (
              <>
                <p className="mt-3 font-display text-[24px] font-black">{plan.name}</p>
                {plan.tagline && (
                  <p className="mt-1 text-[14px] font-semibold text-[#7a736a]">{plan.tagline}</p>
                )}

                <div className="mt-4 flex items-end gap-2 border-y border-dashed border-black/10 py-4">
                  <span className="font-display text-[38px] font-black leading-none">
                    {money(cents, plan.currency)}
                  </span>
                  <span className="pb-1 text-[13.5px] font-bold text-[#a29a8d]">
                    {billing === "once" ? "one-time" : billing === "yearly" ? "/ year" : "/ month"}
                  </span>
                </div>

                <p className="mt-4 text-[12px] font-black uppercase tracking-[0.16em] text-[#a29a8d]">
                  What you get
                </p>
                <ul className="mt-2 grid gap-1.5">
                  {perks.map((p) => (
                    <li key={p.text} className="text-[14.5px] font-semibold text-[#3f3a33]">
                      • {p.text}
                    </li>
                  ))}
                </ul>

                {billing === "once" && (
                  <p className="mt-4 rounded-2xl bg-[#f3f8ea] px-4 py-3 text-[13.5px] font-semibold text-[#4d7a1f]">
                    Yours for life — use the credits at your own pace. When the pack runs out you
                    can buy it again and the credits add on top.
                  </p>
                )}
              </>
            )}

            <ul className="mt-6 grid gap-2.5 border-t border-dashed border-black/10 pt-5 text-[13.5px] font-semibold text-[#5c554b]">
              <li className="flex items-center gap-2">
                <LockKeyhole size={15} className="text-[#8ec63f]" /> Secure payment, encrypted
              </li>
              <li className="flex items-center gap-2">
                <RefreshCcw size={15} className="text-[#8ec63f]" /> 14-day money-back promise
              </li>
              <li className="flex items-center gap-2">
                <BadgeCheck size={15} className="text-[#8ec63f]" /> Cancel a subscription any time
              </li>
              <li className="flex items-center gap-2">
                <Clock3 size={15} className="text-[#8ec63f]" /> Support replies in 2 working days
              </li>
            </ul>
          </aside>
        </div>
      </main>
    </div>
  );
}
