import { Headphones, Radio, Sparkles } from "lucide-react";
import ritaPortrait from "@/assets/rita-live/rita-voice-portrait.png";

export type RitaMood = "ready" | "listening" | "thinking" | "talking" | "laughing";

const moodCopy: Record<RitaMood, string> = {
  ready: "Ready for your lesson",
  listening: "I’m listening…",
  thinking: "Let me think…",
  talking: "Rita is speaking",
  laughing: "That was excellent",
};

type Props = {
  mood: RitaMood;
  active: boolean;
  inputLevel?: number;
  outputLevel?: number;
  caption?: string;
  dialect?: string;
};

export function RitaStage({
  mood,
  active,
  inputLevel = 0,
  outputLevel = 0,
  caption,
  dialect,
}: Props) {
  const level = mood === "talking" ? outputLevel : inputLevel;
  const energy = Math.min(1, Math.max(0, level));
  const speaking = mood === "talking" || mood === "laughing";
  const listening = mood === "listening";
  const thinking = mood === "thinking";
  const glow = active
    ? speaking
      ? "rgba(246, 146, 63, .62)"
      : "rgba(127, 187, 76, .58)"
    : "rgba(154, 148, 133, .2)";

  return (
    <div className="relative isolate flex h-full min-h-[430px] flex-col overflow-hidden bg-[#171b16] text-white md:min-h-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_36%,rgba(123,164,76,.2),transparent_34%),radial-gradient(circle_at_85%_75%,rgba(224,120,54,.13),transparent_32%),linear-gradient(145deg,#1b211a_0%,#121611_52%,#20231c_100%)]" />
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,.45) 1px, transparent 1.5px)",
          backgroundSize: "34px 34px",
          maskImage: "linear-gradient(to bottom, black, transparent 82%)",
        }}
      />
      <div className="absolute -left-24 top-1/3 h-56 w-56 rounded-full bg-[#6fa947]/10 blur-3xl" />
      <div className="absolute -right-24 bottom-10 h-64 w-64 rounded-full bg-[#e27b3c]/10 blur-3xl" />

      <header className="relative z-20 flex items-center justify-between px-5 py-5 md:px-8 md:py-7">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-3 py-2 text-[11px] font-black tracking-[.16em] text-white/85 backdrop-blur-xl">
          <Sparkles size={14} className="text-[#e7944d]" /> RITA LIVE
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-bold text-white/65 backdrop-blur-xl">
          <span
            className={`h-2 w-2 rounded-full ${active ? "bg-[#8bc95b] shadow-[0_0_14px_#8bc95b]" : "bg-white/30"}`}
          />
          {active ? "Lesson active" : "Not connected"}
        </span>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-6">
        <div className="relative grid place-items-center">
          <div
            className={`absolute rounded-full border transition-all duration-150 ${active ? "border-white/10" : "border-white/[.05]"}`}
            style={{
              inset: `${-30 - energy * 24}px`,
              boxShadow: `0 0 ${36 + energy * 70}px ${10 + energy * 20}px ${glow}`,
              transform: `scale(${1 + energy * 0.055})`,
            }}
          />
          <div
            className={`absolute -inset-10 rounded-full border-2 border-dashed ${thinking ? "animate-spin border-[#e7944d]/45 [animation-duration:7s]" : "border-white/[.07]"}`}
          />
          <div
            className={`absolute -inset-5 rounded-full border ${listening ? "animate-pulse border-[#8bc95b]/70" : speaking ? "border-[#e7944d]/70" : "border-white/10"}`}
          />
          <div className="relative h-52 w-52 overflow-hidden rounded-full border-4 border-[#f4ead8]/90 bg-[radial-gradient(circle_at_50%_25%,#f5d49b,#b96b3e_68%,#5b3326)] shadow-[0_28px_80px_-28px_rgba(0,0,0,.9)] sm:h-64 sm:w-64 lg:h-72 lg:w-72">
            <img
              src={ritaPortrait}
              alt="Rita, your language tutor"
              className={`h-full w-full object-cover object-center transition-transform duration-500 ${active ? "scale-[1.03]" : "scale-100 grayscale-[.12]"}`}
            />
            <div className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(145deg,rgba(255,255,255,.2),transparent_32%,rgba(0,0,0,.12))]" />
          </div>
          {active && (
            <div className="absolute -bottom-5 flex h-11 items-end gap-1 rounded-full border border-white/10 bg-[#10130f]/85 px-4 py-2 shadow-xl backdrop-blur-xl">
              {Array.from({ length: 13 }, (_, index) => {
                const wave = Math.abs(Math.sin(index * 0.78 + energy * 4.5));
                const height = 5 + 8 + energy * 20 * wave;
                return (
                  <span
                    key={index}
                    className={`w-1 rounded-full transition-[height,background-color] duration-100 ${speaking ? "bg-[#ed914a]" : "bg-[#8bc95b]"}`}
                    style={{ height }}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-12 text-center" aria-live="polite">
          <div className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-[.19em] text-[#9cbb83]">
            {speaking ? <Radio size={14} /> : <Headphones size={14} />}
            {moodCopy[mood]}
          </div>
          <p className="mx-auto mt-3 max-w-sm text-lg font-semibold leading-snug text-white/90 md:text-xl">
            {caption ||
              "Start once, then speak naturally. Rita will listen and answer automatically."}
          </p>
          {dialect && dialect !== "standard" && dialect !== "unknown" && (
            <span className="mt-4 inline-flex rounded-full border border-[#8bc95b]/25 bg-[#8bc95b]/10 px-3 py-1.5 text-xs font-bold text-[#b9dc9d]">
              {dialect === "ar-JO"
                ? "Jordanian Arabic"
                : dialect === "ar-IQ"
                  ? "Iraqi Arabic"
                  : dialect === "ar-LEV"
                    ? "Levantine Arabic"
                    : dialect}
            </span>
          )}
        </div>
      </div>

      <footer className="relative z-10 px-6 pb-6 text-center text-[11px] font-medium text-white/38 md:px-8 md:pb-8">
        Silence is free · Rita sends audio only when you speak
      </footer>
    </div>
  );
}
