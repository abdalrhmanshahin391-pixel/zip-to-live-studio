import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { StudyLayout, StudyHeading } from "@/components/study/StudyLayout";
import { SignedOutPanel } from "@/components/study/SignedOutPanel";
import { useAuth } from "@/hooks/useAuth";
import { fetchCards, fetchSubjects, markReviewed } from "@/lib/flashcards";
import { FlipCard } from "@/components/study/FlipCard";

/** One face of the session card. */
function SessionFace({ side, text, hint }: { side: string; text: string; hint?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center overflow-auto rounded-[2rem] border border-black/[0.06] bg-white px-8 py-10 text-center">
      <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#b3aa9c]">{side}</span>
      <span
        className="mt-5 font-display font-black leading-tight"
        style={{ fontSize: "clamp(1.4rem, 3vw, 2.1rem)" }}
      >
        {text}
      </span>
      {hint && <span className="mt-6 text-[13.5px] font-semibold text-[#b3aa9c]">{hint}</span>}
    </div>
  );
}

export const Route = createFileRoute("/study/session")({
  validateSearch: (search: Record<string, unknown>) => ({
    ids: typeof search.ids === "string" ? search.ids : "",
  }),
  head: () => ({
    meta: [
      { title: "Study session — RitaJet flashcards" },
      { name: "description", content: "Flip through the cards from the subjects you picked, one at a time." },
      { property: "og:title", content: "Study session — RitaJet flashcards" },
      { property: "og:description", content: "A calm, one-card-at-a-time flashcard session." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SessionPage,
});

function SessionPage() {
  const { ids } = Route.useSearch();
  const { user } = useAuth();
  const subjectIds = useMemo(() => ids.split(",").filter(Boolean), [ids]);

  const subjects = useQuery({ queryKey: ["flash-subjects"], queryFn: fetchSubjects, enabled: !!user });
  const cards = useQuery({
    queryKey: ["flash-cards", ids],
    queryFn: () => fetchCards(subjectIds),
    enabled: !!user && subjectIds.length > 0,
  });

  const [order, setOrder] = useState<number[] | null>(null);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);

  const list = cards.data ?? [];
  const seq = order ?? list.map((_, i) => i);
  const card = list[seq[pos] ?? -1];

  const names = (subjects.data ?? [])
    .filter((s) => subjectIds.includes(s.id))
    .map((s) => s.name)
    .join(" · ");

  const restart = () => {
    setOrder(null);
    setPos(0);
    setFlipped(false);
    setKnown(0);
  };

  const shuffle = () => {
    const next = list.map((_, i) => i);
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j]!, next[i]!];
    }
    setOrder(next);
    setPos(0);
    setFlipped(false);
    setKnown(0);
  };

  const answer = (gotIt: boolean) => {
    if (card) void markReviewed(card.id, card.reviews);
    if (gotIt) setKnown((k) => k + 1);
    setFlipped(false);
    setPos((p) => p + 1);
  };

  const rail = [
    { label: "Back to subjects", icon: <ArrowLeft size={15} />, to: "/study" },
    { label: "Shuffle", icon: <RotateCcw size={15} />, onClick: shuffle },
    { label: "Restart", onClick: restart },
  ];

  const done = list.length > 0 && pos >= list.length;

  return (
    <StudyLayout rail={rail}>
      {!user ? (
        <SignedOutPanel what="your flashcards" />
      ) : (
        <div className="mx-auto max-w-3xl">
          <StudyHeading eyebrow={names || "Session"} title={done ? "Session finished" : "Study session"} />

          {list.length === 0 && cards.isSuccess && (
            <p className="mt-8 text-[15px] text-[#6d665c]">
              There are no cards in this selection yet.{" "}
              <Link to="/study" className="font-bold underline">
                Add some first
              </Link>
              .
            </p>
          )}

          {!done && card && (
            <>
              <div className="mt-6 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[color:var(--primary)] transition-all"
                    style={{ width: `${(pos / list.length) * 100}%` }}
                  />
                </div>
                <span className="text-[13px] font-bold text-[#a29a8d]">
                  {pos + 1} / {list.length}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="mt-8 block w-full"
                aria-label="Flip card"
              >
                <FlipCard
                  flipped={flipped}
                  className="h-[19rem] w-full"
                  front={<SessionFace side="Question" text={card.front} hint="Tap to reveal" />}
                  back={<SessionFace side="Answer" text={card.back} />}
                />
              </button>

              {flipped && (
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => answer(false)}
                    className="inline-flex h-12 items-center rounded-full border border-black/10 bg-white px-8 text-[15px] font-semibold"
                  >
                    Still learning
                  </button>
                  <button
                    type="button"
                    onClick={() => answer(true)}
                    className="rita-pill inline-flex h-12 items-center rounded-full px-8 text-[15px] font-semibold"
                  >
                    I knew it
                  </button>
                </div>
              )}
            </>
          )}

          {done && (
            <div className="mt-8 rounded-[2rem] bg-white p-10 text-center">
              <p className="font-display text-[2.4rem] font-black leading-none">
                {known}/{list.length}
              </p>
              <p className="mt-3 text-[15px] text-[#6d665c]">cards you knew straight away.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={shuffle}
                  className="rita-pill inline-flex h-12 items-center rounded-full px-8 text-[15px] font-semibold"
                >
                  Go again, shuffled
                </button>
                <Link
                  to="/study"
                  className="inline-flex h-12 items-center rounded-full border border-black/10 px-8 text-[15px] font-semibold"
                >
                  Back to subjects
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </StudyLayout>
  );
}
