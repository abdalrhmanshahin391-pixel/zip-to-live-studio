import screenAsset from "@/assets/rita-girl-ipad.jpg.asset.json";
import { EditableImage } from "@/components/site/EditableImage";

/**
 * A photoreal horizontal iPad Pro shell, deliberately cropped by the top
 * of the viewport: only the upper ~10% of the device sits above the page.
 * The illustration fills the whole screen edge to edge (absolute inset-0 +
 * object-cover). Buttons are placed on the top/bottom edges to read as
 * landscape orientation, matching the Procreate homepage treatment.
 */
export function IpadStage() {
  return (
    <div className="relative mx-auto w-full max-w-[1000px] px-6 md:px-12">
      {/* Negative top margin pushes only a small sliver of the device top off-screen. */}
      <div className="-mt-[7%] md:-mt-[8%]">
        <div
          className="relative mx-auto rounded-[2rem] p-[9px] md:rounded-[2.5rem] md:p-[11px]"
          style={{
            background:
              "linear-gradient(148deg,#8f959c 0%,#4b5157 12%,#22262a 34%,#1b1e21 62%,#3d4247 88%,#7e848b 100%)",
            boxShadow:
              "0 2px 0 rgba(255,255,255,.18) inset, 0 -2px 0 rgba(0,0,0,.35) inset",
          }}
        >
          {/* Top button (landscape top edge) */}
          <span
            aria-hidden
            className="absolute -top-[3px] left-[58%] h-[3px] w-20 rounded-t-sm md:w-28"
            style={{ background: "linear-gradient(180deg,#6d7379,#2a2e32)" }}
          />
          {/* Bottom button (landscape bottom edge) */}
          <span
            aria-hidden
            className="absolute -bottom-[3px] left-[42%] h-[3px] w-14 rounded-b-sm md:w-20"
            style={{ background: "linear-gradient(0deg,#6d7379,#2a2e32)" }}
          />

          {/* Screen — landscape tablet panel, artwork covers it completely */}
          <div className="relative aspect-[16/10] overflow-hidden rounded-[1.8rem] bg-black md:rounded-[2.3rem]">
            <EditableImage
              imageKey="home.ipad"
              fallback={screenAsset.url}
              alt="A student studying on a tablet at night on a balcony under a starry sky, shown on an iPad screen"
              className="absolute inset-0 h-full w-full object-cover object-center"
              width={1280}
              height={800}
              loading="eager"
            />
            {/* Glass sheen across the panel */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(118deg,rgba(255,255,255,.16) 0%,rgba(255,255,255,0) 34%,rgba(255,255,255,0) 66%,rgba(255,255,255,.07) 100%)",
              }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[1.8rem] md:rounded-[2.3rem]"
              style={{ boxShadow: "0 0 0 1px rgba(255,255,255,.10) inset" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
