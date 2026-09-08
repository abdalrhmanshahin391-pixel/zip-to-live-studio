import { Link } from "@tanstack/react-router";
import toolkitArt from "@/assets/toolkit-girl-study.jpeg.asset.json";
import plansArt from "@/assets/pricing-monthly-dark.jpg.asset.json";
import classroomArt from "@/assets/classrooms-groups-phone.jpg.asset.json";
import flashcardsArt from "@/assets/rita-flashcards-feature.jpg.asset.json";
import { EditableImage } from "@/components/site/EditableImage";

type ProductCardProps = {
  imageKey: string;
  label: string;
  title: string;
  note: string;
  image: string;
  imageAlt: string;
  side: "left" | "right";
};

function ProductCard({ imageKey, label, title, note, image, imageAlt, side }: ProductCardProps) {
  const left = side === "left";

  return (
    <article className="relative min-h-[767px] overflow-hidden rounded-[28px] border border-white/10 bg-[#121212] px-6 pt-12 text-center md:min-h-[845px] md:rounded-[34px] md:px-10 md:pt-14">
      <p className="text-[20px] font-bold text-white md:text-[22px]">RitaJet <span className="rita-accent font-normal">{label}</span></p>
      <h2 className="mt-6 text-[36px] font-bold leading-[1.05] text-white md:text-[44px]">{title}</h2>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link to="/pricing" className="rita-btn rita-btn-secondary">Learn more</Link>
        <Link to="/pricing" className="rita-btn rita-btn-primary">Buy now</Link>
      </div>
      <p className="mt-5 text-[15px] font-normal text-white/48 md:text-[17px]">{note}</p>

      <div
        className={`absolute bottom-[-4%] w-[118%] md:w-[114%] ${
          left ? "right-[9%] md:right-[12%]" : "left-[9%] md:left-[12%]"
        }`}
      >
        <div
          className="relative aspect-[16/10] rounded-[28px] p-[7px] md:rounded-[34px] md:p-[9px]"
          style={{
            background: "linear-gradient(145deg,#9ca2a8 0%,#444a50 8%,#1b1e21 28%,#111315 72%,#555b61 94%,#a8adb2 100%)",
            boxShadow: "0 1px 0 rgba(255,255,255,.22) inset, 0 18px 44px -32px rgba(43,39,33,.35)",
            transform: left ? "perspective(1400px) rotateY(4deg)" : "perspective(1400px) rotateY(-4deg)",
          }}
        >
          <div className="relative h-full w-full overflow-hidden rounded-[23px] bg-black md:rounded-[28px]">
            <EditableImage
              imageKey={imageKey}
              fallback={image}
              alt={imageAlt}
              width={1920}
              height={1072}
              className="h-full w-full object-cover"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(118deg,rgba(255,255,255,.12),transparent 32%,transparent 72%,rgba(255,255,255,.05))" }}
            />
            <span aria-hidden className="absolute left-1/2 top-[5px] h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-white/15" />
          </div>
        </div>
      </div>
    </article>
  );
}

function CommunityCard() {
  return (
    <article className="relative order-2 min-h-[720px] overflow-hidden rounded-[28px] border border-white/10 bg-[#121212] px-7 pt-11 md:order-1 md:min-h-[760px] md:rounded-[34px] md:px-10 md:pt-14">
      <p className="text-[19px] font-bold text-white md:text-[21px]">
        RitaJet <span className="rita-accent font-normal">Community</span>
      </p>
      <h2 className="mt-5 max-w-[16rem] text-[36px] font-bold leading-[1.05] text-white md:text-[43px]">
        Learn better, together.
      </h2>
      <p className="mt-5 max-w-[17rem] text-[15px] leading-relaxed text-white/48 md:text-[17px]">
        Private classrooms, focused groups and shared decks.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link to="/spaces" className="rita-btn rita-btn-secondary">Learn more</Link>
        <Link to="/spaces" className="rita-btn rita-btn-primary">Open spaces</Link>
      </div>

      <div className="absolute bottom-[-15%] left-1/2 w-[68%] min-w-[220px] max-w-[310px] -translate-x-1/2 md:w-[76%]">
        <div
          className="relative aspect-[9/19.5] rounded-[42px] p-[7px] md:rounded-[50px] md:p-[9px]"
          style={{
            background: "linear-gradient(145deg,var(--pro-ink),color-mix(in oklab,var(--pro-ink) 72%,white),var(--pro-ink))",
            boxShadow: "0 1px 0 color-mix(in oklab,white 40%,transparent) inset",
            transform: "perspective(1200px) rotateY(5deg)",
          }}
        >
          <div className="relative h-full w-full overflow-hidden rounded-[36px] bg-black md:rounded-[43px]">
            <EditableImage
              imageKey="home.feature.community"
              fallback={classroomArt.url}
              alt="Medical students studying together with shared RitaJet flashcards"
              width={1024}
              height={1536}
              className="h-full w-full object-cover object-center"
            />
            <span aria-hidden className="absolute left-1/2 top-2 z-10 h-[22px] w-[72px] -translate-x-1/2 rounded-full bg-black" />
            <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/10" />
          </div>
        </div>
      </div>
    </article>
  );
}

function FlashcardsFeatureCard() {
  return (
    <article className="relative order-1 min-h-[570px] overflow-hidden rounded-[28px] border border-white/10 bg-[#121212] md:order-2 md:min-h-[760px] md:rounded-[34px]">
      <EditableImage
        imageKey="home.feature.flashcards"
        fallback={flashcardsArt.url}
        alt="A student reviewing a RitaJet medical flashcard on an iPad"
        width={1536}
        height={1024}
        className="absolute inset-0 h-full w-full object-cover object-[60%_center] md:object-center"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg,transparent 34%,color-mix(in oklab,var(--pro-ink) 18%,transparent) 58%,color-mix(in oklab,var(--pro-ink) 88%,transparent) 100%)",
        }}
      />
      <div className="rita-onart absolute inset-x-0 bottom-0 z-10 flex flex-col items-start gap-6 p-7 md:flex-row md:items-end md:justify-between md:p-11">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-[0.16em] text-white/75">Flashcards</p>
          <h2 className="mt-3 max-w-[34rem] text-[36px] font-bold leading-[1.06] text-white md:text-[48px]">
            Turn every topic into something you remember.
          </h2>
        </div>
        <Link to="/study" className="rita-btn rita-btn-primary">Start reviewing</Link>
      </div>
    </article>
  );
}

export function ProductShowcase() {
  return (
    <section className="mx-auto w-full max-w-[1240px] space-y-5 px-5 pb-24 md:px-8">
      <div className="grid gap-5 md:grid-cols-2">
        <ProductCard
          imageKey="home.product.plans"
          label="Plans"
          title="Study without limits."
          note="Flexible plans for every study rhythm."
          image={plansArt.url}
          imageAlt="RitaJet study plans displayed across a focused night-time study workspace"
          side="left"
        />
        <ProductCard
          imageKey="home.product.toolkit"
          label="Toolkit"
          title="Everything in one place."
          note="Flashcards, summaries and questions."
          image={toolkitArt.url}
          imageAlt="A student reviewing colorful flashcards with the RitaJet toolkit on an iPad"
          side="right"
        />
      </div>

      <div className="grid gap-5 md:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.78fr)]">
        <CommunityCard />
        <FlashcardsFeatureCard />
      </div>
    </section>
  );
}