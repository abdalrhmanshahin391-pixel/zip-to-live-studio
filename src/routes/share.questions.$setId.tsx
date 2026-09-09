import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ChevronLeft, ChevronRight, FolderPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthorChip } from "@/components/share/DeckCard";
import { useAuth } from "@/hooks/useAuth";
import { coverOf } from "@/lib/share-decks";
import { QUESTION_PAGE, fetchQuestionPage, fetchQuestionSet } from "@/lib/share-questions";
import { sqImport } from "@/lib/share-questions.functions";
import { lqAddSubject, lqAddSubtopic, lqBoard } from "@/lib/lecture-lab.functions";

export const Route = createFileRoute("/share/questions/$setId")({
  head: () => ({
    meta: [
      { title: "Shared question set | RitaJet" },
      {
        name: "description",
        content:
          "Read a shared set of lecture questions with their explanations and copy it into your own Lecture Lab.",
      },
      { property: "og:title", content: "Shared question set on RitaJet" },
      {
        property: "og:description",
        content: "Lecture questions shared by a RitaJet student, with full explanations.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuestionSetPage,
});

function QuestionSetPage() {
  const { setId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [saveOpen, setSaveOpen] = useState(false);

  const head = useQuery({ queryKey: ["qset", setId], queryFn: () => fetchQuestionSet(setId) });
  const items = useQuery({
    queryKey: ["qset-items", setId, page],
    queryFn: () => fetchQuestionPage(setId, page),
  });

  if (head.isLoading) {
    return (
      <div className="min-h-screen" style={{ background: "#fbf5e9" }}>
        <SiteHeader />
        <p className="mx-auto max-w-4xl px-4 py-20 text-[#6b655c]">Loading…</p>
      </div>
    );
  }
  if (!head.data) {
    return (
      <div className="min-h-screen" style={{ background: "#fbf5e9" }}>
        <SiteHeader />
        <p className="mx-auto max-w-4xl px-4 py-20 text-[#6b655c]">
          This question set is not available.
        </p>
      </div>
    );
  }

  const { set, author } = head.data;
  const c = coverOf(set.cover);
  const pages = Math.max(1, Math.ceil(set.question_count / QUESTION_PAGE));

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12 md:px-8 md:py-16">
        <Link
          to="/share/questions"
          className="inline-flex items-center gap-1.5 text-sm font-black text-[#6b655c] hover:text-[#23201d]"
        >
          <ArrowLeft size={15} /> Shared questions
        </Link>

        <div
          className="mt-5 rounded-[28px] p-8"
          style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})`, color: c.ink }}
        >
          <span className="text-5xl">{set.emoji || "❓"}</span>
          <h1 className="mt-4 font-display text-4xl font-black tracking-tight">{set.title}</h1>
          {set.description && <p className="mt-2 max-w-2xl font-semibold">{set.description}</p>}
          <p className="mt-3 text-[13px] font-black">
            {set.question_count} questions · {set.save_count} saves
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <AuthorChip author={author} />
          {user && (
            <button
              onClick={() => setSaveOpen(true)}
              className="ms-auto inline-flex items-center gap-2 rounded-full bg-[#8ec63f] px-5 py-3 text-[14px] font-black text-white transition hover:-translate-y-0.5"
            >
              <FolderPlus size={16} /> Save to Lecture Lab
            </button>
          )}
        </div>

        <div className="mt-8 space-y-4">
          {items.isLoading ? (
            <p className="text-[#6b655c]">Loading questions…</p>
          ) : (
            (items.data ?? []).map((q, i) => (
              <article
                key={q.id}
                className="rounded-[24px] border border-black/[0.07] bg-white p-6"
              >
                <p className="text-[12px] font-black uppercase tracking-widest text-[#a29a8d]">
                  Question {page * QUESTION_PAGE + i + 1}
                </p>
                <h2 className="mt-2 font-display text-[19px] font-black leading-snug">{q.stem}</h2>
                <ul className="mt-4 space-y-2">
                  {(Array.isArray(q.options) ? q.options : []).map((o: any, k: number) => (
                    <li
                      key={k}
                      className={`rounded-2xl border px-4 py-3 text-[15px] font-semibold ${
                        o?.correct || o?.is_correct
                          ? "border-[#8ec63f] bg-[#f2f9e8]"
                          : "border-black/[0.08]"
                      }`}
                    >
                      <span className="me-2 font-black text-[#6b655c]">
                        {o?.letter ?? String.fromCharCode(65 + k)}.
                      </span>
                      {o?.body ?? o?.text ?? String(o ?? "")}
                    </li>
                  ))}
                </ul>
                {q.explanation && (
                  <p className="mt-4 rounded-2xl bg-[#fdfaf3] p-4 text-[15px] leading-relaxed text-[#4a453d]">
                    {q.explanation}
                  </p>
                )}
              </article>
            ))
          )}
        </div>

        {pages > 1 && (
          <div className="mt-10 flex items-center justify-center gap-3">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-[13px] font-black disabled:opacity-40"
            >
              <ChevronLeft size={15} /> Previous
            </button>
            <span className="text-[13px] font-bold text-[#6b655c]">
              Page {page + 1} of {pages}
            </span>
            <button
              disabled={page + 1 >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-[13px] font-black disabled:opacity-40"
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        )}
      </main>

      {saveOpen && (
        <SaveSheet
          setId={setId}
          onClose={() => setSaveOpen(false)}
          onDone={() => navigate({ to: "/study/lectures" })}
        />
      )}
    </div>
  );
}

/** Pick (or create) the subject and sub-subject the set is copied into. */
function SaveSheet({
  setId,
  onClose,
  onDone,
}: {
  setId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const board = useServerFn(lqBoard);
  const addSubject = useServerFn(lqAddSubject);
  const addSubtopic = useServerFn(lqAddSubtopic);
  const importSet = useServerFn(sqImport);

  const [data, setData] = useState<any>(null);
  const [subject, setSubject] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [sub, setSub] = useState("");
  const [newSub, setNewSub] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    board({ data: {} } as any)
      .then((r: any) => setData(r))
      .catch(() => setData({ subjects: [], subtopics: [] }));
  }, [board]);

  const subjects = useMemo(
    () => ((data?.subjects ?? []) as any[]).filter((s) => !s.is_example),
    [data],
  );
  const subs = useMemo(
    () =>
      ((data?.subtopics ?? []) as any[]).filter((t) => !t.is_example && t.subject_id === subject),
    [data, subject],
  );

  async function save() {
    setBusy(true);
    try {
      let subjectId = subject;
      if (!subjectId) {
        if (!newSubject.trim()) throw new Error("Pick a subject or type a new one");
        subjectId = (await addSubject({ data: { name: newSubject.trim() } })).id;
      }
      let subtopicId = sub;
      if (!subtopicId) {
        const name = newSub.trim() || "Shared questions";
        subtopicId = (await addSubtopic({ data: { subjectId, name } })).id;
      }
      const res: any = await importSet({ data: { setId, subtopicId } });
      toast.success(`Saved ${res.count} questions into your Lecture Lab.`);
      onDone();
    } catch (e: any) {
      toast.error(e?.message || "Could not save this set");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/50 p-5">
      <div className="w-full max-w-md rounded-[26px] bg-[#fdfaf3] p-6">
        <h2 className="font-display text-xl font-black">Save to Lecture Lab</h2>
        <p className="mt-1 text-sm text-[#6b655c]">
          Choose where these questions should live, then run them in Study, Session or Timed exam.
        </p>

        {!data ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-[#6b655c]">
            <Loader2 size={15} className="animate-spin" /> Loading your subjects…
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-[12px] font-black uppercase tracking-widest text-[#6b655c]">
                Subject
              </span>
              <select
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setSub("");
                }}
                className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-4 py-3 text-sm font-semibold"
              >
                <option value="">— New subject —</option>
                {subjects.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {!subject && (
                <input
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder="New subject name"
                  className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-4 py-3 text-sm font-semibold"
                />
              )}
            </label>

            <label className="block">
              <span className="text-[12px] font-black uppercase tracking-widest text-[#6b655c]">
                Sub-subject
              </span>
              <select
                value={sub}
                onChange={(e) => setSub(e.target.value)}
                className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-4 py-3 text-sm font-semibold"
              >
                <option value="">— New sub-subject —</option>
                {subs.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {!sub && (
                <input
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  placeholder="Shared questions"
                  className="mt-2 w-full rounded-xl border border-black/[0.1] bg-white px-4 py-3 text-sm font-semibold"
                />
              )}
            </label>
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-[#8ec63f] px-5 py-3 text-[14px] font-black text-white disabled:opacity-60"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <FolderPlus size={15} />}
            {busy ? "Saving…" : "Save"}
          </button>
          <button
            onClick={onClose}
            className="ms-auto rounded-full border border-black/[0.1] px-5 py-3 text-[14px] font-black text-[#6b655c]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
