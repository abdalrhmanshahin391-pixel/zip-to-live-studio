import { RequireAuth } from "@/components/study/RequireAuth";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { refreshSpace } from "@/lib/spaces";
import { lqBoard, lqLoadRun } from "@/lib/lecture-lab.functions";
import { DECK_COVERS, coverOf } from "@/lib/share-decks";
import { publishQuestionSet } from "@/lib/share-questions";

export const Route = createFileRoute("/share/questions/new")({
  // ?space=<id> builds a set that lives only inside that classroom or group.
  validateSearch: (search: Record<string, unknown>) => ({
    space: typeof search.space === "string" ? search.space : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Share your lecture questions | RitaJet" },
      {
        name: "description",
        content:
          "Pick the Lecture Lab lectures you want to share and publish their questions as a set other students can study.",
      },
      { property: "og:title", content: "Share your lecture questions on RitaJet" },
      {
        property: "og:description",
        content: "Publish your Lecture Lab questions as a set other students can study and save.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequireAuth what="your shared questions">
      <ShareQuestionsNew />
    </RequireAuth>
  ),
});

const EMOJIS = ["❓", "🧠", "💊", "🫀", "🦴", "🔬", "📚", "🧪", "⚡️", "🌿"];
const input =
  "w-full rounded-xl border border-black/[0.1] bg-[#fdfaf3] px-4 py-3 text-sm font-semibold outline-none focus:border-[#8ec63f]";

function ShareQuestionsNew() {
  const { space: spaceId } = Route.useSearch();
  const toSpace = !!spaceId;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const board = useServerFn(lqBoard);
  const loadRun = useServerFn(lqLoadRun);

  const [data, setData] = useState<any>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState("sky");
  const [emoji, setEmoji] = useState("❓");
  const [tagText, setTagText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    board({ data: {} } as any)
      .then((r: any) => setData(r))
      .catch(() => setData({ subjects: [], subtopics: [], lectures: [] }));
  }, [board]);

  /** Only the student's own Lecture Lab shelf can be shared — never the read-only examples. */
  const tree = useMemo(() => {
    if (!data) return [];
    return (data.subjects as any[])
      .filter((s) => !s.is_example)
      .map((s) => ({
        ...s,
        subs: (data.subtopics as any[])
          .filter((t) => t.subject_id === s.id && !t.is_example)
          .map((t) => ({
            ...t,
            lectures: (data.lectures as any[]).filter(
              (l) => l.subtopic_id === t.id && !l.is_example,
            ),
          })),
      }));
  }, [data]);

  const total = useMemo(() => {
    let n = 0;
    for (const s of tree)
      for (const t of s.subs)
        for (const l of t.lectures) if (picked.has(l.id)) n += l.question_count ?? 0;
    return n;
  }, [tree, picked]);

  function toggle(ids: string[]) {
    setPicked((prev) => {
      const next = new Set(prev);
      const on = !ids.every((i) => next.has(i));
      for (const i of ids) (on ? next.add(i) : next.delete(i));
      return next;
    });
  }

  async function publish() {
    if (!title.trim()) return toast.error("Give your question set a title");
    if (picked.size === 0) return toast.error("Pick at least one lecture");
    setSaving(true);
    try {
      const ids = [...picked];
      const questions: { stem: string; options: any; explanation: string }[] = [];
      // Load in batches so sharing hundreds of lectures still works.
      for (let i = 0; i < ids.length; i += 30) {
        const res: any = await loadRun({
          data: { lectureIds: ids.slice(i, i + 30), pool: "all" },
        });
        for (const q of res.questions as any[]) {
          questions.push({ stem: q.stem, options: q.options, explanation: q.explanation ?? "" });
        }
      }
      const tags = tagText
        .split(/[,\s]+/)
        .map((t) => t.replace(/^#/, "").trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 6);
      const id = await publishQuestionSet({
        title,
        description,
        cover,
        emoji,
        tags,
        questions,
        spaceId: spaceId ?? null,
      });
      if (spaceId) {
        toast.success("Questions added to your space — only its members can see them.");
        await refreshSpace(qc, spaceId);
        navigate({ to: "/spaces/$spaceId", params: { spaceId } });
      } else {
        toast.success("Questions shared with everyone!");
        navigate({ to: "/share/questions/$setId", params: { setId: id } });
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not share these questions");
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
          <Link
            to="/share/questions"
            className="inline-flex items-center gap-1.5 text-sm font-black text-[#6b655c] hover:text-[#23201d]"
          >
            <ArrowLeft size={15} /> Shared questions
          </Link>
        )}
        <h1 className="mt-5 font-display text-4xl font-black tracking-tight">
          {toSpace ? "Make a question set for your space" : "Share questions with everyone"}
        </h1>
        <p className="mt-2 max-w-xl text-[#6b655c]">
          Tick the Lecture Lab lectures you want to include. A snapshot of their questions and
          explanations becomes a set other students can read and copy.
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
            <h2 className="font-display text-lg font-black">Pick lectures</h2>
            {!data ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-[#6b655c]">
                <Loader2 size={15} className="animate-spin" /> Loading your Lecture Lab…
              </p>
            ) : tree.length === 0 ? (
              <p className="mt-4 text-sm text-[#6b655c]">
                You have no lectures of your own yet. Make some in Lecture Lab first.
              </p>
            ) : (
              <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {tree.map((s: any) => {
                  const ids = s.subs.flatMap((t: any) => t.lectures.map((l: any) => l.id));
                  return (
                    <div key={s.id} className="rounded-2xl border border-black/[0.06]">
                      <Row
                        label={s.name}
                        count={ids.length}
                        unit="lectures"
                        checked={ids.length > 0 && ids.every((i: string) => picked.has(i))}
                        onToggle={() => toggle(ids)}
                        bold
                      />
                      {s.subs.map((t: any) =>
                        t.lectures.map((l: any) => (
                          <Row
                            key={l.id}
                            label={`${t.name} · ${l.title}`}
                            count={l.question_count ?? 0}
                            unit="questions"
                            checked={picked.has(l.id)}
                            onToggle={() => toggle([l.id])}
                            indent
                          />
                        )),
                      )}
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
              <Field label="Set title">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Respiratory — exam questions"
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
                    placeholder="respiratory, year3, exam"
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
                      className={`grid h-9 w-9 place-items-center rounded-xl text-lg transition ${
                        emoji === e ? "bg-[#23201d]" : "bg-black/[0.05] hover:bg-black/[0.09]"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </Field>

              <p className="text-[13px] font-bold text-[#6b655c]">
                {picked.size} lectures · about {total} questions
              </p>
              <button
                type="button"
                onClick={publish}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#8ec63f] px-6 py-3.5 text-[15px] font-black text-white disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {saving ? "Sharing…" : toSpace ? "Add to my space" : "Share questions"}
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-black uppercase tracking-widest text-[#6b655c]">
        {label}
      </span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Row({
  label,
  count,
  unit,
  checked,
  onToggle,
  bold,
  indent,
}: {
  label: string;
  count: number;
  unit: string;
  checked: boolean;
  onToggle: () => void;
  bold?: boolean;
  indent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-black/[0.03] ${
        indent ? "ps-10" : ""
      }`}
    >
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
          checked ? "border-[#8ec63f] bg-[#8ec63f] text-white" : "border-black/20"
        }`}
      >
        {checked && <Check size={13} />}
      </span>
      <span className={`min-w-0 flex-1 truncate text-sm ${bold ? "font-black" : "font-semibold"}`}>
        {label}
      </span>
      <span className="text-[12px] font-bold text-[#a29a8d]">
        {count} {unit}
      </span>
    </button>
  );
}
