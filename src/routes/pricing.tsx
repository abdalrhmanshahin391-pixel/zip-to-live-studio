import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, Minus, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/legacy-client";
import { OfferRibbon, discountPercent, offerLive } from "@/components/pricing/offer";
import { myPlanUsage, type PlanRow } from "@/lib/plans.functions";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { updateSiteSettings } from "@/lib/site-settings.functions";
import { useQueryClient } from "@tanstack/react-query";
import monthlyArt from "@/assets/pricing-monthly.jpg";
import packsArt from "@/assets/pricing-packs.jpg";
import packStarter from "@/assets/pack-starter.jpg";
import packStudy from "@/assets/pack-study.jpg";
import packExam from "@/assets/pack-exam.jpg";


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

/** Colour accents cycle so any number of plans still looks designed. */
const TINTS = ["#eef4fb", "#f6f0e4", "#eef7ef", "#f8eef3", "#f0eefb", "#fbf1e8"];

const PACK_ART = [packStarter, packStudy, packExam];

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
    <div className="min-h-screen bg-[#fbf5e9] text-[#23201d]">
      <SiteHeader />

      <section className="relative">
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pt-10 text-center md:pt-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-[11.5px] font-black uppercase tracking-[0.2em] text-[#7a736a] shadow-[0_10px_24px_-18px_rgba(35,32,29,0.8)]">
            <Sparkles size={13} /> Plans
          </span>
          <h1
            className="mt-4 font-display font-black leading-[1.08] tracking-tight"
            style={{ fontSize: "clamp(2rem, 4.6vw, 3.2rem)" }}
          >
            Study smarter for less than a coffee a week
          </h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-[#5c554b]">
            Every plan includes the flashcard workspace, the to-do board and spaced repetition.
            Every allowance is a lifetime balance — it counts down as you use it and never
            expires at the end of the month. The bigger plans simply give you more AI.
          </p>

          {kind && (
            <button
              type="button"
              onClick={() => setKind(null)}
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13.5px] font-black text-[#7a736a] shadow-[0_14px_34px_-26px_rgba(35,32,29,0.9)] hover:text-[#23201d]"
            >
              <ArrowLeft size={15} />
              {kind === "monthly" ? "Monthly plans" : "One-time packs"} · change
            </button>
          )}

          {kind === "monthly" && (
            <div className="mt-4 inline-flex rounded-full bg-white p-1 shadow-[0_14px_34px_-26px_rgba(35,32,29,0.9)]">
              {[
                { k: false, label: "Monthly" },
                { k: true, label: "Yearly · save more" },
              ].map((o) => (
                <button
                  key={String(o.k)}
                  type="button"
                  onClick={() => setYearly(o.k)}
                  className={`rounded-full px-5 py-2 text-[13.5px] font-black transition-all ${
                    yearly === o.k ? "bg-[#23201d] text-white" : "text-[#8a8378]"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {kind === "lifetime" && (
            <p className="mt-4 max-w-xl text-[14.5px] font-semibold text-[#7a736a]">
              Yours for life — use them at your own pace. When a pack runs out, buy it again and
              the credits add on top.
            </p>
          )}
        </div>
      </section>

      {!kind && (
        <section className="mx-auto grid max-w-5xl gap-6 px-4 pb-24 pt-10 md:grid-cols-2 md:px-8">
          {[
            {
              k: "monthly" as const,
              art: monthlyArt,
              title: "Monthly plans",
              copy: "A steady allowance every month for cards, summaries and AI questions. Cancel any time.",
              cta: "See monthly plans",
            },
            {
              k: "lifetime" as const,
              art: packsArt,
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
              className="group overflow-hidden rounded-[28px] border border-black/[0.07] bg-white text-left shadow-[0_30px_60px_-50px_rgba(35,32,29,0.9)] transition-transform hover:-translate-y-1"
            >
              <img
                src={b.art}
                alt=""
                loading="lazy"
                width={1024}
                height={640}
                className="h-48 w-full object-cover md:h-56"
              />
              <div className="p-7">
                <h2 className="font-display text-[26px] font-black">{b.title}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-[#5c554b]">{b.copy}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-[15px] font-black text-[#23201d]">
                  {b.cta} <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </button>
            ))}
        </section>
      )}

      {!kind && isAdmin && (
        <section className="mx-auto -mt-16 max-w-5xl px-4 pb-16 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-black/[0.07] bg-white p-5 shadow-[0_24px_50px_-46px_rgba(35,32,29,0.9)]">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#a29a8e]">Admin only</p>
              <p className="mt-1 text-[15px] font-black">
                Credit packs — pay once:{" "}
                <span className={settings.credit_packs_enabled ? "text-[#1f7a4d]" : "text-[#a4321f]"}>
                  {settings.credit_packs_enabled ? "visible to everyone" : "hidden from students"}
                </span>
              </p>
              <p className="mt-1 text-[13.5px] text-[#7a736a]">
                You always see the packs. This switch decides whether students can.
              </p>
            </div>
            <button
              type="button"
              onClick={togglePacks}
              disabled={savingPacks}
              className="rounded-full bg-[#23201d] px-5 py-2.5 text-[13.5px] font-black text-white disabled:opacity-60"
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

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-12 md:px-8">
        {kind && (
        <>
        {isLoading && (

          <div className="grid gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[30rem] animate-pulse rounded-[28px] bg-white/70" />
            ))}
          </div>
        )}

        {!isLoading && live.length === 0 && (
          <p className="rounded-3xl border border-dashed border-black/15 bg-white/70 p-10 text-center font-bold text-[#7a736a]">
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
                className={`relative flex flex-col overflow-hidden rounded-[28px] border bg-white p-7 transition-transform hover:-translate-y-1 ${
                  best ? "border-[#23201d]/15 shadow-[0_40px_70px_-45px_rgba(35,32,29,0.9)]" : "border-black/[0.07] shadow-[0_24px_50px_-45px_rgba(35,32,29,0.8)]"
                }`}
                style={best ? { outline: "2px solid #8ec63f", outlineOffset: "-2px" } : undefined}
              >
                <OfferRibbon label={p.ribbon_label} color={p.ribbon_color} endsAt={p.offer_ends_at} />
                {best && !p.ribbon_label && (
                  <span className="absolute right-0 top-0 rounded-bl-2xl bg-[#8ec63f] px-3.5 py-1.5 text-[10.5px] font-black uppercase tracking-[0.16em] text-white">
                    Most popular
                  </span>
                )}
                {isMine && (
                  <span className="absolute left-0 top-0 rounded-br-2xl bg-[#23201d] px-3.5 py-1.5 text-[10.5px] font-black uppercase tracking-[0.16em] text-white">
                    Your plan
                  </span>
                )}

                {lifetime && (
                  <img
                    src={PACK_ART[i % PACK_ART.length]}
                    alt=""
                    loading="lazy"
                    width={768}
                    height={512}
                    className="-mx-7 -mt-7 mb-5 h-36 w-[calc(100%+3.5rem)] max-w-none object-cover"
                  />
                )}

                <span
                  className="inline-flex w-fit rounded-full px-3.5 py-1.5 text-[11.5px] font-black uppercase tracking-[0.16em] text-[#5c554b]"
                  style={{ background: TINTS[i % TINTS.length] }}
                >
                  {p.name}
                </span>

                {p.tagline && (
                  <p className="mt-3 text-[15px] font-semibold leading-snug text-[#5c554b]">
                    {p.tagline}
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-end gap-x-2 gap-y-1">
                  <span className="font-display text-[44px] font-black leading-none">
                    {money(priceCents, p.currency)}
                  </span>
                  <span className="pb-1.5 text-[14px] font-bold text-[#a29a8d]">
                    {priceCents === 0 ? "free" : lifetime ? "once" : yearly ? "/ year" : "/ month"}
                  </span>
                  {off > 0 && (
                    <span className="mb-1.5 inline-flex items-center gap-1.5">
                      <span className="text-[15px] font-bold text-[#b6ada0] line-through">
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


                <ul className="mt-6 grid gap-2.5 border-t border-dashed border-black/10 pt-6">
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
                    className={`mt-7 inline-flex h-13 items-center justify-center rounded-full px-6 py-3.5 text-[16px] font-black transition-transform hover:-translate-y-0.5 ${
                      best ? "rita-pill" : "border border-black/10 bg-[#fbf5e9] text-[#23201d]"
                    }`}
                  >
                    {p.cta_label || "Start free"}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => buy(p)}
                    className={`mt-7 inline-flex h-13 items-center justify-center rounded-full px-6 py-3.5 text-[16px] font-black transition-transform hover:-translate-y-0.5 disabled:opacity-60 ${
                      best ? "rita-pill" : "border border-black/10 bg-[#fbf5e9] text-[#23201d]"
                    }`}
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
          <section className="mt-14 flex flex-wrap items-center gap-4 rounded-[28px] border border-black/[0.07] bg-white p-7">
            <div className="min-w-0">
              <h2 className="text-[18px] font-black">You are on {mine.plan?.name}</h2>
              <p className="mt-1 text-[14px] font-semibold text-[#6b655c]">
                Your balance, allowances and any offer countdown now live on their own page.
              </p>
            </div>
            <Link
              to="/my-plan"
              className="ms-auto inline-flex items-center gap-2 rounded-full bg-[#23201d] px-6 py-3 text-[14px] font-black text-white"
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
    <li className={`flex items-start gap-2.5 text-[15px] ${on ? "font-semibold text-[#3f3a33]" : "text-[#b6ada0] line-through"}`}>
      <span
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full"
        style={{ background: on ? "#e7f3d6" : "#f1eee8" }}
      >
        {on ? <Check size={12} strokeWidth={3.5} color="#5f9227" /> : <Minus size={12} color="#b6ada0" />}
      </span>
      {text}
    </li>
  );
}
