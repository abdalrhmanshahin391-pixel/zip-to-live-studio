import { Link } from "@tanstack/react-router";
import toolkitArt from "@/assets/toolkit-girl-study.jpeg.asset.json";
import plansArt from "@/assets/pricing-monthly-dark.jpg.asset.json";
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
    <article className="relative min-h-[590px] overflow-hidden rounded-[28px] border border-white/10 bg-[#121212] px-6 pt-12 text-center md:min-h-[650px] md:rounded-[34px] md:px-10 md:pt-14">
      <p className="text-[20px] font-bold text-white md:text-[22px]">RitaJet <span className="rita-accent font-normal">{label}</span></p>
      <h2 className="mt-6 text-[36px] font-bold leading-[1.05] text-white md:text-[44px]">{title}</h2>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link to="/pricing" className="rita-btn rita-btn-secondary">Learn more</Link>
        <Link to="/pricing" className="rita-btn rita-btn-primary">Buy now</Link>
      </div>
      <p className="mt-5 text-[15px] font-normal text-white/48 md:text-[17px]">{note}</p>

      <div
        className={`absolute bottom-[-9%] w-[112%] md:w-[108%] ${
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

export function ProductShowcase() {
  return (
    <section className="mx-auto grid w-full max-w-[1240px] gap-5 px-5 pb-24 md:grid-cols-2 md:px-8">
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
    </section>
  );
}