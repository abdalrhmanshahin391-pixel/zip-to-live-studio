import { Link } from "@tanstack/react-router";
import { EditableImage } from "@/components/site/EditableImage";
import { useReveal } from "@/hooks/useReveal";
import germanLabArt from "@/assets/german-lab-home.jpeg.asset.json";

export function GermanLabFeature() {
  const opening = useReveal<HTMLDivElement>();
  const tablet = useReveal<HTMLDivElement>();
  const closing = useReveal<HTMLDivElement>();

  return (
    <section className="overflow-hidden py-32 md:py-52">
      <div className="mx-auto w-full max-w-[1240px] px-5 md:px-8">
        <div ref={opening.ref} className={`rita-reveal max-w-[1040px] ${opening.shown ? "rita-reveal-in" : ""}`}>
          <p className="rita-accent text-[12px] font-black uppercase tracking-[0.18em]">German Lab</p>
          <h2 className="rita-ink mt-7 text-[42px] font-bold leading-[1.06] md:text-[70px]">
            Stop guessing the words that matter. Learn the pattern, then{" "}
            <span className="rita-accent">say it with confidence.</span>
          </h2>
          <p className="rita-ink-soft mt-8 max-w-[730px] text-[18px] leading-[1.65] md:text-[22px]">
            Train articles, pronunciation and sentence building in one connected place,
            with every difficult word returning until it sticks.
          </p>
        </div>

        <div ref={tablet.ref} className={`rita-reveal mx-auto mt-24 max-w-[1080px] md:mt-36 ${tablet.shown ? "rita-reveal-in" : ""}`} style={{ transitionDelay: "90ms" }}>
          <div className="rita-ipad-shell relative p-[8px] md:rounded-[40px] md:p-[11px]">
            <span aria-hidden className="rita-ipad-camera absolute left-1/2 top-[3px] h-1 w-12 -translate-x-1/2 rounded-full" />
            <div className="relative aspect-[1269/769] overflow-hidden rounded-[24px] bg-[color:var(--pro-card)] md:rounded-[31px]">
              <EditableImage imageKey="home.feature.german-lab" fallback={germanLabArt.url} alt="German Lab with der, die and das practice and pronunciation tools" width={1269} height={769} loading="lazy" className="h-full w-full object-contain" />
              <span aria-hidden className="rita-ipad-glass pointer-events-none absolute inset-0" />
            </div>
          </div>
        </div>

        <div ref={closing.ref} className={`rita-reveal mx-auto mt-24 max-w-[900px] text-center md:mt-40 ${closing.shown ? "rita-reveal-in" : ""}`} style={{ transitionDelay: "120ms" }}>
          <p className="rita-ink text-[36px] font-bold leading-[1.12] md:text-[58px]">
            See <span className="text-[color:var(--german-der)]">der</span>, hear every sound,
            and rebuild the sentence — <span className="rita-accent">all from one word shelf.</span>
          </p>
          <div className="mt-10 flex justify-center">
            <Link to="/german" className="rita-btn rita-btn-primary">Open German Lab</Link>
          </div>
        </div>
      </div>
    </section>
  );
}