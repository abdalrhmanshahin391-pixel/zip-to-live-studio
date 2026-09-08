import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, Eye, Plus, Search, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { DeckCard } from "@/components/share/DeckCard";
import { useAuth } from "@/hooks/useAuth";
import { deleteDeck, fetchFeed, fetchMyDecks, setPublished } from "@/lib/share-decks";

export const Route = createFileRoute("/share/")({
  head: () => ({
    meta: [
      { title: "Shared flashcards — study decks from other students | RitaJet" },
      {
        name: "description",
        content:
          "Browse flashcard decks shared by other RitaJet students, study them instantly and save any deck into your own subjects.",
      },
      { property: "og:title", content: "Shared flashcards on RitaJet" },
      {
        property: "og:description",
        content: "Community flashcard decks you can study and copy into your own subjects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SharePage,
});

function SharePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"new" | "top">("new");
  const [tab, setTab] = useState<"all" | "mine">("all");

  const feed = useQuery({
    queryKey: ["share-feed", search, sort],
    queryFn: () => fetchFeed({ search, sort }),
  });
  const mine = useQuery({
    queryKey: ["share-mine", user?.id],
    queryFn: () => fetchMyDecks(user!.id),
    enabled: !!user && tab === "mine",
  });

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />
      <main className="mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/70 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-[#7a4b16]">
              <Share2 size={13} /> Shared flashcards
            </span>
            <h1
              className="mt-6 font-display font-black leading-[1.08] tracking-tight"
              style={{ fontSize: "clamp(2rem, 4vw, 3.2rem)" }}
            >
              Study decks made by other students
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-[#4a453d]">
              Pick a deck, flip through it, and copy it straight into your own subjects — or share
              yours and let the whole class use it.
            </p>
          </div>
          <Link
            to="/share/new"
            search={{ space: undefined }}
            className="inline-flex items-center gap-2 rounded-full bg-[#8ec63f] px-6 py-3.5 text-[15px] font-black text-white shadow-[0_14px_30px_-16px_rgba(142,198,63,0.9)] transition hover:-translate-y-0.5"
          >
            <Plus size={17} /> Share flashcards
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 py-2.5">
            <Search size={15} className="text-[#a29a8d]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search decks…"
              className="w-52 bg-transparent text-sm font-semibold outline-none placeholder:text-[#a29a8d]"
            />
          </div>
          <Seg value={tab} onChange={setTab} options={[["all", "All decks"], ["mine", "My decks"]]} />
          {tab === "all" && (
            <Seg value={sort} onChange={setSort} options={[["new", "Newest"], ["top", "Most saved"]]} />
          )}
        </div>

        {tab === "all" ? (
          feed.isLoading ? (
            <p className="mt-12 text-[#6b655c]">Loading decks…</p>
          ) : (feed.data?.decks.length ?? 0) === 0 ? (
            <Empty />
          ) : (
            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {feed.data!.decks.map((d) => (
                <DeckCard key={d.id} deck={d} author={feed.data!.authors[d.owner_id] ?? null} />
              ))}
            </div>
          )
        ) : !user ? (
          <p className="mt-12 text-[#6b655c]">Sign in to see the decks you shared.</p>
        ) : (mine.data?.length ?? 0) === 0 ? (
          <Empty mine />
        ) : (
          <div className="mt-10 space-y-3">
            {mine.data!.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-black/[0.07] bg-white px-5 py-4"
              >
                <span className="text-2xl">{d.emoji || "🃏"}</span>
                <Link
                  to="/share/$deckId"
                  params={{ deckId: d.id }}
                  className="min-w-0 flex-1 truncate font-display text-[17px] font-black hover:underline"
                >
                  {d.title}
                </Link>
                <span className="text-[13px] font-bold text-[#6b655c]">
                  {d.card_count} cards · {d.save_count} saves
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-black ${
                    d.published ? "bg-[#e6f4d8] text-[#3d5c14]" : "bg-black/[0.06] text-[#6b655c]"
                  }`}
                >
                  {d.published ? "Public" : "Hidden"}
                </span>
                <button
                  onClick={async () => {
                    await setPublished(d.id, !d.published);
                    toast.success(d.published ? "Deck hidden" : "Deck is public again");
                    qc.invalidateQueries({ queryKey: ["share-mine"] });
                    qc.invalidateQueries({ queryKey: ["share-feed"] });
                  }}
                  className="grid h-9 w-9 place-items-center rounded-xl text-[#6b655c] hover:bg-black/[0.06]"
                  aria-label={d.published ? "Hide deck" : "Publish deck"}
                >
                  {d.published ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete "${d.title}"? Your own cards stay untouched.`)) return;
                    await deleteDeck(d.id);
                    toast.success("Deck deleted");
                    qc.invalidateQueries({ queryKey: ["share-mine"] });
                    qc.invalidateQueries({ queryKey: ["share-feed"] });
                  }}
                  className="grid h-9 w-9 place-items-center rounded-xl text-[#6b655c] hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete deck"
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
      <span className="text-4xl">🃏</span>
      <h2 className="mt-4 font-display text-2xl font-black">
        {mine ? "You haven't shared a deck yet" : "No shared decks yet"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] text-[#6b655c]">
        Pick a few of your flashcard subjects and publish them — everyone studying the same topic
        can use them.
      </p>
      <Link
        to="/share/new"
        search={{ space: undefined }}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#8ec63f] px-6 py-3 text-sm font-black text-white"
      >
        <Plus size={16} /> Share flashcards
      </Link>
    </div>
  );
}
