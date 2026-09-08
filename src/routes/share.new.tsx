import { RequireAuth } from "@/components/study/RequireAuth";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { refreshSpace } from "@/lib/spaces";
import { ArrowLeft, Check, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { readBoardWithCounts, readTopicCards } from "@/lib/local-board";
import { DECK_COVERS, coverOf, publishDeck } from "@/lib/share-decks";

export const Route = createFileRoute("/share/new")({
  // ?space=<id> builds a deck that lives only inside that classroom or group.
  validateSearch: (search: Record<string, unknown>) => ({
    space: typeof search.space === "string" ? search.space : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Share your flashcards | RitaJet" },
      {
        name: "description",
        content:
          "Pick the subjects and sub-subjects you want to share and publish them as a flashcard deck other students can study.",
      },
      { property: "og:title", content: "Share your flashcards on RitaJet" },
      {
        property: "og:description",
        content: "Publish your subjects as a deck other students can study and save.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireAuth what="your shared decks">
      <ShareNew />
    </RequireAuth>
  ),
});

const EMOJIS = ["🃏", "🧠", "💊", "🫀", "🦴", "🔬", "📚", "🇩🇪", "⚡️", "🌿"];

/** Stable key for one sub-subject inside the local board. */
const keyOf = (subject: string, sub: string) => `${subject}///${sub}`;

function ShareNew() {
  const { space: spaceId } = Route.useSearch();
  const toSpace = !!spaceId;
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState("apricot");
  const [emoji, setEmoji] = useState("🃏");
  const [tagText, setTagText] = useState("");
  const [saving, setSaving] = useState(false);
  const [board, setBoard] = useState<ReturnType<typeof readBoardWithCounts>>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    setBoard(readBoardWithCounts());
  }, []);

  const total = useMemo(
    () =>
      board.reduce(
        (n, s) => n + s.subs.reduce((m, x) => m + (picked.has(keyOf(s.name, x.name)) ? x.count : 0), 0),
        0,
      ),
    [board, picked],
  );

  function toggle(keys: string[]) {
    setPicked((prev) => {
      const next = new Set(prev);
      const on = !keys.every((k) => next.has(k));
      for (const k of keys) (on ? next.add(k) : next.delete(k));
      return next;
    });
  }

  async function publish() {
    if (!title.trim()) return toast.error("Give your deck a title");
    setSaving(true);
    try {
      const tags = tagText
        .split(/[,\s]+/)
        .map((t) => t.replace(/^#/, "").trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 6);
      const groups = board.flatMap((s) =>
        s.subs
          .filter((x) => picked.has(keyOf(s.name, x.name)))
          .map((x) => ({
            name: s.subs.length > 1 ? `${s.name} · ${x.name}` : s.name,
            cards: readTopicCards(s.name, x.name).map((c) => ({ front: c.front, back: c.back })),
          })),
      );
      const id = await publishDeck({
        title,
        description,
        cover,
        emoji,
        tags,
        groups,
        spaceId: spaceId ?? null,
      });
      if (spaceId) {
        toast.success("Deck added to your space — only its members can see it.");
        // Drop the space's cached deck/folder lists first, otherwise the page we
        // land on shows the copy it had before this deck existed until a reload.
        await refreshSpace(qc, spaceId);
        navigate({ to: "/spaces/$spaceId", params: { spaceId } });
      } else {
        toast.success("Deck shared with everyone!");
        navigate({ to: "/share/$deckId", params: { deckId: id } });
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not share this deck");
    } finally {
      setSaving(false);
    }
  }

  const c = coverOf(cover);

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-20">
        {toSpace ? (
          <Link
            to="/spaces/$spaceId"
            params={{ spaceId: spaceId! }}
            className="inline-flex items-center gap-1.5 text-sm font-black text-[#6b655c] hover:text-[#23201d]"
          >
            <ArrowLeft size={15} /> Back to your space
          </Link>
        ) : (
          <Link to="/share" className="inline-flex items-center gap-1.5 text-sm font-black text-[#6b655c] hover:text-[#23201d]">
            <ArrowLeft size={15} /> Shared flashcards
          </Link>
        )}
        <h1 className="mt-5 font-display text-4xl font-black tracking-tight">
          {toSpace ? "Make a deck for your space" : "Share flashcards with everyone"}
        </h1>
        <p className="mt-2 max-w-xl text-[#6b655c]">
          {toSpace
            ? "Tick the subjects you want to include. Only the members of this classroom or group will see this deck — it never shows up on the public flashcards page."
            : "Tick the subjects or sub-subjects you want to include. A snapshot of those cards becomes a deck everyone on RitaJet can find and save."}
        </p>
        <p
          className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-black ${
            toSpace ? "bg-[#eef7e4] text-[#3f6a17]" : "bg-[#fdf0d8] text-[#8a6a1f]"
          }`}
        >
          {toSpace ? "🔒 Space members only" : "🌍 Everyone on RitaJet"}
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-[26px] border border-black/[0.07] bg-white p-6">
            <h2 className="font-display text-lg font-black">Pick subjects</h2>
            {board.length === 0 ? (
              <p className="mt-4 text-sm text-[#6b655c]">
                You have no flashcard subjects yet. Create some in the study workspace first.
              </p>
            ) : (
              <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {board.map((s) => {
                  const keys = s.subs.map((x) => keyOf(s.name, x.name));
                  return (
                    <div key={s.name} className="rounded-2xl border border-black/[0.06]">
                      <Row
                        label={s.name}
                        count={s.count}
                        checked={keys.length > 0 && keys.every((k) => picked.has(k))}
                        onToggle={() => toggle(keys)}
                        bold
                      />
                      {s.subs.map((x) => (
                        <Row
                          key={x.name}
                          label={x.name}
                          count={x.count}
                          checked={picked.has(keyOf(s.name, x.name))}
                          onToggle={() => toggle([keyOf(s.name, x.name)])}
                          indent
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </section>


          <aside className="space-y-5">
            <div
              className="grid h-32 place-items-center rounded-[26px]"
              style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
            >
              <span className="text-5xl">{emoji}</span>
            </div>

            <div className="space-y-4 rounded-[26px] border border-black/[0.07] bg-white p-6">
              <Field label="Deck title">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Pharmacology — doses"
                  className={input}
                />
              </Field>
              <Field label="Short description">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's inside and who it's for."
                  className={`${input} min-h-[80px]`}
                />
              </Field>
              {!toSpace && (
                <Field label="Tags">
                  <input
                    value={tagText}
                    onChange={(e) => setTagText(e.target.value)}
                    placeholder="pharma, year3, exam"
                    className={input}
                  />
                </Field>
              )}
              <Field label="Cover colour">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(DECK_COVERS).map(([key, v]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCover(key)}
                      aria-label={key}
                      className={`h-9 w-9 rounded-full transition ${
                        cover === key ? "ring-2 ring-[#23201d] ring-offset-2" : ""
                      }`}
                      style={{ background: `linear-gradient(135deg, ${v.from}, ${v.to})` }}
                    />
                  ))}
                </div>
              </Field>
              <Field label="Emoji">
                <div className="flex flex-wrap gap-1.5">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEmoji(e)}
                      className={`h-9 w-9 rounded-xl text-lg transition ${
                        emoji === e ? "bg-black/[0.08]" : "hover:bg-black/[0.05]"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="rounded-2xl bg-[#fbf5e9] px-4 py-3 text-[13px] font-bold text-[#4a453d]">
                {picked.size} selected · {total} cards
              </div>
              <button
                onClick={publish}
                disabled={saving || picked.size === 0}
                className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-black text-white disabled:opacity-50 ${
                  toSpace ? "bg-[#d94f3d]" : "bg-[#8ec63f]"
                }`}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {toSpace ? "Add to my space" : "Publish for everyone"}
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

const input =
  "w-full rounded-xl border border-black/[0.1] bg-white px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-[#8ec63f]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.15em] text-[#a29a8d]">
        {label}
      </label>
      {children}
    </div>
  );
}

function Row({
  label,
  count,
  checked,
  onToggle,
  bold,
  indent,
}: {
  label: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
  bold?: boolean;
  indent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-black/[0.03] ${
        indent ? "pl-10" : ""
      }`}
    >
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition ${
          checked ? "border-[#8ec63f] bg-[#8ec63f] text-white" : "border-black/20"
        }`}
      >
        {checked && <Check size={13} strokeWidth={3} />}
      </span>
      <span className={`min-w-0 flex-1 truncate text-[14px] ${bold ? "font-black" : "font-semibold"}`}>
        {label}
      </span>
      <span className="text-[12px] font-bold text-[#a29a8d]">{count}</span>
    </button>
  );
}
