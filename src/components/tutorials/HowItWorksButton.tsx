import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ToolTutorial, useTutorialLang } from "@/components/tutorials/ToolTutorial";
import { toolForPath, type ToolDef } from "@/lib/site-tools";

/** The button itself — usable anywhere with an explicit tool. */
export function HowItWorksButton({ tool }: { tool: ToolDef }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useTutorialLang();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/90 px-4 py-2 text-[13px] font-black text-[#23201d] shadow-sm backdrop-blur transition-colors hover:bg-white"
      >
        <HelpCircle size={15} style={{ color: tool.ink }} />
        How it works
        <span className="text-[11px] font-bold text-[#a1957f]">EN / ع</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
          <DialogTitle className="sr-only">{tool.name.en} tutorial</DialogTitle>
          <ToolTutorial tool={tool} lang={lang} onLang={setLang} showOpenLink={false} />
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Floating launcher mounted once in the root layout: it shows itself only on
 * pages that belong to a known tool.
 */
export function ToolTutorialLauncher() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const tool = toolForPath(pathname);
  if (!tool) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 print:hidden">
      <div className="pointer-events-auto">
        <HowItWorksButton tool={tool} />
      </div>
    </div>
  );
}
