import { useEffect, useState } from "react";
import { Headphones, Sparkles } from "lucide-react";
import workshopBackground from "@/assets/rita-live/workshop-background.webp";
import ritaReady from "@/assets/rita-live/rita-ready.webp";
import ritaTalking from "@/assets/rita-live/rita-talking.webp";
import ritaThinking from "@/assets/rita-live/rita-thinking.webp";
import ritaLaughing from "@/assets/rita-live/rita-laughing.webp";

export type RitaMood = "ready" | "listening" | "thinking" | "talking" | "laughing";

const moodCopy: Record<RitaMood, string> = {
  ready: "Ready when you are",
  listening: "Listening closely",
  thinking: "Thinking about your answer",
  talking: "Rita is speaking",
  laughing: "That made Rita smile",
};

export function RitaStage({ mood, active }: { mood: RitaMood; active: boolean }) {
  const [talkFrame, setTalkFrame] = useState(false);

  useEffect(() => {
    if (mood !== "talking") {
      setTalkFrame(false);
      return;
    }
    const timer = window.setInterval(() => setTalkFrame((frame) => !frame), 180);
    return () => window.clearInterval(timer);
  }, [mood]);

  const visible = mood === "talking" && !talkFrame ? "ready" : mood;
  const frames: { mood: RitaMood; src: string }[] = [
    { mood: "ready", src: ritaReady },
    { mood: "listening", src: ritaReady },
    { mood: "thinking", src: ritaThinking },
    { mood: "talking", src: ritaTalking },
    { mood: "laughing", src: ritaLaughing },
  ];

  return (
    <div className="relative isolate h-full min-h-[430px] overflow-hidden bg-[#f4f0e5] md:min-h-0">
      <img
        src={workshopBackground}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,253,247,.08),rgba(71,54,31,.06)_55%,rgba(50,39,23,.32))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_30%,rgba(255,249,224,.42),transparent_42%)]" />

      <div className="absolute left-5 top-5 z-20 inline-flex items-center gap-2 rounded-full border border-white/60 bg-[#fffdf8]/80 px-3 py-2 text-[11px] font-black tracking-[.14em] text-[#5b594f] shadow-sm backdrop-blur-md md:left-7 md:top-7">
        <Sparkles size={14} className="text-[#69ac39]" /> RITA LIVE
      </div>

      <div className="absolute inset-x-0 bottom-[4.6rem] top-14 z-10 flex items-end justify-center px-3 md:bottom-[5.3rem] md:top-16">
        <div
          className={`relative h-full w-full max-w-[720px] transition-transform duration-700 motion-reduce:transition-none ${
            mood === "listening" ? "rita-breathe" : ""
          }`}
          aria-label={`Rita is ${mood}`}
        >
          {frames.map((frame) => (
            <img
              key={frame.mood}
              src={frame.src}
              alt={frame.mood === "ready" ? "Rita seated at her workshop desk" : ""}
              className={`absolute inset-0 h-full w-full object-contain object-bottom transition-opacity duration-200 motion-reduce:transition-none ${
                visible === frame.mood ? "opacity-100" : "opacity-0"
              } ${frame.mood === "talking" ? "rita-talk" : ""}`}
            />
          ))}
        </div>
      </div>

      <div className="absolute inset-x-5 bottom-5 z-20 flex justify-center md:bottom-7">
        <div className="flex max-w-sm items-center gap-3 rounded-2xl border border-white/60 bg-[#fffdf8]/85 px-4 py-3 text-[#34322c] shadow-[0_18px_40px_-24px_rgba(46,37,22,.52)] backdrop-blur-xl">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${active ? "bg-[#e5f2d7] text-[#57952d]" : "bg-[#f0eee6] text-[#7c796f]"}`}
          >
            <Headphones
              size={18}
              className={active && mood === "listening" ? "animate-pulse" : ""}
            />
          </span>
          <div>
            <p className="text-sm font-extrabold">{moodCopy[mood]}</p>
            <p className="mt-0.5 text-xs text-[#7d796f]">
              Natural pauses, expressions and voice feedback
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
