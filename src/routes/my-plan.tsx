import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, Gauge, Sparkles, Timer } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { usePlan } from "@/hooks/usePlan";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export const Route = createFileRoute("/my-plan")({
  head: () => ({
    meta: [
      { title: "My plan | RitaJet" },
      {
        name: "description",
        content: "See your RitaJet plan, how much of each allowance is left and when a claimed offer runs out.",
      },
      { property: "og:title", content: "My RitaJet plan" },
      { property: "og:description", content: "Your allowances, your balance and your offer countdown in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MyPlanPage,
});

const METERS = [
  { key: "flashcards", cap: "max_flashcards", label: "Flashcards", tone: "#e4dcf3", bar: "#7c5fd3" },
  { key: "summaries", cap: "max_summaries", label: "Summaries", tone: "#fbe3c8", bar: "#e08a2e" },
  { key: "ai_questions", cap: "max_ai_questions", label: "Lecture questions", tone: "#d9ecf7", bar: "#3f8fc0" },
  { key: "archive_questions", cap: "max_archive_questions", label: "Archive questions", tone: "#e6f0d8", bar: "#6aa62c" },
  { key: "all_in_one_lectures", cap: "max_all_in_one_lectures", label: "All-in-One lectures", tone: "#f6ddd5", bar: "#d1795e" },
] as const;

function useCountdown(iso: string | null | undefined) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!iso) return;
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [iso]);
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor((ms % 86_400_000) / 3_600_000),
    minutes: Math.floor((ms % 3_600_000) / 60_000),
  };
}

function MyPlanPage() {
  const { user } = useAuth();
  const plan = usePlan();
  const settings = useSiteSettings();
  const raw = plan.data as any;
  const left = useCountdown(raw?.offer_expires_at);

  const planRow = raw?.plan ?? null;
  const grants = raw?.grants ?? {};
  const usage = raw?.usage ?? {};

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12 md:px-8 md:py-16">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#23201d] px-4 py-1.5 text-[12px] font-black uppercase tracking-[0.16em] text-white">
          <Gauge size={13} /> My plan
        </span>
        <h1 className="mt-5 font-display text-4xl font-black leading-tight tracking-tight md:text-5xl">
          {plan.planName}
        </h1>
        <p className="mt-3 max-w-xl text-[16px] font-semibold text-[#6b655c]">
          {user
            ? "Everything you have left, at a glance. Numbers update the moment you make something."
            : "Sign in to see your allowances."}
        </p>

        {left && (
          <section
            className="mt-8 overflow-hidden rounded-[30px] p-7 text-white"
            style={{
              background: "linear-gradient(135deg,#c62828 0%,#7d0d1c 100%)",
              boxShadow: "0 26px 50px -30px rgba(198,40,40,0.9)",
            }}
          >
            <p className="inline-flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.18em] text-white/80">
              <Flame size={13} /> Special offer active
            </p>
            <p className="mt-3 font-display text-3xl font-black">
              {left.days}d {left.hours}h {left.minutes}m left
            </p>
            <p className="mt-2 text-[15px] font-semibold text-white/80">
              The extra credits from your claimed offer stay on your account until then, then quietly drop off.
            </p>
            {settings.offers_page_enabled && (
              <Link
                to="/offers"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-black text-[#7d0d1c]"
              >
                <Timer size={15} /> Back to special offers
              </Link>
            )}
          </section>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {METERS.map((m) => {
            const base = planRow?.[m.cap];
            const cap =
              plan.isAdmin || base === null || base === undefined
                ? null
                : Number(base) + Number(grants?.[m.key] ?? 0);
            const used = Number(usage?.[m.key] ?? 0);
            const pct = cap ? Math.min(100, Math.round((used / cap) * 100)) : 0;
            return (
              <div key={m.key} className="rounded-[26px] border border-black/[0.06] bg-white p-6">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a29a8d]">{m.label}</p>
                <p className="mt-2 text-[26px] font-black leading-none">
                  {cap === null ? "∞" : Math.max(0, cap - used)}
                  <span className="ms-2 text-[13px] font-bold text-[#a29a8d]">
                    {cap === null ? "unlimited" : `left of ${cap}`}
                  </span>
                </p>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full" style={{ background: m.tone }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: m.bar }} />
                </div>
                <p className="mt-2 text-[12.5px] font-bold text-[#a29a8d]">{used} used so far</p>
              </div>
            );
          })}
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 rounded-full bg-[#23201d] px-6 py-3.5 text-[15px] font-black text-white"
          >
            <Sparkles size={16} /> See plans & packs
          </Link>
          {settings.offers_page_enabled && (
            <Link
              to="/offers"
              className="inline-flex items-center gap-2 rounded-full bg-[#c62828] px-6 py-3.5 text-[15px] font-black text-white"
            >
              <Flame size={16} /> Special offers
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
