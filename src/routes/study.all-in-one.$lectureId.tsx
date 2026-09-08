import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Layers,
  ListChecks,
  Loader2,
  MessageCircle,
  RotateCcw,
  ScrollText,
  Send,
  Sparkles,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { aioAsk, aioLoad } from "@/lib/all-in-one.functions";
import { friendlyError } from "@/lib/pdf-text";
import { GuideDoc } from "@/components/study/GuideDoc";

export const Route = createFileRoute("/study/all-in-one/$lectureId")({
  component: AllInOneWorkspace,
  head: () => ({
    meta: [
      { title: "Your lecture workspace | RitaJet" },
      {
        name: "description",
        content: "Study guide, summary, flashcards and questions from one lecture, side by side in one workspace.",
      },
      { property: "og:title", content: "Your lecture workspace" },
      { property: "og:description", content: "Everything from one lecture, in one place." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ACCENT = "#3f2c73";
type Tab = "guide" | "summary" | "cards" | "questions" | "ask";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "guide", label: "Study guide", icon: <ScrollText size={16} /> },
  { key: "summary", label: "Summary", icon: <Sparkles size={16} /> },
  { key: "cards", label: "Flashcards", icon: <Layers size={16} /> },
  { key: "questions", label: "Questions", icon: <ListChecks size={16} /> },
  { key: "ask", label: "Ask this lecture", icon: <MessageCircle size={16} /> },
];

/** Organised guide/summary reader lives in GuideDoc. */


function AllInOneWorkspace() {
  const { lectureId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const load = useServerFn(aioLoad);
  const ask = useServerFn(aioAsk);

  const [tab, setTab] = useState<Tab>("guide");
  const [busy, setBusy] = useState(true);
  const [data, setData] = useState<any>(null);

  const [flip, setFlip] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState("");
  const [chat, setChat] = useState<{ me: string; rita: string }[]>([]);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!user) return;
    setBusy(true);
    load({ data: { lectureId } })
      .then((r: any) => setData(r))
      .catch((e) => toast.error(friendlyError(e)))
      .finally(() => setBusy(false));
  }, [user, lectureId, load]);

  const material = useMemo(() => {
    if (!data) return "";
    return [data.guide, data.short, ...(data.cards ?? []).map((c: any) => `${c.front} — ${c.back}`)]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 50_000);
  }, [data]);

  async function send() {
    const question = q.trim();
    if (!question || asking || material.length < 20) return;
    setAsking(true);
    setQ("");
    try {
      const r: any = await ask({ data: { question, context: material, title: data?.lecture?.title ?? "Lecture" } });
      setChat((c) => [...c, { me: question, rita: r.answer }]);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setAsking(false);
    }
  }

  if (busy) {
    return (
      <div className="min-h-screen bg-[#fbf5e9]">
        <SiteHeader />
        <div className="grid place-items-center py-32 text-[#6b6357]">
          <Loader2 className="animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#fbf5e9]">
        <SiteHeader />
        <div className="mx-auto max-w-[700px] px-4 py-24 text-center">
          <p className="text-[16px] font-bold">We could not open that lecture.</p>
          <Link to="/study/all-in-one" className="mt-4 inline-block rounded-full bg-[#23201d] px-5 py-3 text-[14px] font-extrabold text-white">
            Upload another one
          </Link>
        </div>
      </div>
    );
  }

  const points: string[] = data.lecture?.key_points ?? [];

  return (
    <div className="min-h-screen bg-[#fbf5e9] text-[#23201d]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1080px] px-4 pb-24 pt-8">
        <Link
          to="/study/all-in-one"
          className="inline-flex items-center gap-2 text-[13px] font-extrabold text-[#6b6357] hover:text-[#23201d]"
        >
          <ArrowLeft size={15} /> New all-in-one lecture
        </Link>

        <header className="mt-4">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em]"
            style={{ background: "#e7dcf7", color: ACCENT }}
          >
            All in one
          </div>
          <h1 className="mt-3 font-display text-[30px] font-black leading-tight sm:text-[38px]">{data.lecture.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { l: "Flashcards", v: data.cards.length },
              { l: "Questions", v: data.questions.length },
              { l: "Key points", v: points.length },
            ].map((s) => (
              <span
                key={s.l}
                className="rounded-full border border-black/[0.08] bg-[#fbf8f2] px-3 py-1.5 text-[12px] font-extrabold text-[#6b6357]"
              >
                {s.v} {s.l.toLowerCase()}
              </span>
            ))}
          </div>
        </header>

        <div className="mt-6 grid gap-5 lg:grid-cols-[220px_1fr]">
          <nav className="flex gap-2 overflow-x-auto lg:sticky lg:top-24 lg:h-fit lg:flex-col lg:overflow-visible">
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-3 text-left text-[14px] font-extrabold transition"
                  style={
                    on
                      ? { background: ACCENT, color: "#fff", borderColor: "transparent", boxShadow: `0 14px 30px -18px ${ACCENT}` }
                      : { background: "#fff", color: "#3d3833", borderColor: "rgba(0,0,0,0.08)" }
                  }
                >
                  {t.icon}
                  {t.label}
                </button>
              );
            })}
          </nav>

          <section
            className={
              tab === "guide" || tab === "summary"
                ? ""
                : "rounded-[26px] border border-black/[0.07] bg-white p-5 sm:p-7"
            }
          >
            {tab === "guide" &&
              (data.guide ? (
                <GuideDoc text={data.guide} />
              ) : (
                <p className="text-[15px] text-[#6b6357]">No study guide was written for this lecture.</p>
              ))}

            {tab === "summary" && (
              <div>
                {data.short ? <GuideDoc text={data.short} /> : <p className="text-[15px] text-[#6b6357]">No summary yet.</p>}
                {points.length > 0 && (
                  <div className="mt-6 rounded-2xl bg-[#faf6ee] p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a89e90]">Key points</div>
                    <ul className="mt-2 space-y-1.5">
                      {points.map((p, i) => (
                        <li key={i} className="flex gap-2 text-[14.5px] leading-[1.6]">
                          <span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ACCENT }} />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {tab === "cards" &&
              (data.cards.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {data.cards.map((c: any) => {
                    const on = !!flip[c.id];
                    return (
                      <button
                        key={c.id}
                        onClick={() => setFlip((f) => ({ ...f, [c.id]: !f[c.id] }))}
                        className="min-h-[132px] rounded-2xl border border-black/[0.08] p-4 text-left transition hover:-translate-y-0.5"
                        style={{ background: on ? "#faf6ee" : "#fff" }}
                      >
                        <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a89e90]">
                          {on ? "Answer" : "Card"}
                        </div>
                        <div className="mt-2 text-[15px] font-bold leading-[1.5]">{on ? c.back : c.front}</div>
                        <div className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-extrabold text-[#a29a8d]">
                          <RotateCcw size={13} /> Tap to flip
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[15px] text-[#6b6357]">No flashcards for this lecture.</p>
              ))}

            {tab === "questions" && (
              <div>
                <p className="text-[15px] text-[#6b6357]">
                  {data.questions.length} question{data.questions.length === 1 ? "" : "s"} are ready with full
                  explanations.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["study", "session", "exam"] as const).map((m) => (
                    <button
                      key={m}
                      disabled={!data.questions.length}
                      onClick={() =>
                        void navigate({
                          to: "/study/lectures/run",
                          search: { ids: lectureId, mode: m, pool: "all", minutes: m === "exam" ? 20 : 0 },
                        })
                      }
                      className="rounded-full px-5 py-3 text-[14px] font-extrabold transition disabled:opacity-40"
                      style={
                        m === "exam"
                          ? { background: "#23201d", color: "#fff" }
                          : m === "session"
                            ? { background: ACCENT, color: "#fff" }
                            : { background: "#fff", color: "#23201d", border: "1px solid rgba(0,0,0,0.1)" }
                      }
                    >
                      {m === "study" ? "Study mode" : m === "session" ? "Session mode" : "Timed exam"}
                    </button>
                  ))}
                </div>
                <div className="mt-6 space-y-3">
                  {data.questions.slice(0, 5).map((qq: any, i: number) => (
                    <div key={qq.id} className="rounded-2xl bg-[#faf6ee] p-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#a89e90]">
                        Preview {i + 1}
                      </div>
                      <div className="mt-1 text-[15px] font-bold leading-[1.5]">{qq.stem}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "ask" && (
              <div>
                <p className="text-[15px] text-[#6b6357]">
                  Ask anything about this lecture. Rita answers only from this material.
                </p>
                <div className="mt-4 space-y-4">
                  {chat.map((c, i) => (
                    <div key={i}>
                      <div className="ml-auto w-fit max-w-[85%] rounded-2xl px-4 py-2.5 text-[14.5px] font-bold text-white" style={{ background: ACCENT }}>
                        {c.me}
                      </div>
                      <div className="mt-2 w-fit max-w-[92%] rounded-2xl bg-[#faf6ee] px-4 py-3 text-[15px] leading-[1.6]">
                        {c.rita}
                      </div>
                    </div>
                  ))}
                  {asking && (
                    <div className="flex items-center gap-2 text-[14px] font-bold text-[#a29a8d]">
                      <Loader2 size={15} className="animate-spin" /> Reading your lecture…
                    </div>
                  )}
                </div>
                <div className="mt-5 flex gap-2">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void send();
                    }}
                    placeholder="e.g. Why does preload fall here?"
                    className="h-12 flex-1 rounded-xl border border-black/10 bg-[#fbf8f2] px-4 text-[14.5px] font-semibold"
                  />
                  <button
                    onClick={() => void send()}
                    disabled={asking || !q.trim()}
                    className="grid h-12 w-12 place-items-center rounded-xl text-white disabled:opacity-40"
                    style={{ background: "#23201d" }}
                  >
                    <Send size={17} />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
