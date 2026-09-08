import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, Minus, Sparkles } from "lucide-react";
import { ProHeader } from "@/components/home/procreate/ProHeader";
import { supabase } from "@/integrations/supabase/legacy-client";
import { OfferRibbon, discountPercent, offerLive } from "@/components/pricing/offer";
import { myPlanUsage, type PlanRow } from "@/lib/plans.functions";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { updateSiteSettings } from "@/lib/site-settings.functions";
import { useQueryClient } from "@tanstack/react-query";
import { EditableImage } from "@/components/site/EditableImage";
import monthlyArt from "@/assets/pricing-monthly-dark.jpg.asset.json";
import packsArt from "@/assets/pricing-packs-dark.jpg.asset.json";
import packStarter from "@/assets/pack-starter-dark.jpg.asset.json";
import packStudy from "@/assets/pack-study-dark.jpg.asset.json";
import packExam from "@/assets/pack-exam-dark.jpg.asset.json";


export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Rita plans — flashcards, summaries and AI questions" },
      {
        name: "description",
        content:
          "Pick the Rita plan that matches your semester: a free start, an everyday study plan, or the exam-season plan with the biggest AI allowance.",
      },
      { property: "og:title", content: "Choose your smart study plan — RitaJet" },
      {
        property: "og:description",
        content:
          "Simple plans for flashcards, PDF summaries, AI questions and your to-do board.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PricingPage,
});

type FullPlan = PlanRow & {
  currency?: string;
  cta_label?: string | null;
  perks?: string[] | null;
  published?: boolean;
  highlight?: boolean;
  feature_ai_import?: boolean;
  feature_review?: boolean;
  feature_lecture_qgen?: boolean;
  feature_archive_qgen?: boolean;
  feature_all_in_one?: boolean;
  feature_rita38?: boolean;
  billing_kind?: "monthly" | "lifetime";
  once_cents?: number;
  paddle_price_monthly?: string | null;
  paddle_price_yearly?: string | null;
  paddle_price_once?: string | null;
  ribbon_label?: string | null;
  ribbon_color?: string | null;
  compare_cents?: number | null;
  offer_ends_at?: string | null;
};

const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", JOD: "JD " };

function money(cents: number, currency = "USD") {
  const sym = SYMBOL[currency] ?? `${currency} `;
  if (cents === 0) return `${sym}0`;
  return `${sym}${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function cap(n: number | null | undefined, unit: string) {
  return n === null || n === undefined ? `Unlimited ${unit}` : `${n.toLocaleString()} ${unit}`;
}

const PACK_ART = [packStarter.url, packStudy.url, packExam.url];

function PricingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [yearly, setYearly] = useState(false);
  const [kind, setKind] = useState<"monthly" | "lifetime" | null>(null);
  const usageFn = useServerFn(myPlanUsage);
  const settings = useSiteSettings();
  const saveSettings = useServerFn(updateSiteSettings);
  const qc = useQueryClient();
  const [savingPacks, setSavingPacks] = useState(false);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["plans"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<FullPlan[]> => {
      const { data, error } = await (supabase.from as any)("plans").select("*").order("sort");
      if (error) throw new Error(error.message);
      return (data ?? []) as FullPlan[];
    },
  });

  const { data: mine } = useQuery({
    queryKey: ["my-plan-usage", user?.id ?? "anon"],
    queryFn: () => usageFn({}),
    enabled: !!user,
  });

  const isAdmin = !!(mine as any)?.is_admin;
  const packsVisible = settings.credit_packs_enabled || isAdmin;

  const togglePacks = async () => {
    setSavingPacks(true);
    try {
      await saveSettings({ data: { credit_packs_enabled: !settings.credit_packs_enabled } });
      await qc.invalidateQueries({ queryKey: ["site-settings"] });
    } finally {
      setSavingPacks(false);
    }
  };

  const live = plans.filter(
    (p) => p.published !== false && (p.billing_kind ?? "monthly") === (kind ?? "monthly"),
  );

  const buy = (p: FullPlan) => {
    const billing = kind === "lifetime" ? "once" : yearly ? "yearly" : "monthly";
    if (!user) {
      navigate({ to: "/register", search: { next: `/checkout?plan=${p.slug}&billing=${billing}` } as any });
      return;
    }
    navigate({ to: "/checkout", search: { plan: p.slug, billing } as any });
  };

  const cols = Math.min(live.length || 1, 5);

  return (
    <div
      className="rita-cream min-h-screen bg-black text-white"
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <ProHeader variant="solid" />

      <section className="relative pt-24 md:pt-28">
        <div className="relative mx-auto flex max-w-[1120px] flex-col items-center px-6 pt-10 text-center md:px-10 md:pt-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
            <Sparkles size={13} /> Plans
          </span>
          <h1
            className="mt-5 max-w-[820px] font-bold leading-[1.04]"
            style={{ fontSize: "clamp(2.5rem, 5.4vw, 4.6rem)" }}
          >
            Choose how you want to study.
          </h1>
          <p className="mt-6 max-w-2xl text-[17px] font-normal leading-[1.55] text-white/55 md:text-[19px]">
            Every plan includes the flashcard workspace, the to-do board and spaced repetition.
            Every allowance is a lifetime balance — it counts down as you use it and never
            expires at the end of the month. The bigger plans simply give you more AI.
          </p>

          {kind && (
            <button
              type="button"
              onClick={() => setKind(null)}
              className="rita-btn rita-btn-secondary mt-8 gap-2"
            >
              <ArrowLeft size={15} />
              {kind === "monthly" ? "Monthly plans" : "One-time packs"} · change
            </button>
          )}

          {kind === "monthly" && (
            <div className="mt-5 inline-flex rounded-full border border-white/10 bg-white/[0.06] p-1">
              {[
                { k: false, label: "Monthly" },
                { k: true, label: "Yearly · save more" },
              ].map((o) => (
                <button
                  key={String(o.k)}
                  type="button"
                  onClick={() => setYearly(o.k)}
                  className={`rounded-full px-5 py-2 text-[13.5px] font-semibold transition-colors ${
                    yearly === o.k ? "bg-white text-black" : "text-white/55 hover:text-white"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {kind === "lifetime" && (
            <p className="mt-5 max-w-xl text-[14.5px] font-medium text-white/50">
              Yours for life — use them at your own pace. When a pack runs out, buy it again and
              the credits add on top.
            </p>
          )}
        </div>
      </section>

      {!kind && (
        <section className="mx-auto grid max-w-[1120px] gap-5 px-6 pb-24 pt-12 md:grid-cols-2 md:px-10 md:pt-16">
          {[
            {
              k: "monthly" as const,
               art: monthlyArt.url,
              title: "Monthly plans",
              copy: "A steady allowance every month for cards, summaries and AI questions. Cancel any time.",
              cta: "See monthly plans",
            },
            {
              k: "lifetime" as const,
               art: packsArt.url,
              title: "Credit packs — pay once",
              copy: "200 flashcards, 100 questions and more. Use them whenever you like, they never expire.",
              cta: "See packs",
            },
          ]
            .filter((b) => b.k !== "lifetime" || packsVisible)
            .map((b) => (
            <button
              key={b.k}
              type="button"
              onClick={() => setKind(b.k)}
               className="group overflow-hidden rounded-[24px] border border-white/10 bg-[#131313] text-left transition-transform hover:-translate-y-1"
            >
              <EditableImage
                imageKey={`pricing.${b.k}`}
                fallback={b.art}
                alt=""
                width={1024}
                height={640}
                className="h-52 w-full object-cover opacity-90 transition-opacity group-hover:opacity-100 md:h-64"
              />
               <div className="p-7 md:p-8">
                 <h2 className="text-[26px] font-bold">{b.title}</h2>
                 <p className="mt-3 text-[15px] leading-relaxed text-white/50">{b.copy}</p>
                 <span className="mt-6 inline-flex items-center gap-2 text-[15px] font-semibold rita-accent">
                  {b.cta} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </button>
            ))}
        </section>
      )}

      {!kind && isAdmin && (
        <section className="mx-auto -mt-16 max-w-[1120px] px-6 pb-16 md:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-[#131313] p-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">Admin only</p>
              <p className="mt-1 text-[15px] font-bold text-white">
                Credit packs — pay once:{" "}
                <span className={settings.credit_packs_enabled ? "text-[#1f7a4d]" : "text-[#a4321f]"}>
                  {settings.credit_packs_enabled ? "visible to everyone" : "hidden from students"}
                </span>
              </p>
              <p className="mt-1 text-[13.5px] text-white/45">
                You always see the packs. This switch decides whether students can.
              </p>
            </div>
            <button
              type="button"
              onClick={togglePacks}
              disabled={savingPacks}
              className="rita-btn rita-btn-secondary disabled:opacity-60"
            >
              {savingPacks
                ? "Saving…"
                : settings.credit_packs_enabled
                  ? "Hide for everyone"
                  : "Show to everyone"}
            </button>
          </div>
        </section>
      )}

      <main className="mx-auto max-w-[1120px] px-6 pb-24 pt-12 md:px-10">
        {kind && (
        <>
        {isLoading && (

          <div className="grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[30rem] animate-pulse rounded-[20px] bg-white/[0.07]" />
            ))}
          </div>
        )}

        {!isLoading && live.length === 0 && (
          <p className="rounded-[20px] border border-dashed border-white/15 bg-white/[0.05] p-10 text-center font-semibold text-white/50">
            No plans are published yet.
          </p>
        )}

        <div
          className="grid items-stretch gap-6 max-lg:!grid-cols-1 max-xl:!grid-cols-2"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {live.map((p, i) => {
            const lifetime = kind === "lifetime";
            const priceCents = lifetime
              ? (p.once_cents ?? 0)
              : yearly
                ? (p.yearly_cents ?? 0)
                : (p.price_cents ?? 0);
            const isMine = mine?.plan?.slug === p.slug;
            const best = !!p.highlight;

            const liveOffer = offerLive(p.offer_ends_at);
            const off = lifetime || yearly || !liveOffer ? 0 : discountPercent(p.compare_cents, p.price_cents);
            const semesterSave =
              !lifetime && yearly && p.price_cents && p.yearly_cents
                ? Math.max(0, Math.round((1 - p.yearly_cents / (p.price_cents * 6)) * 100))
                : 0;
            return (
              <article
                key={p.slug}
                 className={`relative flex flex-col overflow-hidden rounded-[20px] border bg-[#131313] p-7 transition-transform hover:-translate-y-1 ${
                   best ? "rita-accent-border" : "border-white/10"
                }`}
              >
                <OfferRibbon label={p.ribbon_label} color={p.ribbon_color} endsAt={p.offer_ends_at} />
                {best && !p.ribbon_label && (
                   <span className="absolute right-0 top-0 rounded-bl-xl rita-accent-bg px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white">
                    Most popular
                  </span>
                )}
                {isMine && (
                   <span className="absolute left-0 top-0 rounded-br-xl bg-white px-3.5 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-black">
                    Your plan
                  </span>
                )}

                {lifetime && (
                  <EditableImage
                    imageKey={`pricing.pack${i % 3}`}
                    fallback={PACK_ART[i % PACK_ART.length] as string}
                    alt=""
                    width={768}
                    height={512}
                    className="-mx-7 -mt-7 mb-5 h-36 w-[calc(100%+3.5rem)] max-w-none object-cover"
                  />
                )}

                 <span className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.07] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/65">
                  {p.name}
                </span>

                {p.tagline && (
                   <p className="mt-3 text-[15px] font-medium leading-snug text-white/50">
                    {p.tagline}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-end gap-x-2 gap-y-1">
                   <span className="text-[44px] font-bold leading-none">
                    {money(priceCents, p.currency)}
                  </span>
                   <span className="pb-1.5 text-[14px] font-medium text-white/35">
                    {priceCents === 0 ? "free" : lifetime ? "once" : yearly ? "/ year" : "/ month"}
                  </span>
                  {off > 0 && (
                    <span className="mb-1.5 inline-flex items-center gap-1.5">
                       <span className="text-[15px] font-semibold text-white/30 line-through">
                        {money(p.compare_cents ?? 0, p.currency)}
                      </span>
                      <span
                        className="rounded-full px-2.5 py-1 text-[11.5px] font-black text-white"
                        style={{ background: "#d1795e" }}
                      >
                        −{off}%
                      </span>
                    </span>
                  )}
                  {semesterSave > 0 && (
                    <span className="mb-1.5 rounded-full bg-[#e7f3d6] px-2.5 py-1 text-[11.5px] font-black text-[#4d7a1f]">
                      save {semesterSave}% vs monthly
                    </span>
                  )}
                </div>


                 <ul className="mt-6 grid gap-2.5 border-t border-white/10 pt-6">
                  {[
                    { on: p.max_flashcards !== 0, text: cap(p.max_flashcards, "flashcards") },
                    { on: p.max_summaries !== 0, text: cap(p.max_summaries, "PDF summaries") },
                    {
                      on: p.feature_lecture_qgen !== false && p.max_ai_questions !== 0,
                      text: cap(p.max_ai_questions, "lecture questions"),
                    },
                    {
                      on: p.feature_all_in_one !== false && p.max_all_in_one_lectures !== 0,
                      text: cap(p.max_all_in_one_lectures, "All-in-One lectures"),
                    },
                    {
                      on: p.feature_archive_qgen !== false && p.max_archive_questions !== 0,
                      text: cap(p.max_archive_questions, "Archive questions with full explanations"),
                    },
                    {
                      on: p.feature_rita38 !== false && p.max_rita_questions !== 0,
                      text: cap(p.max_rita_questions, "Rita Model 3.8 questions"),
                    },
                    { on: p.max_todo_tasks !== 0, text: cap(p.max_todo_tasks, "to-do tasks") },
                    {
                      on: p.max_calendar_items !== 0,
                      text: cap(p.max_calendar_items, "calendar entries"),
                    },
                    { on: p.max_groups !== 0, text: cap(p.max_groups, "classrooms you create") },
                    { on: true, text: "Join unlimited classrooms" },
                  ]
                    .filter((l) => l.on)
                    .map((l) => (
                      <Line key={l.text} on text={l.text} />
                    ))}
                </ul>



                {!lifetime && priceCents === 0 ? (
                  <Link
                    to={user ? "/study" : "/register"}
                     className={`rita-btn mt-7 ${best ? "rita-btn-primary" : "rita-btn-secondary"}`}
                  >
                    {p.cta_label || "Start free"}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => buy(p)}
                     className={`rita-btn mt-7 disabled:opacity-60 ${best ? "rita-btn-primary" : "rita-btn-secondary"}`}
                  >
                    {p.cta_label ||
                      (lifetime
                        ? isMine
                          ? `Top up ${p.name}`
                          : `Buy ${p.name} — ${money(priceCents, p.currency)}`
                        : `Get ${p.name}`)}
                  </button>
                )}
              </article>
            );
          })}
        </div>
        </>
        )}



        {mine && (
          <section className="mt-14 flex flex-wrap items-center gap-4 rounded-[20px] border border-white/10 bg-[#131313] p-7">
            <div className="min-w-0">
              <h2 className="text-[18px] font-bold">You are on {mine.plan?.name}</h2>
              <p className="mt-1 text-[14px] font-medium text-white/45">
                Your balance, allowances and any offer countdown now live on their own page.
              </p>
            </div>
            <Link
              to="/my-plan"
              className="rita-btn rita-btn-primary ms-auto"
            >
              Open my plan
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}

function Line({ on, text }: { on?: boolean; text: string }) {
  return (
    <li className={`flex items-start gap-2.5 text-[15px] ${on ? "font-medium text-white/75" : "text-white/30 line-through"}`}>
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ${on ? "rita-accent-soft" : "bg-white/[0.06]"}`}
      >
        {on ? <Check size={12} strokeWidth={3.5} className="rita-accent" /> : <Minus size={12} className="text-white/30" />}
      </span>
      {text}
    </li>
  );
}
