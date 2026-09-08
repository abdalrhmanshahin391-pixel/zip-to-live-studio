import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/** True when the user asked the system for reduced motion. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

/**
 * One 3D flip card used by every flashcard surface so the animation is
 * identical on desktop, tablet and phone. Inline styles on purpose: the
 * 3D properties must survive every build target.
 */
export function FlipCard({
  flipped,
  front,
  back,
  className = "",
  style,
  perspective = 1600,
  duration = 500,
}: {
  flipped: boolean;
  front: ReactNode;
  back: ReactNode;
  className?: string;
  style?: CSSProperties;
  perspective?: number;
  duration?: number;
}) {
  const reduced = useReducedMotion();

  return (
    <div
      className={className}
      style={{ perspective: `${perspective}px`, WebkitPerspective: `${perspective}px`, ...style } as CSSProperties}
    >
      <div
        style={
          {
            position: "relative",
            height: "100%",
            width: "100%",
            transformStyle: "preserve-3d",
            WebkitTransformStyle: "preserve-3d",
            willChange: "transform",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            transition: reduced
              ? "opacity .18s linear"
              : `transform ${duration}ms cubic-bezier(.22,.9,.3,1)`,
          } as CSSProperties
        }
      >
        <FlipFace>{front}</FlipFace>
        <FlipFace back>{back}</FlipFace>
      </div>
    </div>
  );
}

/** A single face of the card — absolutely placed, back face hidden. */
export function FlipFace({ children, back = false }: { children: ReactNode; back?: boolean }) {
  return (
    <div
      style={
        {
          position: "absolute",
          inset: 0,
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          transform: back ? "rotateY(180deg)" : "rotateY(0deg)",
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
