import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Archive, Plus, Tag } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import {
  adminCreateDiscount,
  adminListDiscounts,
  adminListPaddlePrices,
  adminUpdateDiscount,
} from "@/lib/promo.functions";

export const Route = createFileRoute("/admin/promo-codes")({
  head: () => ({
    meta: [
      { title: "Promo codes — RitaJet admin" },
      {
        name: "description",
        content: "Create and manage discount codes students can use at checkout.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Promo codes — RitaJet admin" },
      {
        property: "og:description",
        content: "Percentage or fixed discount codes, usage limits and expiry dates.",
      },
    ],
  }),
  component: PromoCodesPage,
});

const input =
  "w-full rounded-xl border-2 border-black/10 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#8ec63f]";
const label = "text-[11px] font-black uppercase tracking-[0.16em] text-[#a29a8d]";
const pill =
  "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-black transition";

type Env = "sandbox" | "live";

function PromoCodesPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [env, setEnv] = useState<Env>("sandbox");

  const list = useServerFn(adminListDiscounts);
  const create = useServerFn(adminCreateDiscount);
  const update = useServerFn(adminUpdateDiscount);
  const prices = useServerFn(adminListPaddlePrices);

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

  const codes = useQuery({
    queryKey: ["promo-codes", env],
    queryFn: () => list({ data: { environment: env } }),
    enabled: isAdmin,
  });
  const catalog = useQuery({
    queryKey: ["promo-prices", env],
    queryFn: () => prices({ data: { environment: env } }),
    enabled: isAdmin,
  });

  const [form, setForm] = useState({
    code: "",
    description: "",
    type: "percentage" as "percentage" | "flat",
    amount: 10,
    usage_limit: "",
    expires_at: "",
    recur: false,
    maximum_recurring_intervals: "",
    restrict_to: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await create({
        data: {
          environment: env,
          code: form.code.trim().toUpperCase(),
          description: form.description.trim() || `${form.code} discount`,
          type: form.type,
          amount: Number(form.amount),
          currency_code: "USD",
          recur: form.recur,
          maximum_recurring_intervals: form.maximum_recurring_intervals
            ? Number(form.maximum_recurring_intervals)
            : null,
          usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
          expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
          restrict_to: form.restrict_to,
        },
      });
      toast.success("Promo code created");
      setForm({ ...form, code: "", description: "" });
      qc.invalidateQueries({ queryKey: ["promo-codes", env] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create that code");
    } finally {
      setSaving(false);
    }
  };

  const act = async (id: string, patch: Record<string, unknown>) => {
    try {
      await update({ data: { environment: env, id, ...(patch as any) } });
      qc.invalidateQueries({ queryKey: ["promo-codes", env] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update that code");
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#7a4b16]">
              <Tag size={13} /> Promo codes
            </span>
            <h1 className="mt-5 font-display text-4xl font-black">Discount codes</h1>
            <p className="mt-2 max-w-xl text-[15px] text-[#4a453d]">
              Codes are created straight in the payment system, so the discount is real money off at
              checkout — not just a label.
            </p>
          </div>
          <div className="inline-flex rounded-full border border-black/[0.08] bg-white p-1">
            {(["sandbox", "live"] as Env[]).map((e) => (
              <button
                key={e}
                onClick={() => setEnv(e)}
                className={`rounded-full px-4 py-2 text-[13px] font-black ${
                  env === e ? "bg-[#23201d] text-white" : "text-[#6b655c] hover:bg-black/[0.05]"
                }`}
              >
                {e === "sandbox" ? "Test" : "Live"}
              </button>
            ))}
          </div>
        </div>

        {/* create */}
        <section className="mt-8 rounded-[26px] border border-black/[0.07] bg-white p-6">
          <h2 className="font-display text-xl font-black">New code</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div>
              <p className={label}>Code</p>
              <input
                className={`${input} mt-1 uppercase`}
                value={form.code}
                maxLength={32}
                onChange={(e) =>
                  setForm({ ...form, code: e.target.value.replace(/[^A-Za-z0-9]/g, "") })
                }
                placeholder="STUDY20"
              />
            </div>
            <div className="md:col-span-2">
              <p className={label}>Internal note</p>
              <input
                className={`${input} mt-1`}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Autumn student campaign"
              />
            </div>
            <div>
              <p className={label}>Type</p>
              <select
                className={`${input} mt-1`}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
              >
                <option value="percentage">Percentage off</option>
                <option value="flat">Fixed amount off (USD)</option>
              </select>
            </div>
            <div>
              <p className={label}>{form.type === "percentage" ? "Percent" : "Amount (USD)"}</p>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className={`${input} mt-1`}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              />
            </div>
            <div>
              <p className={label}>Total uses (blank = unlimited)</p>
              <input
                type="number"
                min="1"
                className={`${input} mt-1`}
                value={form.usage_limit}
                onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
              />
            </div>
            <div>
              <p className={label}>Expires (blank = never)</p>
              <input
                type="date"
                className={`${input} mt-1`}
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              />
            </div>
            <div>
              <p className={label}>Repeat on renewals</p>
              <label className="mt-2 flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={form.recur}
                  onChange={(e) => setForm({ ...form, recur: e.target.checked })}
                />
                Keep the discount on later months
              </label>
            </div>
            {form.recur && (
              <div>
                <p className={label}>How many billing periods (blank = forever)</p>
                <input
                  type="number"
                  min="1"
                  className={`${input} mt-1`}
                  value={form.maximum_recurring_intervals}
                  onChange={(e) =>
                    setForm({ ...form, maximum_recurring_intervals: e.target.value })
                  }
                />
              </div>
            )}
          </div>

          <div className="mt-5">
            <p className={label}>Limit to plans (nothing ticked = every plan)</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(catalog.data ?? []).map((p) => {
                const on = form.restrict_to.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() =>
                      setForm({
                        ...form,
                        restrict_to: on
                          ? form.restrict_to.filter((x) => x !== p.id)
                          : [...form.restrict_to, p.id],
                      })
                    }
                    className={`rounded-full border px-4 py-2 text-[12.5px] font-black ${
                      on
                        ? "border-transparent bg-[#8ec63f] text-white"
                        : "border-black/10 bg-white text-[#6b655c]"
                    }`}
                  >
                    {p.externalId ?? p.description}
                  </button>
                );
              })}
              {catalog.isLoading && <span className="text-sm text-[#6b655c]">Loading plans…</span>}
            </div>
          </div>

          <button
            onClick={submit}
            disabled={saving || form.code.trim().length < 3}
            className={`${pill} mt-6 bg-[#23201d] text-white disabled:opacity-40`}
          >
            <Plus size={15} /> {saving ? "Creating…" : "Create code"}
          </button>
        </section>

        {/* list */}
        <section className="mt-8">
          <h2 className="font-display text-xl font-black">All codes</h2>
          {codes.isLoading ? (
            <p className="mt-4 text-[#6b655c]">Loading…</p>
          ) : codes.error ? (
            <p className="mt-4 text-[#a4321f]">
              {(codes.error as Error).message || "Could not load codes."}
            </p>
          ) : (codes.data?.length ?? 0) === 0 ? (
            <p className="mt-4 text-[#6b655c]">No codes here yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {codes.data!.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/[0.07] bg-white px-5 py-4"
                >
                  <span className="font-display text-[17px] font-black">{d.code ?? "—"}</span>
                  <span className="rounded-full bg-[#e6f4d8] px-3 py-1 text-[12px] font-black text-[#3d5c14]">
                    {d.type === "percentage"
                      ? `${d.amount}% off`
                      : `$${(Number(d.amount) / 100).toFixed(2)} off`}
                  </span>
                  <span className="text-[13px] font-bold text-[#6b655c]">
                    {d.times_used}
                    {d.usage_limit ? ` / ${d.usage_limit}` : ""} used
                    {d.expires_at
                      ? ` · ends ${new Date(d.expires_at).toLocaleDateString()}`
                      : ""}
                    {d.recur ? " · repeats" : ""}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-black ${
                      d.status === "active"
                        ? "bg-[#e6f4d8] text-[#3d5c14]"
                        : "bg-black/[0.06] text-[#6b655c]"
                    }`}
                  >
                    {d.status}
                  </span>
                  <span className="ms-auto flex items-center gap-2">
                    {d.status === "active" && (
                      <>
                        <button
                          onClick={() =>
                            act(d.id, { enabled_for_checkout: !d.enabled_for_checkout })
                          }
                          className="rounded-full border border-black/10 px-4 py-2 text-[12.5px] font-black text-[#6b655c] hover:bg-black/[0.05]"
                        >
                          {d.enabled_for_checkout ? "Turn off" : "Turn on"}
                        </button>
                        <button
                          onClick={() => {
                            if (!confirm(`Archive ${d.code}? It can no longer be used.`)) return;
                            act(d.id, { status: "archived" });
                          }}
                          className="grid h-9 w-9 place-items-center rounded-xl text-[#6b655c] hover:bg-red-50 hover:text-red-600"
                          aria-label="Archive code"
                        >
                          <Archive size={16} />
                        </button>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
