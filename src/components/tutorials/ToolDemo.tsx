import type { DemoKind, ToolDef } from "@/lib/site-tools";

/**
 * Small looping mock of what a tool does. Pure CSS/SVG — no video, no assets,
 * and it respects "reduce motion" through the motion-reduce: variants.
 */
export function ToolDemo({ tool }: { tool: ToolDef }) {
  const kind: DemoKind = tool.demo;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-black/[0.07] p-5"
      style={{ background: tool.soft }}
      aria-hidden
    >
      <div className="mx-auto w-full max-w-sm">{render(kind, tool)}</div>
    </div>
  );
}

function bar(w: string, delay: number, ink: string) {
  return (
    <span
      className="block h-2 rounded-full motion-reduce:animate-none animate-pulse"
      style={{ width: w, background: ink, opacity: 0.35, animationDelay: `${delay}ms` }}
    />
  );
}

function render(kind: DemoKind, tool: ToolDef) {
  const ink = tool.ink;

  switch (kind) {
    case "cards":
      return (
        <div className="relative h-40">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute inset-x-6 top-3 grid h-28 place-items-center rounded-2xl border border-black/[0.06] bg-white text-center shadow-sm motion-reduce:animate-none"
              style={{
                transform: `translateY(${i * 8}px) rotate(${(i - 1) * 2}deg)`,
                animation: `ritax-shuffle 4.5s ${i * 1.5}s infinite ease-in-out`,
                zIndex: 3 - i,
              }}
            >
              <div className="px-4">
                <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: ink }}>
                  card {i + 1}
                </div>
                <div className="mt-2 font-display text-[17px] font-black text-[#23201d]">
                  {["What is it?", "Flip me", "Got it ✓"][i]}
                </div>
              </div>
            </div>
          ))}
        </div>
      );

    case "match":
      return (
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid h-14 place-items-center rounded-xl bg-white text-[13px] font-black text-[#23201d] shadow-sm motion-reduce:animate-none"
              style={{ animation: `ritax-pop 3.2s ${i * 0.25}s infinite ease-in-out` }}
            >
              {["A", "1", "B", "2", "C", "3", "D", "4"][i]}
            </div>
          ))}
        </div>
      );

    case "summary":
      return (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: ink }}>
            summary sheet
          </div>
          <div className="mt-3 space-y-2">
            {["92%", "76%", "84%", "60%", "70%"].map((w, i) => (
              <span key={w} className="block">
                {bar(w, i * 260, ink)}
              </span>
            ))}
          </div>
          <div
            className="mt-4 h-8 rounded-full motion-reduce:animate-none"
            style={{ background: ink, opacity: 0.15, animation: "ritax-slide 3.5s infinite ease-in-out" }}
          />
        </div>
      );

    case "todo":
      return (
        <div className="space-y-2">
          {["Revise anatomy", "20 flashcards", "Read summary"].map((label, i) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm motion-reduce:animate-none"
              style={{ animation: `ritax-check 4s ${i * 1.1}s infinite ease-in-out` }}
            >
              <span
                className="grid h-6 w-6 place-items-center rounded-md text-[12px] font-black text-white"
                style={{ background: ink }}
              >
                ✓
              </span>
              <span className="text-[14px] font-bold text-[#23201d]">{label}</span>
            </div>
          ))}
        </div>
      );

    case "calendar":
      return (
        <div className="grid grid-cols-7 gap-1.5 rounded-2xl bg-white p-3 shadow-sm">
          {Array.from({ length: 28 }).map((_, i) => (
            <div
              key={i}
              className="grid h-8 place-items-center rounded-md text-[11px] font-bold text-[#6b655c] motion-reduce:animate-none"
              style={
                [9, 17, 24].includes(i)
                  ? {
                      background: ink,
                      color: "#fff",
                      animation: `ritax-pop 3s ${i * 0.12}s infinite ease-in-out`,
                    }
                  : { background: "rgba(0,0,0,0.04)" }
              }
            >
              {i + 1}
            </div>
          ))}
        </div>
      );

    case "timer":
      return (
        <div className="grid place-items-center py-4">
          <div
            className="grid h-32 w-32 place-items-center rounded-full border-8 bg-white motion-reduce:animate-none"
            style={{ borderColor: ink, animation: "ritax-breathe 3s infinite ease-in-out" }}
          >
            <span className="font-display text-[26px] font-black tabular-nums text-[#23201d]">
              25:00
            </span>
          </div>
        </div>
      );

    case "allinone":
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
            <span
              className="grid h-9 w-9 place-items-center rounded-lg text-[11px] font-black text-white"
              style={{ background: ink }}
            >
              PDF
            </span>
            <div className="flex-1">{bar("70%", 0, ink)}</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["Summary", "Cards", "Questions"].map((label, i) => (
              <div
                key={label}
                className="rounded-xl bg-white p-3 text-center text-[11.5px] font-black text-[#23201d] shadow-sm motion-reduce:animate-none"
                style={{ animation: `ritax-rise 3.6s ${i * 0.5}s infinite ease-in-out` }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
      );

    case "qbank":
      return (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="text-[13px] font-black text-[#23201d]">Which nerve is it?</div>
          <div className="mt-3 space-y-2">
            {["A. Vagus", "B. Phrenic", "C. Ulnar", "D. Radial"].map((o, i) => (
              <div
                key={o}
                className="rounded-lg border border-black/[0.06] px-3 py-2 text-[12.5px] font-bold text-[#4a453d] motion-reduce:animate-none"
                style={
                  i === 1
                    ? {
                        background: ink,
                        color: "#fff",
                        animation: "ritax-pop 3.4s 1s infinite ease-in-out",
                      }
                    : undefined
                }
              >
                {o}
              </div>
            ))}
          </div>
        </div>
      );

    case "lecture":
      return (
        <div className="space-y-2">
          <div className="rounded-xl bg-white p-3 text-[12.5px] font-black text-[#23201d] shadow-sm">
            Lecture 4 — Cardiac cycle
          </div>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl bg-white/85 p-3 shadow-sm motion-reduce:animate-none"
              style={{ animation: `ritax-rise 3.6s ${i * 0.6}s infinite ease-in-out` }}
            >
              {bar("85%", i * 200, ink)}
            </div>
          ))}
        </div>
      );

    case "share":
      return (
        <div className="grid grid-cols-2 gap-2">
          {["Everyone", "My classroom"].map((label, i) => (
            <div
              key={label}
              className="rounded-2xl bg-white p-4 text-center shadow-sm motion-reduce:animate-none"
              style={{ animation: `ritax-pop 3.4s ${i * 0.9}s infinite ease-in-out` }}
            >
              <div className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: ink }}>
                share with
              </div>
              <div className="mt-1 text-[14px] font-black text-[#23201d]">{label}</div>
            </div>
          ))}
        </div>
      );

    case "spaces":
      return (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className="h-8 w-8 rounded-full motion-reduce:animate-none"
                style={{
                  background: ink,
                  opacity: 0.25 + i * 0.2,
                  animation: `ritax-pop 3s ${i * 0.3}s infinite ease-in-out`,
                }}
              />
            ))}
            <span className="ml-auto text-[11.5px] font-black text-[#6b655c]">4 members</span>
          </div>
          <div className="mt-3 space-y-2">
            {bar("90%", 0, ink)}
            {bar("64%", 300, ink)}
          </div>
        </div>
      );

    case "german":
      return (
        <div className="space-y-3">
          <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
            <div className="font-display text-[22px] font-black text-[#23201d]">die Nacht</div>
            <div className="text-[12px] font-bold text-[#6b655c]">Nacht → nacht</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["der", "die", "das"].map((a, i) => (
              <div
                key={a}
                className="rounded-xl bg-white py-2 text-center text-[13px] font-black text-[#23201d] shadow-sm motion-reduce:animate-none"
                style={
                  i === 1
                    ? { background: ink, color: "#fff", animation: "ritax-pop 3.2s 0.8s infinite ease-in-out" }
                    : undefined
                }
              >
                {a}
              </div>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
}
