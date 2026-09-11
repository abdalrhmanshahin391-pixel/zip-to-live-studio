import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Check, Plus, Save, Search, ShieldCheck, Trash2, UserPlus, XCircle } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import {
  adminCreatePlanGrant,
  adminDeletePlan,
  adminFindGrantStudent,
  adminListPlans,
  adminListPlanGrants,
  adminRevokePlanGrant,
  adminSavePlan,
  adminSyncPlanPrices,
  type AdminPlan,
  type ManualPlanGrant,
} from "@/lib/plans-admin.functions";
import { OfferRibbon, discountPercent, offerLive } from "@/components/pricing/offer";

export const Route = createFileRoute("/admin/plans")({
  head: () => ({
    meta: [
      { title: "Rita Prices — RitaJet admin" },
      { name: "description", content: "Create plans, set their limits and switch features on or off." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Rita Prices — RitaJet admin" },
      { property: "og:description", content: "Manage RitaJet pricing cards, limits, offers and features." },
    ],
  }),
  component: AdminPlansPage,
});

const input =
  "w-full rounded-xl border-2 border-black/10 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#8ec63f]";
const label = "text-[11px] font-black uppercase tracking-[0.16em] text-[#a29a8d]";

const RIBBONS = [
  { text: "MOST POPULAR", color: "#8ec63f" },
  { text: "BEST VALUE", color: "#f0a95c" },
  { text: "NEW", color: "#6aa9d8" },
  { text: "STUDENT DEAL", color: "#a58fd8" },
  { text: "LIMITED TIME", color: "#d1795e" },
];

function blank(sort: number, n: number): AdminPlan {
  return {
    slug: `plan-${n}`,
    name: `New plan ${n}`,
    tagline: "",
    price_cents: 0,
    yearly_cents: 0,
    currency: "USD",
    billing_kind: "monthly",
    once_cents: 0,
    paddle_price_monthly: null,
    paddle_price_yearly: null,
    paddle_price_once: null,
    cta_label: null,
    max_flashcards: 100,
    max_ai_questions: 50,
    max_summaries: 5,
    max_todo_tasks: null,
    max_calendar_items: null,
    max_groups: 1,
    max_all_in_one_lectures: 5,
    max_all_in_one_questions: 100,
    max_archive_questions: 100,
    todo_full: true,
    rich_cards: true,
    feature_ai_import: true,
    feature_review: true,
    feature_lecture_qgen: true,
    feature_archive_qgen: true,
    feature_all_in_one: true,
    perks: [],
    published: false,
    highlight: false,
    sort,
    ribbon_label: null,
    ribbon_color: null,
    compare_cents: null,
    offer_ends_at: null,
  };
}

const money = (cents: number, currency = "USD") =>
  `${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`;

function AdminPlansPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(adminListPlans);
  const save = useServerFn(adminSavePlan);
  const syncPrices = useServerFn(adminSyncPlanPrices);
  const remove = useServerFn(adminDeletePlan);
  const findStudent = useServerFn(adminFindGrantStudent);
  const createGrant = useServerFn(adminCreatePlanGrant);
  const listGrants = useServerFn(adminListPlanGrants);
  const revokeGrant = useServerFn(adminRevokePlanGrant);

  const [drafts, setDrafts] = useState<AdminPlan[]>([]);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [who, setWho] = useState("");
  const [whoPlan, setWhoPlan] = useState("");
  const [grantMatch, setGrantMatch] = useState<any>(null);
  const [grantExpiry, setGrantExpiry] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [grantOverride, setGrantOverride] = useState(true);
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

  const { data } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: () => list({}) as Promise<AdminPlan[]>,
    enabled: isAdmin,
  });
  const { data: grants = [] } = useQuery({
    queryKey: ["admin-plan-grants"],
    queryFn: () => listGrants({}) as Promise<ManualPlanGrant[]>,
    enabled: isAdmin,
  });

  useEffect(() => {
    if (!data) return;
    const rows = data.map((p) => ({ ...p, perks: p.perks ?? [] }));
    setDrafts(rows);
    setSaved(Object.fromEntries(rows.map((p) => [p.slug, JSON.stringify(p)])));
    setSelected((s) => s ?? rows[0]?.slug ?? null);
  }, [data]);

  const index = drafts.findIndex((p) => p.slug === selected);
  const plan = index >= 0 ? drafts[index]! : null;
  const dirty = plan ? saved[plan.slug] !== JSON.stringify(plan) : false;

  const patch = (p: Partial<AdminPlan>) =>
    setDrafts((d) => d.map((row) => (row.slug === selected ? { ...row, ...p } : row)));

  const persist = async (row: AdminPlan, quiet = false) => {
    const res = (await save({ data: row })) as { sync?: { done: string[]; failed: string[] } };
    setSaved((s) => ({ ...s, [row.slug]: JSON.stringify(row) }));
    await qc.invalidateQueries({ queryKey: ["plans"] });
    if (!quiet) {
      const done = res?.sync?.done?.length ?? 0;
      toast.success(
        done > 0
          ? `${row.name} saved — new price sent to checkout for new buyers`
          : `${row.name} saved`,
      );
      if (res?.sync?.failed?.length) {
        toast.error(`Checkout price not updated for: ${res.sync.failed.join(", ")}`);
      }
    }
  };

  const onSyncPrices = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const r = await syncPrices({ data: { slug: plan.slug, environment: "sandbox" } });
      toast.success(
        r.done.length
          ? `Checkout prices updated (${r.done.join(", ")})`
          : "Nothing to update — add the checkout price ids first.",
      );
      if (r.failed.length) toast.error(`Could not update: ${r.failed.join(", ")}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reach the payment catalog");
    } finally {
      setBusy(false);
    }
  };

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= drafts.length) return;
    const next = [...drafts];
    const a = next[i]!;
    next[i] = next[j]!;
    next[j] = a;
    const sorted = next.map((row, idx) => ({ ...row, sort: idx * 10 + 10 }));
    setDrafts(sorted);
    try {
      for (const row of [sorted[i]!, sorted[j]!]) await persist(row, true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reorder");
    }
  };

  const onNew = async (billingKind: "monthly" | "lifetime" = "monthly") => {
    const n = drafts.length + 1;
    let row = { ...blank(drafts.length * 10 + 10, n), billing_kind: billingKind };
    let bump = n;
    while (drafts.some((d) => d.slug === row.slug)) {
      bump += 1;
      row = { ...blank(drafts.length * 10 + 10, bump), billing_kind: billingKind };
    }
    setDrafts((d) => [...d, row]);
    setSelected(row.slug);

    try {
      await persist(row, true);
      await qc.invalidateQueries({ queryKey: ["admin-plans"] });
      toast.success("New draft plan created — edit it and publish when ready.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the plan");
    }
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const onSave = async () => {
    if (!plan) return;
    if (!plan.slug || !plan.name) {
      toast.error("A plan needs a name and an id.");
      return;
    }
    setBusy(true);
    try {
      await persist(plan);
      await qc.invalidateQueries({ queryKey: ["admin-plans"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!plan) return;
    if (!window.confirm(`Delete the ${plan.name} plan? Students on it move to Starter.`)) return;
    try {
      await remove({ data: { slug: plan.slug } });
      setDrafts((d) => d.filter((r) => r.slug !== plan.slug));
      setSelected(null);
      toast.success("Plan deleted");
      await qc.invalidateQueries({ queryKey: ["admin-plans"] });
      await qc.invalidateQueries({ queryKey: ["plans"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    }
  };

  if (loading || !isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#fbf5e9] text-[#23201d]">
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={label}>Admin</p>
            <h1 className="mt-2 font-display text-3xl font-black">Rita Prices</h1>
            <p className="mt-2 max-w-2xl text-[15px] text-[#5c554b]">
              Pick a plan on the left, edit it on the right. Limits are enforced on the server
              before any AI call, and the switches lock the matching tool inside the app.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNew("monthly")}
            className="inline-flex items-center gap-2 rounded-full bg-[#23201d] px-5 py-3 text-[14px] font-black text-white"
          >
            <Plus size={16} /> New plan
          </button>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
          {/* -------------------------------------------------- plan list */}
          <aside className="h-fit rounded-[24px] border border-black/[0.07] bg-white p-3 lg:sticky lg:top-6">
            {([
              { k: "monthly" as const, title: "Subscription plans (3-Month & Yearly)" },
              { k: "lifetime" as const, title: "One-time credit packs" },
            ]).map((group) => {
              const rows = drafts
                .map((p, i) => ({ p, i }))
                .filter(({ p }) => (p.billing_kind ?? "monthly") === group.k);
              return (
                <div key={group.k} className="mb-3">
                  <div className="flex items-center justify-between px-2 pb-2 pt-1">
                    <p className={label}>
                      {group.title} · {rows.length}
                    </p>
                    <button
                      type="button"
                      onClick={() => onNew(group.k)}
                      className="inline-flex items-center gap-1 rounded-full bg-[#f3efe6] px-2.5 py-1 text-[11px] font-black text-[#5c554b]"
                    >
                      <Plus size={12} /> New
                    </button>
                  </div>
                  <ul className="grid gap-1.5">
                    {rows.length === 0 && (
                      <li className="px-2 pb-2 text-[12.5px] font-semibold text-[#a29a8d]">
                        Nothing here yet.
                      </li>
                    )}
                    {rows.map(({ p, i }) => {
                      const on = p.slug === selected;
                      const onSale =
                        (p.billing_kind ?? "monthly") === "lifetime"
                          ? !!p.paddle_price_once
                          : !!p.paddle_price_monthly;
                      return (
                        <li key={p.slug}>
                          <div
                            className={`flex items-center gap-2 rounded-2xl px-3 py-2.5 transition-colors ${
                              on ? "bg-[#23201d] text-white" : "hover:bg-[#fbf5e9]"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setSelected(p.slug)}
                              className="min-w-0 flex-1 text-left"
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ background: p.published ? "#8ec63f" : "#d8d1c5" }}
                                />
                                <span className="truncate text-[14.5px] font-black">
                                  {p.name || p.slug}
                                </span>
                                {saved[p.slug] !== JSON.stringify(p) && (
                                  <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[#f0a95c]" />
                                )}
                              </span>
                              <span
                                className={`mt-0.5 block text-[12px] font-bold ${on ? "text-white/60" : "text-[#a29a8d]"}`}
                              >
                                {(p.billing_kind ?? "monthly") === "lifetime"
                                  ? `${money(p.once_cents ?? 0, p.currency)} once`
                                  : `${money(p.price_cents, p.currency)} / 3 mo`}
                                {!onSale && " · not on sale"}
                              </span>
                            </button>
                            <span className="flex shrink-0 flex-col">
                              <button
                                type="button"
                                aria-label="Move up"
                                onClick={() => move(i, -1)}
                                className={on ? "text-white/70" : "text-[#a29a8d]"}
                              >
                                <ArrowUp size={13} />
                              </button>
                              <button
                                type="button"
                                aria-label="Move down"
                                onClick={() => move(i, 1)}
                                className={on ? "text-white/70" : "text-[#a29a8d]"}
                              >
                                <ArrowDown size={13} />
                              </button>
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}

          </aside>

          {/* ------------------------------------------------ plan editor */}
          <div ref={editorRef} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
            {!plan && (
              <p className="rounded-[24px] border border-dashed border-black/15 bg-white/70 p-10 text-center font-bold text-[#7a736a]">
                Pick a plan on the left, or create a new one.
              </p>
            )}

            {plan && (
              <>
                <div className="grid gap-5">
                  <Block title="Basics">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Name">
                        <input className={input} value={plan.name} onChange={(e) => patch({ name: e.target.value })} />
                      </Field>
                      <Field label="Id (slug)">
                        <input
                          className={input}
                          value={plan.slug}
                          disabled={!!data?.some((d) => d.slug === plan.slug)}
                          onChange={(e) =>
                            patch({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Tagline">
                      <input
                        className={input}
                        value={plan.tagline ?? ""}
                        onChange={(e) => patch({ tagline: e.target.value })}
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Button text">
                        <input
                          className={input}
                          placeholder={`Get ${plan.name}`}
                          value={plan.cta_label ?? ""}
                          onChange={(e) => patch({ cta_label: e.target.value || null })}
                        />
                      </Field>
                      <div className="flex items-end gap-2">
                        <Toggle on={plan.published} label="Published" onClick={() => patch({ published: !plan.published })} />
                        <Toggle on={plan.highlight} label="Highlighted" onClick={() => patch({ highlight: !plan.highlight })} />
                      </div>
                    </div>
                  </Block>

                  <Block title="Price">
                    <div className="mb-4 inline-flex rounded-full bg-[#f3efe6] p-1">
                      {[
                        { k: "monthly" as const, label: "Recurring subscription (3-Month & Yearly)" },
                        { k: "lifetime" as const, label: "One-time pack" },
                      ].map((o) => (
                        <button
                          key={o.k}
                          type="button"
                          onClick={() => patch({ billing_kind: o.k })}
                          className={`rounded-full px-4 py-2 text-[13px] font-black transition-all ${
                            (plan.billing_kind ?? "monthly") === o.k
                              ? "bg-[#23201d] text-white"
                              : "text-[#8a8378]"
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                    {(plan.billing_kind ?? "monthly") === "lifetime" ? (
                      <>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field label="One-time price">
                            <Money value={plan.once_cents} onChange={(v) => patch({ once_cents: v ?? 0 })} />
                          </Field>
                          <Field label="Checkout price id">
                            <input
                              className={input}
                              placeholder="pack_study_once"
                              value={plan.paddle_price_once ?? ""}
                              onChange={(e) => patch({ paddle_price_once: e.target.value || null })}
                            />
                          </Field>
                          <Field label="Currency">
                            <select
                              className={input}
                              value={plan.currency ?? "USD"}
                              onChange={(e) => patch({ currency: e.target.value })}
                            >
                              {["USD", "EUR", "GBP", "JOD"].map((c) => (
                                <option key={c}>{c}</option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <p className="text-[12.5px] font-semibold text-[#a29a8d]">
                          Students pay this once and keep the credits for good. 3-Month and
                          yearly prices are ignored for a pack.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Field label="3 Months">
                            <Money value={plan.price_cents} onChange={(v) => patch({ price_cents: v ?? 0 })} />
                          </Field>
                          <Field label="Yearly">
                            <Money value={plan.yearly_cents} onChange={(v) => patch({ yearly_cents: v ?? 0 })} />
                          </Field>
                          <Field label="Currency">
                            <select
                              className={input}
                              value={plan.currency ?? "USD"}
                              onChange={(e) => patch({ currency: e.target.value })}
                            >
                              {["USD", "EUR", "GBP", "JOD"].map((c) => (
                                <option key={c}>{c}</option>
                              ))}
                            </select>
                          </Field>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="3-Month checkout price id">
                            <input
                              className={input}
                              placeholder="pro_3_months"
                              value={plan.paddle_price_monthly ?? ""}
                              onChange={(e) => patch({ paddle_price_monthly: e.target.value || null })}
                            />
                          </Field>
                          <Field label="Yearly checkout price id">
                            <input
                              className={input}
                              placeholder="pro_yearly"
                              value={plan.paddle_price_yearly ?? ""}
                              onChange={(e) => patch({ paddle_price_yearly: e.target.value || null })}
                            />
                          </Field>
                        </div>
                        <p className="text-[12.5px] font-semibold text-[#a29a8d]">
                          Type real money, e.g. 15.00 for 3 months. Yearly works out at{" "}
                          <strong className="text-[#5c554b]">
                            {money(Math.round((plan.yearly_cents || 0) / 4), plan.currency)}
                          </strong>{" "}
                          per 3 months.
                        </p>
                      </>
                    )}

                    {(() => {
                      const lifetime = (plan.billing_kind ?? "monthly") === "lifetime";
                      const paid = lifetime ? (plan.once_cents ?? 0) > 0 : (plan.price_cents ?? 0) > 0;
                      const idSet = lifetime ? !!plan.paddle_price_once : !!plan.paddle_price_monthly;
                      if (!paid || idSet) return null;
                      return (
                        <p className="rounded-2xl bg-[#fdeeea] px-4 py-3 text-[12.5px] font-bold text-[#a4423a]">
                          This plan has a price but no checkout price id, so nobody can buy it yet.
                          Add the id above.
                        </p>
                      );
                    })()}

                  </Block>

                  <Block title="Offer">
                    <div className="flex flex-wrap gap-2">
                      {RIBBONS.map((r) => (
                        <button
                          key={r.text}
                          type="button"
                          onClick={() =>
                            patch(
                              plan.ribbon_label === r.text
                                ? { ribbon_label: null, ribbon_color: null }
                                : { ribbon_label: r.text, ribbon_color: r.color },
                            )
                          }
                          className={`rounded-full px-3.5 py-1.5 text-[11.5px] font-black uppercase tracking-[0.14em] transition-transform hover:-translate-y-0.5 ${
                            plan.ribbon_label === r.text ? "text-white" : "text-[#5c554b]"
                          }`}
                          style={{
                            background: plan.ribbon_label === r.text ? r.color : "#f4f1ea",
                          }}
                        >
                          {r.text}
                        </button>
                      ))}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Custom tag">
                        <input
                          className={input}
                          placeholder="e.g. EXAM WEEK"
                          value={plan.ribbon_label ?? ""}
                          onChange={(e) =>
                            patch({
                              ribbon_label: e.target.value.toUpperCase() || null,
                              ribbon_color: plan.ribbon_color ?? "#8ec63f",
                            })
                          }
                        />
                      </Field>
                      <Field label="Compare-at price">
                        <Money
                          value={plan.compare_cents}
                          nullable
                          onChange={(v) => patch({ compare_cents: v })}
                        />
                      </Field>
                      <Field label="Offer ends">
                        <input
                          type="date"
                          className={input}
                          value={plan.offer_ends_at ? plan.offer_ends_at.slice(0, 10) : ""}
                          onChange={(e) =>
                            patch({
                              offer_ends_at: e.target.value
                                ? new Date(`${e.target.value}T23:59:59`).toISOString()
                                : null,
                            })
                          }
                        />
                      </Field>
                    </div>
                    <p className="text-[12.5px] font-semibold text-[#a29a8d]">
                      {plan.compare_cents
                        ? `Students see the old price struck through and a −${discountPercent(plan.compare_cents, plan.price_cents)}% pill.`
                        : "Set a compare-at price to show a discount pill — the percentage is worked out for you."}
                    </p>
                  </Block>

                  <Block title="Allowances (lifetime — blank means unlimited)">
                    {(plan.billing_kind ?? "monthly") === "lifetime" && (
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className={label}>Pack presets</span>
                        {[
                          { n: 200, q: 100, l: 5 },
                          { n: 400, q: 200, l: 10 },
                          { n: 600, q: 300, l: 20 },
                        ].map((preset) => (
                          <button
                            key={preset.n}
                            type="button"
                            onClick={() =>
                              patch({
                                max_flashcards: preset.n,
                                max_ai_questions: preset.q,
                                max_archive_questions: preset.q,
                                max_all_in_one_lectures: preset.l,
                                max_summaries: preset.l,
                              })
                            }
                            className="rounded-full bg-[#f3efe6] px-3 py-1.5 text-[12px] font-black text-[#5c554b] hover:bg-[#e9e3d6]"
                          >
                            {preset.n} cards
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-3">

                      <Limit
                        label="Flashcards"
                        value={plan.max_flashcards}
                        onChange={(v) => patch({ max_flashcards: v })}
                      />
                      <Limit
                        label="AI questions"
                        value={plan.max_ai_questions}
                        onChange={(v) => patch({ max_ai_questions: v })}
                      />
                      <Limit
                        label="PDF summaries"
                        value={plan.max_summaries}
                        onChange={(v) => patch({ max_summaries: v })}
                      />
                      <Limit
                        label="All-in-One lectures"
                        value={plan.max_all_in_one_lectures ?? null}
                        onChange={(v) => patch({ max_all_in_one_lectures: v })}
                      />
                      <Limit
                        label="All-in-One questions"
                        value={plan.max_all_in_one_questions ?? null}
                        onChange={(v) => patch({ max_all_in_one_questions: v })}
                      />
                      <Limit
                        label="Archive questions"
                        value={plan.max_archive_questions ?? null}
                        onChange={(v) => patch({ max_archive_questions: v })}
                      />
                      <Limit
                        label="To-do tasks"
                        value={plan.max_todo_tasks ?? null}
                        onChange={(v) => patch({ max_todo_tasks: v })}
                      />
                      <Limit
                        label="Calendar entries"
                        value={plan.max_calendar_items ?? null}
                        onChange={(v) => patch({ max_calendar_items: v })}
                      />
                      <Limit
                        label="Classrooms"
                        value={plan.max_groups ?? null}
                        onChange={(v) => patch({ max_groups: v })}
                      />
                    </div>
                    <p className="mt-2 text-[12px] font-semibold text-[#a29a8d]">
                      Set 0 to remove a tool from this plan completely. Every allowance is checked on the
                      server before any AI runs, so a big upload is refused instead of billed.
                    </p>
                  </Block>

                  <Block title="Features">
                    <div className="flex flex-wrap gap-2">
                      <Toggle on={plan.rich_cards} label="Rich card designer" onClick={() => patch({ rich_cards: !plan.rich_cards })} />
                      <Toggle on={plan.feature_ai_import} label="AI card import" onClick={() => patch({ feature_ai_import: !plan.feature_ai_import })} />
                      <Toggle on={plan.feature_review} label="Spaced repetition" onClick={() => patch({ feature_review: !plan.feature_review })} />
                      <Toggle on={plan.todo_full} label="Today & Upcoming" onClick={() => patch({ todo_full: !plan.todo_full })} />
                      <Toggle on={plan.feature_lecture_qgen !== false} label="Lecture Lab questions" onClick={() => patch({ feature_lecture_qgen: !(plan.feature_lecture_qgen !== false) })} />
                      <Toggle on={plan.feature_all_in_one !== false} label="All-in-One" onClick={() => patch({ feature_all_in_one: !(plan.feature_all_in_one !== false) })} />
                      <Toggle on={plan.feature_archive_qgen !== false} label="Archive solver" onClick={() => patch({ feature_archive_qgen: !(plan.feature_archive_qgen !== false) })} />
                    </div>
                  </Block>

                  <Block title="Extra perks">
                    <PerkList perks={plan.perks ?? []} onChange={(perks) => patch({ perks })} />
                  </Block>
                </div>

                {/* preview + sticky actions */}
                <div className="grid h-fit gap-4 xl:sticky xl:top-6">
                  <PlanPreview plan={plan} />
                  <div className="rounded-[22px] border border-black/[0.07] bg-white p-4">
                    <p className="text-[12.5px] font-bold text-[#a29a8d]">
                      {dirty ? "Unsaved changes" : "All changes saved"}
                    </p>
                    <div className="mt-3 grid gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={onSave}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-[#8ec63f] px-5 py-2.5 text-[14px] font-black text-white disabled:opacity-60"
                      >
                        <Save size={15} /> {busy ? "Saving…" : "Save plan"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={onSyncPrices}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 px-4 py-2.5 text-[14px] font-black text-[#23201d] disabled:opacity-60"
                      >
                        Send price to checkout
                      </button>
                      <button
                        type="button"
                        onClick={onDelete}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 px-4 py-2.5 text-[14px] font-black text-[#a4423a]"
                      >
                        <Trash2 size={15} /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <section className="mt-10 rounded-[26px] border border-black/[0.07] bg-white p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 text-[#4c9a2a]" size={22} />
            <div>
              <h2 className="text-[20px] font-black">Manual access</h2>
              <p className="mt-1 text-[13.5px] font-semibold text-[#7a736a]">Give free, dated access without changing or canceling a payment.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="min-w-[16rem] flex-1">
              <p className={label}>Exact email or username</p>
              <input className={input} value={who} onChange={(e) => { setWho(e.target.value); setGrantMatch(null); }} />
            </div>
            <button type="button" disabled={!who.trim()} onClick={async () => {
              try { setGrantMatch(await findStudent({ data: { query: who.trim() } })); }
              catch (e) { setGrantMatch(null); toast.error(e instanceof Error ? e.message : "Account not found"); }
            }} className="rita-btn rita-btn-secondary disabled:opacity-50"><Search size={15} /> Find account</button>
          </div>
          {grantMatch && <div className="mt-4 rounded-2xl bg-[#f5f2eb] p-4">
            <p className="font-black">{grantMatch.student.full_name || grantMatch.student.username}</p>
            <p className="text-[13px] font-semibold text-[#7a736a]">@{grantMatch.student.username} · {grantMatch.student.email}</p>
            <p className="mt-2 text-[12.5px] font-bold text-[#7a736a]">Paid access: {grantMatch.paid?.plan_slug ?? "starter"}{grantMatch.manual ? ` · Current manual access: ${grantMatch.manual.plan_slug}` : ""}</p>
          </div>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className={label}>Plan</p>
              <select className={input} value={whoPlan} onChange={(e) => setWhoPlan(e.target.value)}>
                <option value="">Choose…</option>
                {drafts.filter((p) => p.slug).map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div><p className={label}>Expires (optional)</p><input type="datetime-local" className={input} value={grantExpiry} onChange={(e) => setGrantExpiry(e.target.value)} /></div>
            <div className="sm:col-span-2"><p className={label}>Internal reason</p><input className={input} maxLength={500} value={grantReason} onChange={(e) => setGrantReason(e.target.value)} placeholder="Why this access was provided" /></div>
          </div>
          <label className="mt-4 flex items-center gap-2 text-[13px] font-bold text-[#5c554b]"><input type="checkbox" checked={grantOverride} onChange={(e) => setGrantOverride(e.target.checked)} /> Override paid access while this grant is active</label>
          <div className="mt-4">
            <button
              type="button"
              onClick={async () => {
                try {
                   const r = (await createGrant({ data: { query: who.trim(), slug: whoPlan, startsAt: new Date().toISOString(), expiresAt: grantExpiry ? new Date(grantExpiry).toISOString() : null, reason: grantReason, overridesPaid: grantOverride } })) as { who: string };
                   toast.success(`${r.who} now has manual access`);
                  setWho("");
                   setGrantMatch(null); setGrantExpiry(""); setGrantReason("");
                   await qc.invalidateQueries({ queryKey: ["admin-plan-grants"] });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not assign");
                }
              }}
              disabled={!grantMatch || !whoPlan}
              className="inline-flex items-center gap-2 rounded-full bg-[#23201d] px-5 py-3 text-[14px] font-black text-white disabled:opacity-50"
            >
              <UserPlus size={15} /> Grant access
            </button>
          </div>
          <div className="mt-8 border-t border-black/10 pt-6">
            <h3 className="text-[15px] font-black">Grant history</h3>
            <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-[13px]"><thead className="text-[#8a8378]"><tr><th className="pb-2">Student</th><th>Plan</th><th>Status</th><th>Expires</th><th>Reason</th><th></th></tr></thead><tbody>
              {grants.map((g) => { const now = Date.now(); const upcoming = new Date(g.starts_at).getTime() > now; const expired = !!g.expires_at && new Date(g.expires_at).getTime() <= now; const status = g.revoked_at ? "Revoked" : upcoming ? "Upcoming" : expired ? "Expired" : "Active"; return <tr key={g.id} className="border-t border-black/[0.07]"><td className="py-3 font-bold">{g.student?.username ?? g.student?.email ?? "Account"}</td><td>{g.plan_slug}</td><td>{status}</td><td>{g.expires_at ? new Date(g.expires_at).toLocaleString() : "No expiry"}</td><td className="max-w-[240px] truncate">{g.reason || "—"}</td><td className="text-right">{!g.revoked_at && !expired && <button type="button" aria-label="Revoke grant" onClick={async () => { await revokeGrant({ data: { id: g.id, reason: "Revoked by administrator" } }); await qc.invalidateQueries({ queryKey: ["admin-plan-grants"] }); toast.success("Access revoked"); }} className="inline-flex items-center gap-1 font-black text-[#a4423a]"><XCircle size={14} /> Revoke</button>}</td></tr>; })}
              {!grants.length && <tr><td colSpan={6} className="py-6 text-center font-semibold text-[#8a8378]">No manual access grants yet.</td></tr>}
            </tbody></table></div>
          </div>
        </section>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------ small parts */

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] border border-black/[0.07] bg-white p-5 shadow-[0_24px_50px_-48px_rgba(35,32,29,0.8)]">
      <h2 className="mb-3 text-[12px] font-black uppercase tracking-[0.18em] text-[#a29a8d]">{title}</h2>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function Field({ label: text, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={label}>{text}</p>
      {children}
    </div>
  );
}

function Money({
  value,
  onChange,
  nullable,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  nullable?: boolean;
}) {
  const [text, setText] = useState(value == null ? "" : (value / 100).toString());
  useEffect(() => {
    setText(value == null ? "" : (value / 100).toString());
  }, [value]);
  return (
    <input
      inputMode="decimal"
      className={input}
      placeholder={nullable ? "No offer" : "0.00"}
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.]/g, "");
        setText(raw);
        if (raw === "") onChange(nullable ? null : 0);
        else onChange(Math.max(0, Math.round(Number(raw) * 100) || 0));
      }}
    />
  );
}

function Limit({
  label: text,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const unlimited = value === null || value === undefined;
  return (
    <div className="rounded-2xl bg-[#fbf5e9] p-3">
      <p className={label}>{text}</p>
      <input
        type="number"
        min={0}
        disabled={unlimited}
        className={`${input} mt-1 disabled:opacity-50`}
        value={unlimited ? "" : value}
        placeholder="Unlimited"
        onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
      />
      <button
        type="button"
        onClick={() => onChange(unlimited ? 100 : null)}
        className={`mt-2 w-full rounded-full px-3 py-1.5 text-[12px] font-black ${
          unlimited ? "bg-[#e7f3d6] text-[#4d7a1f]" : "bg-white text-[#a29a8d]"
        }`}
      >
        {unlimited ? "✓ Unlimited" : "Make unlimited"}
      </button>
    </div>
  );
}

function PerkList({ perks, onChange }: { perks: string[]; onChange: (v: string[]) => void }) {
  const set = (i: number, v: string) => onChange(perks.map((p, idx) => (idx === i ? v : p)));
  const swap = (i: number, j: number) => {
    if (j < 0 || j >= perks.length) return;
    const next = [...perks];
    const a = next[i]!;
    next[i] = next[j]!;
    next[j] = a;
    onChange(next);
  };
  return (
    <div className="grid gap-2">
      {perks.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <input className={input} value={p} onChange={(e) => set(i, e.target.value)} />
          <button type="button" aria-label="Move perk up" onClick={() => swap(i, i - 1)} className="text-[#a29a8d]">
            <ArrowUp size={15} />
          </button>
          <button type="button" aria-label="Move perk down" onClick={() => swap(i, i + 1)} className="text-[#a29a8d]">
            <ArrowDown size={15} />
          </button>
          <button
            type="button"
            aria-label="Remove perk"
            onClick={() => onChange(perks.filter((_, idx) => idx !== i))}
            className="text-[#a4423a]"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button
        type="button"
        disabled={perks.length >= 12}
        onClick={() => onChange([...perks, ""])}
        className="w-fit rounded-full bg-[#f4f1ea] px-4 py-2 text-[13px] font-black text-[#5c554b] disabled:opacity-50"
      >
        <Plus size={13} className="mr-1 inline" /> Add perk
      </button>
    </div>
  );
}

/** Exactly what students will see on the pricing page. */
function PlanPreview({ plan }: { plan: AdminPlan }) {
  const lim = (n: number | null, word: string) =>
    n === null ? `Unlimited ${word}` : `${n.toLocaleString()} ${word} included`;
  const ticks = useMemo(
    () => [
      lim(plan.max_flashcards, "flashcards"),
      lim(plan.max_ai_questions, "AI questions"),
      lim(plan.max_summaries, "PDF summaries"),
      ...(plan.rich_cards ? ["Rich card designer"] : []),
      ...(plan.feature_ai_import ? ["AI card import"] : []),
      ...(plan.feature_review ? ["Spaced repetition"] : []),
      ...(plan.todo_full ? ["Today & Upcoming planner"] : []),
      ...(plan.perks ?? []).filter(Boolean),
    ],
    [plan],
  );
  const off = offerLive(plan.offer_ends_at) ? discountPercent(plan.compare_cents, plan.price_cents) : 0;
  return (
    <div className="rounded-2xl bg-[#fbf5e9] p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a29a8d]">Live preview</p>
      <div
        className={`relative mt-2 overflow-hidden rounded-[22px] bg-white p-5 ${
          plan.highlight ? "ring-2 ring-[#4c9a2a]" : "border border-black/[0.07]"
        }`}
      >
        <OfferRibbon label={plan.ribbon_label} color={plan.ribbon_color} endsAt={plan.offer_ends_at} />
        <p className="mt-2 text-[19px] font-black">{plan.name || "Untitled plan"}</p>
        {plan.tagline && <p className="text-[13.5px] font-semibold text-[#8a7f6c]">{plan.tagline}</p>}
        <div className="mt-3 flex items-end gap-2">
          <p className="font-display text-[30px] font-black leading-none">
            {money(plan.price_cents, plan.currency)}
          </p>
          {off > 0 && (
            <>
              <span className="pb-1 text-[13px] font-bold text-[#b6ada0] line-through">
                {money(plan.compare_cents ?? 0, plan.currency)}
              </span>
              <span className="mb-0.5 rounded-full bg-[#d1795e] px-2 py-0.5 text-[11px] font-black text-white">
                −{off}%
              </span>
            </>
          )}
        </div>
        <p className="text-[12.5px] font-bold text-[#a29a8d]">
          {(plan.billing_kind ?? "monthly") === "lifetime"
            ? "one-time payment"
            : `for 3 months · or ${money(plan.yearly_cents, plan.currency)} per year`}
        </p>
        <div className="mt-4 flex h-10 items-center justify-center rounded-full bg-[#4c9a2a] text-[13.5px] font-black text-white">
          {plan.cta_label || "Choose plan"}
        </div>
        <ul className="mt-4 space-y-1.5">
          {ticks.map((t) => (
            <li key={t} className="flex items-start gap-2 text-[13.5px] font-semibold text-[#3c372f]">
              <Check size={15} className="mt-0.5 shrink-0 text-[#4c9a2a]" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Toggle({ on, label: text, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-[13px] font-black transition-colors ${
        on ? "bg-[#e7f3d6] text-[#4d7a1f]" : "bg-[#f1eee8] text-[#a29a8d]"
      }`}
    >
      {on ? "✓ " : "○ "}
      {text}
    </button>
  );
}
