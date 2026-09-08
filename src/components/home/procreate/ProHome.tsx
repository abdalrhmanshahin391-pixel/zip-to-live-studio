import { ProHeader } from "./ProHeader";
import { IpadStage } from "./IpadStage";
import { ShareBand } from "./ShareBand";
import { ProductShowcase } from "./ProductShowcase";
import { FeatureTriptych } from "./FeatureTriptych";
import { GermanLabFeature } from "./GermanLabFeature";
import { StartLearningLink } from "@/components/StartLearningLink";

/** Black, single-screen home page. */
export function ProHome() {
  return (
    <main
      className="rita-cream relative min-h-screen overflow-hidden bg-black text-white"
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <ProHeader />

      <IpadStage />

      <div className="mx-auto max-w-[900px] px-5 pb-24 pt-8 text-center md:pt-10">
        <p className="rita-accent text-[13px] font-bold uppercase tracking-[0.18em]">
          RitaJet Study
        </p>
        <h1
          className="mt-6 font-bold leading-[1.02] tracking-[-0.03em]"
          style={{ fontSize: "clamp(2.6rem,7vw,5.5rem)" }}
        >
          Learn. Recall. <span className="rita-accent">Pass.</span>
        </h1>
        <p className="mx-auto mt-7 max-w-[620px] text-[19px] leading-[1.5] text-white/60 md:text-[21px]">
          RitaJet is a study workspace that turns your own notes and lecture PDFs
          into flashcards, summaries and practice questions.
        </p>
        <div className="mt-10 flex justify-center">
          <StartLearningLink className="rita-btn rita-btn-primary">
            Start learning
          </StartLearningLink>
        </div>
        <p className="mt-5 text-[15px] text-white/45">Free to start. No card needed.</p>
      </div>

      <ProductShowcase />
      <FeatureTriptych />
      <GermanLabFeature />
      <ShareBand />
    </main>
  );
}
