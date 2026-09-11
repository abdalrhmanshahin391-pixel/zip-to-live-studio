import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Archive,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Layers,
  Plus,
  Sparkles,
  Tag,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { guardRedirect } from "@/lib/guard-redirect";
import {
  adminCreateDiscount,
  adminListDiscounts,
  adminUpdateDiscount,
} from "@/lib/promo.functions";

export const Route = createFileRoute("/admin/promo-codes")({
  head: () => ({
    meta: [
      { title: "Promo codes — RitaJet admin" },
      {
        name: "description",
        content: "Create fast, simple discount codes that apply across all plans at checkout.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Promo codes — RitaJet admin" },
    ],
  }),
  component: PromoCodesPage,
});

type Env = "sandbox" | "live";

function PromoCodesPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [env, setEnv] = useState<Env>("sandbox");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const list = useServerFn(adminListDiscounts);
  const create = useServerFn(adminCreateDiscount);
  const update = useServerFn(adminUpdateDiscount);

  useEffect(() => {
    if (!loading && !isAdmin) guardRedirect(navigate);
  }, [loading, isAdmin, navigate]);

  const codes = useQuery({
    queryKey: ["promo-codes", env],
    queryFn: () => list({ data: { environment: env } }),
    enabled: isAdmin,
  });

  const [form, setForm] = useState({
    code: "",
    type: "percentage" as "percentage" | "flat",
    amount: 20,
    recur: true,
    usage_limit: "",
    expires_at: "",
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = form.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (cleanCode.length < 3) {
      toast.error("Code must be at least 3 letters/numbers");
      return;
    }

    setSaving(true);
    try {
      await create({
        data: {
          environment: env,
          code: cleanCode,
          description: `${cleanCode} discount`,
          type: form.type,
          amount: Number(form.amount),
          currency_code: "USD",
          recur: form.recur,
          maximum_recurring_intervals: null,
          usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
          expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
          restrict_to: [], // Empty array = applies universally to ALL plans
        },
      });
      toast.success(`Promo code ${cleanCode} created for all plans!`);
      setForm({
        code: "",
        type: "percentage",
        amount: 20,
        recur: true,
        usage_limit: "",
        expires_at: "",
      });
      setShowAdvanced(false);
      qc.invalidateQueries({ queryKey: ["promo-codes", env] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create that code");
    } finally {
      setSaving(false);
    }
  };

  const copyCode = (codeText: string, id: string) => {
    if (!codeText) return;
    navigator.clipboard.writeText(codeText);
    setCopiedId(id);
    toast.success(`Copied "${codeText}" to clipboard`);
    setTimeout(() => setCopiedId(null), 2000);
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
      <main className="mx-auto max-w-4xl px-4 py-12 md:px-8">
        {/* Header & Mode Switch */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#7a4b16]">
              <Tag size={13} /> Admin
            </span>
            <h1 className="mt-3 font-display text-3xl font-black md:text-4xl">Promo codes</h1>
            <p className="mt-1 text-[14.5px] text-[#5c554b]">
              Create discount codes that apply directly to checkout across all plans.
            </p>
          </div>
          <div className="inline-flex rounded-full border border-black/[0.08] bg-white p-1 shadow-sm">
            {(["sandbox", "live"] as Env[]).map((e) => (
              <button
                key={e}
                onClick={() => setEnv(e)}
                className={`rounded-full px-4 py-1.5 text-[13px] font-black transition-colors ${
                  env === e ? "bg-[#23201d] text-white" : "text-[#6b655c] hover:bg-black/[0.05]"
                }`}
              >
                {e === "sandbox" ? "Test mode" : "Live mode"}
              </button>
            ))}
          </div>
        </div>

        {/* Simplified 1-Click Creator */}
        <section className="mt-8 rounded-[24px] border border-black/[0.08] bg-white p-6 shadow-sm md:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-[#8ec63f]/20 text-[#4c7c1a]">
                <Sparkles size={16} />
              </div>
              <h2 className="font-display text-xl font-black">Quick create code</h2>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf4dd] px-3 py-1 text-[12px] font-bold text-[#3d6515]">
              <Layers size={13} /> Applies to all plans
            </span>
          </div>

          <form onSubmit={submit} className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Code Name */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a29a8d]">
                  Code name
                </label>
                <div className="mt-1.5 relative">
                  <input
                    className="w-full rounded-xl border-2 border-black/10 bg-white px-3.5 py-2.5 text-base font-black tracking-wider uppercase outline-none focus:border-[#8ec63f]"
                    value={form.code}
                    maxLength={32}
                    onChange={(e) =>
                      setForm({ ...form, code: e.target.value.replace(/[^A-Za-z0-9]/g, "") })
                    }
                    placeholder="e.g. SAVE20"
                    required
                  />
                </div>
                <p className="mt-1 text-[11.5px] text-[#a29a8d]">Only letters and numbers</p>
              </div>

              {/* Discount Amount & Type */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a29a8d]">
                  Discount value
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="w-full rounded-xl border-2 border-black/10 bg-white px-3.5 py-2.5 text-base font-black outline-none focus:border-[#8ec63f]"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    required
                  />
                  <div className="inline-flex shrink-0 rounded-xl border border-black/10 bg-muted/40 p-1">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: "percentage" })}
                      className={`rounded-lg px-3 py-1 text-[13px] font-black transition-all ${
                        form.type === "percentage"
                          ? "bg-white text-foreground shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      % Percent
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, type: "flat" })}
                      className={`rounded-lg px-3 py-1 text-[13px] font-black transition-all ${
                        form.type === "flat"
                          ? "bg-white text-foreground shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      $ USD
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-[11.5px] text-[#a29a8d]">
                  {form.type === "percentage"
                    ? `Students will receive ${form.amount}% off at checkout`
                    : `Students will receive $${form.amount} off at checkout`}
                </p>
              </div>
            </div>

            {/* Recur checkbox */}
            <div className="mt-4">
              <label className="flex items-center gap-2 text-[13.5px] font-bold text-[#4a453d] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.recur}
                  onChange={(e) => setForm({ ...form, recur: e.target.checked })}
                  className="h-4 w-4 rounded accent-[#8ec63f]"
                />
                Apply discount to recurring renewals as well
              </label>
            </div>

            {/* Expandable Advanced Options */}
            <div className="mt-5 border-t border-black/[0.06] pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#7a736a] hover:text-black"
              >
                {showAdvanced ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                {showAdvanced ? "Hide limits & expiration" : "Optional limits & expiration"}
              </button>

              {showAdvanced && (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 animate-in fade-in duration-200">
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a29a8d]">
                      Max uses (leave blank for unlimited)
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#8ec63f]"
                      value={form.usage_limit}
                      onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                      placeholder="e.g. 50"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a29a8d]">
                      Expiration date (leave blank for never)
                    </label>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#8ec63f]"
                      value={form.expires_at}
                      onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Create CTA */}
            <div className="mt-6 flex items-center justify-between border-t border-black/[0.06] pt-5">
              <span className="text-[13px] font-semibold text-[#6b655c]">
                Ready to publish in Paddle ({env === "sandbox" ? "Test" : "Live"})
              </span>
              <button
                type="submit"
                disabled={saving || form.code.trim().length < 3}
                className="inline-flex items-center gap-2 rounded-full bg-[#23201d] px-6 py-3 text-[14px] font-black text-white transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-40"
              >
                <Plus size={16} /> {saving ? "Creating…" : "Create code for all plans"}
              </button>
            </div>
          </form>
        </section>

        {/* List of Existing Codes */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-black">All active & past codes</h2>
            <span className="text-[13px] font-bold text-[#7a736a]">
              {(codes.data?.length ?? 0)} code{(codes.data?.length ?? 0) === 1 ? "" : "s"}
            </span>
          </div>

          {codes.isLoading ? (
            <p className="mt-4 text-[#6b655c]">Loading promo codes…</p>
          ) : codes.error ? (
            <p className="mt-4 text-[#a4321f]">
              {(codes.error as Error).message || "Could not load codes."}
            </p>
          ) : (codes.data?.length ?? 0) === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-black/15 bg-white/40 p-8 text-center text-[#6b655c]">
              No promo codes found in {env === "sandbox" ? "Test mode" : "Live mode"}. Create one above!
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {codes.data!.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/[0.07] bg-white px-5 py-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-display text-[18px] font-black tracking-wider text-[#23201d]">
                      {d.code ?? "—"}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyCode(d.code, d.id)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-[#7a736a] transition-colors hover:bg-black/[0.06] hover:text-black"
                      title="Copy code"
                    >
                      {copiedId === d.id ? (
                        <Check size={14} className="text-green-600" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                    <span className="rounded-full bg-[#e6f4d8] px-3 py-1 text-[12px] font-black text-[#3d5c14]">
                      {d.type === "percentage"
                        ? `${d.amount}% off`
                        : `$${(Number(d.amount) / 100).toFixed(2)} off`}
                    </span>
                    <span className="hidden rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[11px] font-bold text-[#6b655c] sm:inline-block">
                      All plans
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-medium text-[#6b655c]">
                      {d.times_used}
                      {d.usage_limit ? ` / ${d.usage_limit}` : ""} used
                      {d.expires_at
                        ? ` · ends ${new Date(d.expires_at).toLocaleDateString()}`
                        : ""}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-[11.5px] font-black ${
                        d.status === "active"
                          ? "bg-[#e6f4d8] text-[#3d5c14]"
                          : "bg-black/[0.06] text-[#6b655c]"
                      }`}
                    >
                      {d.status}
                    </span>

                    {d.status === "active" && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            act(d.id, { enabled_for_checkout: !d.enabled_for_checkout })
                          }
                          className="rounded-full border border-black/10 px-3 py-1 text-[12px] font-bold text-[#6b655c] transition-colors hover:bg-black/[0.05]"
                        >
                          {d.enabled_for_checkout ? "Pause" : "Resume"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm(`Archive ${d.code}? Students will no longer be able to use it.`))
                              return;
                            act(d.id, { status: "archived" });
                          }}
                          className="grid h-8 w-8 place-items-center rounded-xl text-[#8e8579] transition-colors hover:bg-red-50 hover:text-red-600"
                          title="Archive code"
                        >
                          <Archive size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

