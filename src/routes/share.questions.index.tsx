import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Eye, EyeOff, ListChecks, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthorChip } from "@/components/share/DeckCard";
import { useAuth } from "@/hooks/useAuth";
import { coverOf } from "@/lib/share-decks";
import {
  deleteQuestionSet,
  fetchMyQuestionSets,
  fetchQuestionFeed,
  setQuestionSetPublished,
  type DeckAuthor,
  type SharedQuestionSet,
} from "@/lib/share-questions";

export const Route = createFileRoute("/share/questions/")({
  head: () => ({
    meta: [
      { title: "Shared questions — lecture question sets from other students | RitaJet" },
      {
        name: "description",
        content:
          "Browse lecture question sets shared by other RitaJet students, read the explanations and copy any set into your own Lecture Lab.",
      },
      { property: "og:title", content: "Shared questions on RitaJet" },
      {
        property: "og:description",
        content: "Community lecture question sets you can study and copy into your own Lecture Lab.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShareQuestionsPage,
});

function ShareQuestionsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"new" | "top">("new");
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [page, setPage] = useState(0);

  const feed = useQuery({
    queryKey: ["qset-feed", search, sort, page],
    queryFn: () => fetchQuestionFeed({ search, sort, page }),
  });

  const mine = useQuery({
    queryKey: ["qset-mine", user?.id],
    queryFn: () => fetchMyQuestionSets(user!.id),
    enabled: !!user && tab === "mine",
  });

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-14 md:px-8 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[12px] font-black uppercase tracking-widest text-[#6b655c]">
              <ListChecks size={14} /> Shared questions
            </span>
            <h1
              className="mt-5 font-display font-black leading-[1.05] tracking-tight"
              style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)" }}
            >
              Question sets made by other students
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-[#4a453d]">
              These come from Lecture Lab — read them with their explanations, or copy a whole set
              into your own subjects and run it in Study, Session or Timed exam.
            </p>
          </div>
          <Link
            to="/share/questions/new"
            search={{ space: undefined }}
            className="inline-flex items-center gap-2 rounded-full bg-[#8ec63f] px-6 py-3.5 text-[15px] font-black text-white shadow-[0_14px_30px_-16px_rgba(142,198,63,0.9)] transition hover:-translate-y-0.5"
          >
            <Plus size={17} /> Share questions
          </Link>
        </div>

        <div className="mt-8 inline-flex rounded-full border border-black/[0.08] bg-white p-1">
          <Link
            to="/share"
            className="rounded-full px-4 py-2 text-[13px] font-black text-[#6b655c] hover:bg-black/[0.05]"
          >
            Flashcards
          </Link>
          <span className="rounded-full bg-[#23201d] px-4 py-2 text-[13px] font-black text-white">
            Questions
          </span>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 py-2.5">
            <Search size={15} className="text-[#a29a8d]" />
            <input
              value={search}
              onChange={(e) => {
                setPage(0);
                setSearch(e.target.value);
              }}
              placeholder="Search question sets…"
              className="w-52 bg-transparent text-sm font-semibold outline-none placeholder:text-[#a29a8d]"
            />
          </div>
          <Seg value={tab} onChange={setTab} options={[["all", "All sets"], ["mine", "My sets"]]} />
          {tab === "all" && (
            <Seg
              value={sort}
              onChange={(v) => {
                setPage(0);
                setSort(v);
              }}
              options={[["new", "Newest"], ["top", "Most saved"]]}
            />
          )}
        </div>

        {tab === "all" ? (
          feed.isLoading ? (
            <p className="mt-12 text-[#6b655c]">Loading question sets…</p>
          ) : (feed.data?.sets.length ?? 0) === 0 ? (
            <Empty />
          ) : (
            <>
              <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {feed.data!.sets.map((s) => (
                  <SetCard key={s.id} set={s} author={feed.data!.authors[s.owner_id] ?? null} />
                ))}
              </div>
              <div className="mt-10 flex items-center justify-center gap-3">
                <button
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-[13px] font-black disabled:opacity-40"
                >
                  <ChevronLeft size={15} /> Previous
                </button>
                <span className="text-[13px] font-bold text-[#6b655c]">Page {page + 1}</span>
                <button
                  disabled={!feed.data?.hasMore}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-[13px] font-black disabled:opacity-40"
                >
                  Next <ChevronRight size={15} />
                </button>
              </div>
            </>
          )
        ) : !user ? (
          <p className="mt-12 text-[#6b655c]">Sign in to see the question sets you shared.</p>
        ) : (mine.data?.length ?? 0) === 0 ? (
          <Empty mine />
        ) : (
          <div className="mt-10 space-y-3">
            {mine.data!.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/[0.07] bg-white px-5 py-4"
              >
                <span className="text-2xl">{s.emoji || "❓"}</span>
                <Link
                  to="/share/questions/$setId"
                  params={{ setId: s.id }}
                  className="min-w-0 flex-1 truncate font-display text-[17px] font-black hover:underline"
                >
                  {s.title}
                </Link>
                <span className="text-[13px] font-bold text-[#6b655c]">
                  {s.question_count} questions · {s.save_count} saves
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-black ${
                    s.audience === "space"
                      ? "bg-black/[0.06] text-[#6b655c]"
                      : s.published
                        ? "bg-[#e6f4d8] text-[#3d5c14]"
                        : "bg-black/[0.06] text-[#6b655c]"
                  }`}
                >
                  {s.audience === "space" ? "Classroom" : s.published ? "Public" : "Hidden"}
                </span>
                {s.audience === "public" && (
                  <button
                    onClick={async () => {
                      await setQuestionSetPublished(s.id, !s.published);
                      toast.success(s.published ? "Set hidden" : "Set is public again");
                      qc.invalidateQueries({ queryKey: ["qset-mine"] });
                      qc.invalidateQueries({ queryKey: ["qset-feed"] });
                    }}
                    className="grid h-9 w-9 place-items-center rounded-xl text-[#6b655c] hover:bg-black/[0.06]"
                    aria-label={s.published ? "Hide set" : "Publish set"}
                  >
                    {s.published ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (!confirm(`Delete "${s.title}"? Your own questions stay untouched.`)) return;
                    await deleteQuestionSet(s.id);
                    toast.success("Question set deleted");
                    qc.invalidateQueries({ queryKey: ["qset-mine"] });
                    qc.invalidateQueries({ queryKey: ["qset-feed"] });
                  }}
                  className="grid h-9 w-9 place-items-center rounded-xl text-[#6b655c] hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete set"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export function SetCard({ set, author }: { set: SharedQuestionSet; author: DeckAuthor | null }) {
  const c = coverOf(set.cover);
  return (
    <Link
      to="/share/questions/$setId"
      params={{ setId: set.id }}
      className="group flex flex-col overflow-hidden rounded-[26px] border border-black/[0.07] bg-white shadow-[0_10px_30px_-24px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-1"
    >
      <div
        className="relative grid h-28 place-items-center"
        style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
      >
        <span className="text-4xl">{set.emoji || "❓"}</span>
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-black text-[#23201d]">
          <ListChecks size={12} /> {set.question_count}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-[18px] font-black leading-snug tracking-tight text-[#23201d]">
          {set.title}
        </h3>
        {set.description && (
          <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed text-[#6b655c]">
            {set.description}
          </p>
        )}
        <div className="mt-auto pt-4">
          <AuthorChip author={author} />
        </div>
      </div>
    </Link>
  );
}

function Seg<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className="inline-flex rounded-full border border-black/[0.08] bg-white p-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-full px-4 py-2 text-[13px] font-black transition ${
            value === v ? "bg-[#23201d] text-white" : "text-[#6b655c] hover:bg-black/[0.05]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Empty({ mine }: { mine?: boolean }) {
  return (
    <div className="mt-12 rounded-[28px] border border-dashed border-black/15 bg-white/60 px-8 py-16 text-center">
      <span className="text-4xl">❓</span>
      <h2 className="mt-4 font-display text-2xl font-black">
        {mine ? "You haven't shared a question set yet" : "No shared question sets yet"}
      </h2>
      <p className="mt-2 text-[#6b655c]">Make questions in Lecture Lab, then share them here.</p>
    </div>
  );
}
