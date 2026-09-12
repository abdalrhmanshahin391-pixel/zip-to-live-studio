import { useEffect, useState, useRef, useCallback } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles, X, Languages, CheckCircle2 } from "lucide-react";
import type { PageTourDef, TourStep } from "@/lib/tour-registry";
import type { TutorialLang } from "./ToolTutorial";

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
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
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = useState(320);

  const isAr = lang === "ar";
  const step: TourStep | undefined = tour.steps[stepIndex];

  // Measure card height whenever step, lang, or window changes
  useEffect(() => {
    if (!cardRef.current) return;
    const updateH = () => {
      if (cardRef.current) {
        setCardHeight(cardRef.current.offsetHeight || 320);
      }
    };
    updateH();
    const observer = new ResizeObserver(() => updateH());
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [stepIndex, lang, open]);

  // Viewport resize listener
  useEffect(() => {
    const checkViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkViewport();
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

function safeFindElement(selector?: string): HTMLElement | null {
  if (!selector) return null;
  try {
    return document.querySelector(selector) as HTMLElement | null;
  } catch (err) {
    console.warn(`[LivePageTour] Invalid or unresolvable selector "${selector}":`, err);
    return null;
  }
}

  // Update rect of the spotlighted target element
  const updateRect = useCallback(() => {
    if (!open || !step) {
      setRect(null);
      return;
    }

    let el = safeFindElement(step.targetSelector);
    if (!el && step.fallbackSelector) {
      el = safeFindElement(step.fallbackSelector);
    }

    if (el) {
      const b = el.getBoundingClientRect();
      const mobile = window.innerWidth < 768;
      const reservedBottom = mobile ? 340 : 380;

      // Ensure element is positioned in the upper portion of viewport with ample room below
      const isComfortable =
        b.top >= 70 &&
        b.bottom <= window.innerHeight - reservedBottom;

      if (!isComfortable) {
        const targetScroll = window.scrollY + b.top - (mobile ? 75 : 95);
        window.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: "smooth",
        });
      }

      const freshRect = el.getBoundingClientRect();
      const pad = mobile ? 6 : 10;
      // Highlight the entire element accurately without artificial height cutoffs
      const elementHeight = freshRect.height;

      setRect({
        top: Math.max(0, freshRect.top - pad),
        left: Math.max(0, freshRect.left - pad),
        width: freshRect.width + pad * 2,
        height: elementHeight + pad * 2,
        bottom: freshRect.top - pad + elementHeight + pad * 2,
        right: freshRect.left - pad + freshRect.width + pad * 2,
      });
    } else {
      // Graceful fallback center box
      const w = Math.min(360, window.innerWidth - 32);
      const h = 180;
      setRect({
        top: 100,
        left: Math.max(16, (window.innerWidth - w) / 2),
        width: w,
        height: h,
        bottom: 100 + h,
        right: Math.max(16, (window.innerWidth - w) / 2) + w,
      });
    }
  }, [open, step]);

  // Recalculate spotlight geometry on step change, resize, and scroll
  useEffect(() => {
    if (!open) return;
    updateRect();
    const timer = setTimeout(updateRect, 320); // allow smooth scroll to settle

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
      const editBtn = safeFindElement(
        '[data-tour="mode-switch"] button:nth-child(2)'
      ) as HTMLButtonElement | null;
      if (editBtn) {
        editBtn.click();
        setTimeout(updateRect, 250);
      }
    }
  };

  // --- Strict Viewport-Contained Collision-Free Card Placement ---
  let cardStyle: React.CSSProperties = {};
  const maxCardH = Math.min(480, window.innerHeight - 32);

  if (isMobile) {
    // Docked mobile bottom sheet with safe area insets
    cardStyle = {
      position: "fixed",
      bottom: "max(0.75rem, env(safe-area-inset-bottom))",
      left: "0.75rem",
      right: "0.75rem",
      maxWidth: "34rem",
      maxHeight: "min(420px, 62vh)",
      margin: "0 auto",
      zIndex: 9999,
    };
  } else if (rect) {
    const cardWidth = Math.min(460, window.innerWidth - 32);
    const estHeight = Math.min(cardHeight || 340, maxCardH);
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;
    const spaceAbove = rect.top;

    let top: number | undefined = undefined;
    let bottom: number | undefined = undefined;
    let left: number | undefined = undefined;
    let right: number | undefined = undefined;

    // 1. Preferred: cleanly below the highlighted element
    if (spaceBelow >= estHeight + 20) {
      top = rect.bottom + 16;
      left = isAr ? Math.max(16, rect.right - cardWidth) : Math.max(16, rect.left);
    }
    // 2. Side-by-Side: Place to the right of the highlighted element
    else if (spaceRight >= cardWidth + 24) {
      left = rect.right + 16;
      top = Math.max(16, Math.min(window.innerHeight - estHeight - 16, rect.top));
    }
    // 3. Side-by-Side: Place to the left of the highlighted element
    else if (spaceLeft >= cardWidth + 24) {
      left = Math.max(16, rect.left - cardWidth - 16);
      top = Math.max(16, Math.min(window.innerHeight - estHeight - 16, rect.top));
    }
    // 4. Above: Only if there is clean space above without touching the element
    else if (spaceAbove >= estHeight + 20) {
      top = Math.max(16, rect.top - estHeight - 16);
      left = isAr ? Math.max(16, rect.right - cardWidth) : Math.max(16, rect.left);
    }
    // 5. Fallback: For large elements (like calendar) where neither sides nor below have clearance,
    // dock to the bottom corner so the card and its controls NEVER get pushed below the screen!
    else {
      bottom = 16;
      if (isAr) {
        left = 20;
      } else {
        right = 20;
      }
    }

    cardStyle = {
      position: "fixed",
      ...(top !== undefined ? { top: `${Math.max(16, Math.min(window.innerHeight - estHeight - 16, top))}px` } : {}),
      ...(bottom !== undefined ? { bottom: `${bottom}px` } : {}),
      ...(left !== undefined ? { left: `${Math.max(16, Math.min(window.innerWidth - cardWidth - 16, left))}px` } : {}),
      ...(right !== undefined ? { right: `${right}px` } : {}),
      width: `${cardWidth}px`,
      maxHeight: `${maxCardH}px`,
      zIndex: 9999,
    };
  }

  return (
    <div className="live-tour-root">
      {/* SVG Mask Definition for transparent spotlight cutout */}
      <svg className="fixed inset-0 pointer-events-none z-[9990] h-full w-full" aria-hidden="true">
        <defs>
          <mask id="tour-spotlight-mask" x="0" y="0" width="100%" height="100%">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left}
                y={rect.top}
                width={rect.width}
                height={rect.height}
                rx={20}
                ry={20}
                fill="black"
              />
            )}
          </mask>
        </defs>
      </svg>

      {/* Full screen backdrop: blurred and darkened everywhere EXCEPT the spotlight cutout */}
      <div
        className="fixed inset-0 z-[9990] bg-black/55 backdrop-blur-[3px] transition-opacity duration-300"
        onClick={onClose}
        style={{
          mask: "url(#tour-spotlight-mask)",
          WebkitMask: "url(#tour-spotlight-mask)",
        }}
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
              "0 0 0 9999px rgba(12, 10, 8, 0.45), 0 0 25px 5px rgba(47, 125, 85, 0.55)",
            border: "2.5px solid rgba(47, 125, 85, 0.9)",
            zIndex: 9995,
          }}
        >
          {/* Pulsating radiant ring */}
          <div className="absolute -inset-1 rounded-[22px] border border-emerald-400/50 animate-pulse" />
        </div>
      )}

      {/* Explanatory Spotlight Floating Card */}
      <div
        ref={cardRef}
        style={cardStyle}
        dir={isAr ? "rtl" : "ltr"}
        className="flex flex-col overflow-hidden rounded-[26px] border border-black/[0.12] bg-[#fbf5e9] p-5 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.55)] animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Card Top Navigation Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-black/[0.08] pb-3">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#2f7d55] text-[11px] font-black text-white shadow-xs">
              {stepIndex + 1}
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#6b655c]">
              {isAr
                ? `الخطوة ${stepIndex + 1} من ${tour.steps.length}`
                : `Step ${stepIndex + 1} of ${tour.steps.length}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Prominent Language Switcher */}
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

        {/* Scrollable Content Body for Comprehensive Explanations */}
        <div className="mt-3.5 min-h-0 flex-1 overflow-y-auto pr-1">
          <h3 className="font-display text-[17px] sm:text-[18px] font-black leading-snug text-[#23201d]">
            {step.title[lang]}
          </h3>

          <p className="mt-2 text-[13.5px] leading-relaxed text-[#4a453d] font-medium">
            {step.description[lang]}
          </p>

          {/* Key detailed bullets */}
          {step.bullets && (
            <ul className="mt-3 space-y-2 text-[12.5px] text-[#3a352e]">
              {step.bullets[lang].map((bullet, i) => (
                <li key={i} className="flex items-start gap-2 leading-relaxed">
                  <CheckCircle2 size={14} className="text-[#2f7d55] shrink-0 mt-0.5" />
                  <span className="flex-1">{bullet}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Interactive Action Prompt */}
          {step.actionPrompt && (
            <button
              type="button"
              onClick={() => handleAction(step.actionPrompt!.actionId)}
              className="mt-3.5 flex w-full items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-[12.5px] font-black text-emerald-950 transition-all hover:bg-emerald-100 active:scale-98 shadow-xs"
            >
              <span>{step.actionPrompt.label[lang]}</span>
              <ArrowRight size={14} className={isAr ? "rotate-180" : ""} />
            </button>
          )}
        </div>

        {/* Card Footer: Progress Dots & Navigation */}
        <div className="mt-4 flex shrink-0 items-center justify-between border-t border-black/[0.07] pt-3.5">
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
