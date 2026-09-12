import { useEffect, useState, useRef, useCallback } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles, X, Languages } from "lucide-react";
import type { PageTourDef, TourStep } from "@/lib/tour-registry";
import type { TutorialLang } from "./ToolTutorial";

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function LivePageTour({
  open,
  onClose,
  tour,
  lang,
  onLang,
}: {
  open: boolean;
  onClose: () => void;
  tour: PageTourDef;
  lang: TutorialLang;
  onLang: (l: TutorialLang) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const isAr = lang === "ar";
  const step: TourStep | undefined = tour.steps[stepIndex];

  // Check viewport width
  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  // Update rect of the spotlighted target element
  const updateRect = useCallback(() => {
    if (!open || !step) {
      setRect(null);
      return;
    }

    let el = document.querySelector(step.targetSelector) as HTMLElement | null;
    if (!el && step.fallbackSelector) {
      el = document.querySelector(step.fallbackSelector) as HTMLElement | null;
    }

    if (el) {
      // Check if element is in viewport, scroll into view if needed
      const b = el.getBoundingClientRect();
      const isVisible =
        b.top >= 0 &&
        b.left >= 0 &&
        b.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        b.right <= (window.innerWidth || document.documentElement.clientWidth);

      if (!isVisible) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      const freshRect = el.getBoundingClientRect();
      const pad = isMobile ? 6 : 10;
      setRect({
        top: Math.max(0, freshRect.top - pad),
        left: Math.max(0, freshRect.left - pad),
        width: freshRect.width + pad * 2,
        height: freshRect.height + pad * 2,
      });
    } else {
      // Fallback center box if target is not mounted
      setRect({
        top: window.innerHeight * 0.25,
        left: Math.max(20, (window.innerWidth - 340) / 2),
        width: Math.min(340, window.innerWidth - 40),
        height: 180,
      });
    }
  }, [open, step, isMobile]);

  // Recalculate spotlight geometry on step change, resize, and scroll
  useEffect(() => {
    if (!open) return;
    updateRect();
    const timer = setTimeout(updateRect, 300); // allow smooth scroll to settle

    window.addEventListener("scroll", updateRect, { passive: true });
    window.addEventListener("resize", updateRect);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", updateRect);
      window.removeEventListener("resize", updateRect);
    };
  }, [open, stepIndex, updateRect]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        if (isAr) handleBack();
        else handleNext();
      } else if (e.key === "ArrowLeft") {
        if (isAr) handleNext();
        else handleBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, stepIndex, isAr]);

  if (!open || !step) return null;

  const handleNext = () => {
    if (stepIndex < tour.steps.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex((i) => i - 1);
    }
  };

  const handleAction = (actionId: string) => {
    if (actionId === "toggle-edit-mode") {
      // Switch view mode right on the page!
      const editBtn = document.querySelector(
        '[data-tour="mode-switch"] button:nth-child(2)'
      ) as HTMLButtonElement | null;
      if (editBtn) {
        editBtn.click();
        setTimeout(updateRect, 250);
      }
    }
  };

  // Card Positioning logic
  let cardStyle: React.CSSProperties = {};

  if (isMobile) {
    // Docked mobile bottom sheet with comfortable floating margin
    cardStyle = {
      position: "fixed",
      bottom: "max(1rem, env(safe-area-inset-bottom))",
      left: "1rem",
      right: "1rem",
      maxWidth: "32rem",
      margin: "0 auto",
      zIndex: 9999,
    };
  } else if (rect) {
    const cardWidth = 420;
    const cardHeightEst = 280;
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const spaceAbove = rect.top;

    let top = 0;
    if (spaceBelow >= cardHeightEst + 24 || spaceBelow >= spaceAbove) {
      top = Math.min(window.innerHeight - cardHeightEst - 20, rect.top + rect.height + 16);
    } else {
      top = Math.max(16, rect.top - cardHeightEst - 16);
    }

    // Align horizontally with target or keep inside viewport
    let left = rect.left;
    if (isAr) {
      left = rect.left + rect.width - cardWidth;
    }
    left = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, left));

    cardStyle = {
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      width: `${cardWidth}px`,
      zIndex: 9999,
    };
  }

  return (
    <div className="live-tour-root">
      {/* Full screen backdrop click blocker */}
      <div
        className="fixed inset-0 z-[9990] bg-black/40 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Radiant Spotlight Cutout Frame */}
      {rect && (
        <div
          className="pointer-events-none fixed transition-all duration-300 ease-out"
          style={{
            top: `${rect.top}px`,
            left: `${rect.left}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            borderRadius: "20px",
            boxShadow:
              "0 0 0 9999px rgba(12, 10, 8, 0.65), 0 0 25px 4px rgba(47, 125, 85, 0.55)",
            border: "2.5px solid rgba(47, 125, 85, 0.9)",
            zIndex: 9995,
          }}
        >
          {/* Subtle pulsating shimmer ring */}
          <div className="absolute -inset-1 rounded-[22px] border border-emerald-400/40 animate-pulse" />
        </div>
      )}

      {/* Explanatory Spotlight Floating Card */}
      <div
        style={cardStyle}
        dir={isAr ? "rtl" : "ltr"}
        className="overflow-hidden rounded-[24px] border border-black/[0.12] bg-[#fbf5e9] p-5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.45)] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-black/[0.07] pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#2f7d55] text-[11px] font-black text-white">
              {stepIndex + 1}
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#6b655c]">
              {isAr
                ? `الخطوة ${stepIndex + 1} من ${tour.steps.length}`
                : `Step ${stepIndex + 1} of ${tour.steps.length}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Obvious Language Switcher */}
            <div className="inline-flex items-center rounded-full border border-black/[0.09] bg-white p-0.5 shadow-xs" dir="ltr">
              <button
                type="button"
                onClick={() => onLang("en")}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase transition-all ${
                  lang === "en"
                    ? "bg-[#23201d] text-white shadow-xs"
                    : "text-[#6b655c] hover:text-[#23201d]"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => onLang("ar")}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-black transition-all ${
                  lang === "ar"
                    ? "bg-[#23201d] text-white shadow-xs"
                    : "text-[#6b655c] hover:text-[#23201d]"
                }`}
              >
                عربية
              </button>
            </div>

            {/* Skip Button */}
            <button
              type="button"
              onClick={onClose}
              className="text-[12px] font-extrabold text-[#7a7265] hover:text-[#23201d] px-1.5 transition-colors"
            >
              {isAr ? "تخطي" : "Skip"}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close tour"
              className="grid h-7 w-7 place-items-center rounded-full bg-black/[0.05] hover:bg-black/[0.1] text-[#23201d] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Card Content */}
        <div className="mt-3.5">
          <h3 className="font-display text-[17px] sm:text-[18px] font-black leading-snug text-[#23201d]">
            {step.title[lang]}
          </h3>

          <p className="mt-2 text-[13.5px] leading-relaxed text-[#4a453d]">
            {step.description[lang]}
          </p>

          {/* Key bullets if provided */}
          {step.bullets && (
            <ul className="mt-2.5 space-y-1.5 text-[12.5px] text-[#3a352e]">
              {step.bullets[lang].map((bullet, i) => (
                <li key={i} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-[#2f7d55] font-black mt-0.5">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Interactive Action Prompt */}
          {step.actionPrompt && (
            <button
              type="button"
              onClick={() => handleAction(step.actionPrompt!.actionId)}
              className="mt-3.5 flex w-full items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-[12.5px] font-black text-emerald-950 transition-all hover:bg-emerald-100 active:scale-98"
            >
              <span>{step.actionPrompt.label[lang]}</span>
              <ArrowRight size={14} className={isAr ? "rotate-180" : ""} />
            </button>
          )}
        </div>

        {/* Card Footer: Progress & Navigation */}
        <div className="mt-5 flex items-center justify-between border-t border-black/[0.07] pt-3.5">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5" dir="ltr">
            {tour.steps.map((_, i) => (
              <span
                key={i}
                onClick={() => setStepIndex(i)}
                className={`cursor-pointer rounded-full transition-all ${
                  stepIndex === i
                    ? "h-2 w-5 bg-[#2f7d55]"
                    : "h-2 w-2 bg-black/20 hover:bg-black/40"
                }`}
              />
            ))}
          </div>

          {/* Back & Next Navigation Buttons */}
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1 rounded-full border border-black/[0.1] bg-white px-3.5 py-1.5 text-[12.5px] font-bold text-[#23201d] transition-colors hover:bg-black/[0.04]"
              >
                {isAr ? <ArrowRight size={13} /> : <ArrowLeft size={13} />}
                {isAr ? "السابق" : "Back"}
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#2f7d55] px-4 py-1.5 text-[12.5px] font-black text-white shadow-sm transition-all hover:bg-[#256344] active:scale-98"
            >
              <span>
                {stepIndex === tour.steps.length - 1
                  ? isAr
                    ? "إنهاء الجولة ✓"
                    : "Finish tour ✓"
                  : isAr
                    ? "التالي"
                    : "Next"}
              </span>
              {stepIndex < tour.steps.length - 1 && (
                isAr ? <ArrowLeft size={13} /> : <ArrowRight size={13} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
