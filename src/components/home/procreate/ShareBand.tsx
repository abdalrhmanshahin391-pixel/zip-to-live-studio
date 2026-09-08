import { Link } from "@tanstack/react-router";
import { EditableImage } from "@/components/site/EditableImage";
import face1 from "@/assets/student-face-1.jpg.asset.json";
import face2 from "@/assets/student-face-2.jpg.asset.json";
import face3 from "@/assets/student-face-3.jpg.asset.json";

const FACES = [face1.url, face2.url, face3.url];

/** Wide dark panel inviting students to share their flashcard decks. */
export function ShareBand() {
  return (
    <section className="mx-auto w-full max-w-[1240px] px-5 pb-24 md:px-8">
      <div className="rounded-[28px] bg-[#131313] p-8 md:rounded-[36px] md:p-14">
        <h2
          className="font-bold leading-[1.03] tracking-[-0.035em] text-white"
          style={{ fontSize: "clamp(2.1rem,5.4vw,4.1rem)" }}
        >
          Share your flashcards.
        </h2>

        <div className="mt-12 flex flex-col gap-8 md:mt-20 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center">
              {FACES.map((url, i) => (
                <span
                  key={url}
                  className="relative h-[74px] w-[74px] overflow-hidden rounded-full ring-[3px] ring-[#131313]"
                  style={{ marginLeft: i === 0 ? 0 : -14 }}
                >
                  <EditableImage
                    imageKey={`home.share.face${i + 1}`}
                    fallback={url}
                    alt=""
                    width={816}
                    height={816}
                    className="h-full w-full object-cover"
                  />
                </span>
              ))}
            </div>
            <p className="mt-6 max-w-[430px] text-[17px] font-semibold leading-[1.45] text-white md:text-[19px]">
              Publish a deck once and every student on RitaJet can study it,
              save it and build on it.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link to="/share" className="rita-btn rita-btn-secondary">
              Browse decks
            </Link>
            <Link
              to="/share/new"
              search={{ space: undefined }}
              className="rita-btn rita-btn-primary"
            >
              Share a deck
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
