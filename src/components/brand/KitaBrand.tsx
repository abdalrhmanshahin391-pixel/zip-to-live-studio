import avatar from "@/assets/kita-avatar.png";

/** The multi-colour swirl from Rita's home-page artwork, used on "Jet". */
const JET_GRADIENT =
  "linear-gradient(100deg, #f0a95c 0%, #ef9a7f 18%, #b39ddb 40%, #7cb8e8 62%, #7fcaa5 82%, #8ec63f 100%)";

/** "RitaJet" — Rita in ink, Jet painted with the home-page palette. */
export function BrandName({ size = 26 }: { size?: number }) {
  return (
    <span
      className="brand-jet font-display font-black tracking-tight text-foreground"
      style={{ fontSize: size, lineHeight: 1.05 }}
    >
      Rita
      <span className="relative inline-block">
        <span
          style={{
            backgroundImage: JET_GRADIENT,
            backgroundSize: "220% 100%",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
          className="brand-jet-text"
        >
          Jet
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 100 10"
          preserveAspectRatio="none"
          className="absolute left-0 w-full"
          style={{ bottom: -size * 0.14, height: size * 0.22 }}
        >
          <defs>
            <linearGradient id="jet-swirl" x1="0" x2="1">
              <stop offset="0%" stopColor="#f0a95c" />
              <stop offset="45%" stopColor="#b39ddb" />
              <stop offset="100%" stopColor="#8ec63f" />
            </linearGradient>
          </defs>
          <path
            d="M1 7 Q 18 1 34 6 T 66 6 T 99 4"
            fill="none"
            stroke="url(#jet-swirl)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </span>
  );
}


/** Rita brand block: circular character avatar + wordmark. */
export function KitaBrand({ size = 40 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className="grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-border bg-[color:var(--primary)]/15 ring-2 ring-white"
        style={{ height: size, width: size }}
      >
        <img
          src={avatar}
          alt="RitaJet"
          width={size}
          height={size}
          className="h-full w-full scale-110 object-cover object-top"
        />
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <BrandName size={Math.round(size * 0.62)} />
      </span>
    </span>
  );
}
