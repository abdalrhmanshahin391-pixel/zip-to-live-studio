import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { ToolCard } from "@/components/learn/ToolCard";
import {
  SECTION_FLAG,
  TOOL_FLAG,
  sectionOf,
  toolsOf,
  type SectionId,
} from "@/lib/site-tools";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useSiteText } from "@/hooks/useSiteText";

export function SectionPage({ id }: { id: SectionId }) {
  const s = sectionOf(id);
  const tools = toolsOf(id);
  const { enabled, badge } = useFeatureFlags();
  const { text } = useSiteText();
  const sectionOff = !enabled(SECTION_FLAG(id));

  return (
    <div className="min-h-screen" style={{ background: "#fbf5e9", color: "#23201d" }}>
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 md:px-8 md:pt-12">
        <Link
          to="/learn"
          className="inline-flex items-center gap-2 text-[13px] font-extrabold text-[#7a6f5f] hover:text-[#23201d]"
        >
          <ArrowLeft size={15} /> All rooms
        </Link>

        <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h1 className="font-display text-[32px] font-black leading-[1.05] tracking-tight md:text-[42px]">
            {text(`rj.section.${id}.title`, s.title)}
          </h1>
          {badge(SECTION_FLAG(id)) ? (
            <span className="rounded-full bg-[#23201d] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white">
              {badge(SECTION_FLAG(id))}
            </span>
          ) : null}
        </div>
        <p className="mt-3 max-w-2xl text-[15.5px] leading-relaxed text-[#6b655c]">{text(`rj.section.${id}.intro`, s.intro)}</p>

        {sectionOff ? (
          <div className="mt-8 rounded-3xl border border-black/[0.07] bg-white p-6 text-[15px] font-semibold text-[#6b655c]">
            This room is closed right now. {badge(SECTION_FLAG(id)) ?? "Check back soon."}
          </div>
        ) : null}

        <div
          className={`mt-8 grid gap-6 ${s.columns.length > 1 ? "lg:grid-cols-2" : "grid-cols-1"}`}
        >
          {s.columns.map((col) => {
            const list = tools.filter((t) => t.column === col.id);
            if (list.length === 0) return null;
            return (
              <section
                key={col.id}
                className="rounded-[26px] border border-black/[0.06] bg-white/55 p-4 md:p-5"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-[#7a4b16]">
                    {col.label.en}
                  </h2>
                  <p className="text-[13px] font-semibold text-[#a1957f]">{col.note.en}</p>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {list.map((t) => (
                    <ToolCard
                      key={t.key}
                      tool={t}
                      badge={badge(TOOL_FLAG(t.key))}
                      locked={sectionOff || !enabled(TOOL_FLAG(t.key))}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
