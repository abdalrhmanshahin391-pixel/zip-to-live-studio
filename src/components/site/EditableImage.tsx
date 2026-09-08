import { useRef, useState } from "react";
import { ImageUp, Loader2, RotateCcw, X } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useImageEditMode } from "@/lib/image-edit-mode";
import { useSiteImage, useSiteImageActions, useSiteImages } from "@/lib/site-images";

type Props = {
  /** Stable identifier for this picture, e.g. "home.ipad". */
  imageKey: string;
  /** Built-in artwork used when no replacement has been uploaded. */
  fallback: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  loading?: "lazy" | "eager";
  /** Extra classes for the positioning wrapper. */
  wrapperClassName?: string;
};

/**
 * A picture that admins can swap from the site itself while
 * "Image edit mode" is switched on in the account menu.
 */
export function EditableImage({
  imageKey,
  fallback,
  alt,
  className,
  width,
  height,
  loading = "lazy",
  wrapperClassName,
}: Props) {
  const { isRealAdmin } = useAuth();
  const editing = useImageEditMode();
  const src = useSiteImage(imageKey, fallback);
  const { data: overrides } = useSiteImages();
  const { replace, reset } = useSiteImageActions();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canEdit = isRealAdmin && editing;
  const hasOverride = Boolean(overrides?.[imageKey]);

  async function onPick(file: File | null) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      await replace(imageKey, file);
      setOpen(false);
    } catch (e: any) {
      setErr(e?.message ?? "Could not upload that picture.");
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    setBusy(true);
    setErr(null);
    try {
      await reset(imageKey);
      setOpen(false);
    } catch (e: any) {
      setErr(e?.message ?? "Could not restore the original picture.");
    } finally {
      setBusy(false);
    }
  }

  const img = (
    <img
      src={src}
      alt={alt}
      className={className}
      {...(width ? { width } : {})}
      {...(height ? { height } : {})}
      loading={loading}
    />
  );

  if (!canEdit) return img;

  return (
    <span className={`contents ${wrapperClassName ?? ""}`}>
      {img}
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="absolute left-1/2 top-1/2 z-20 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-white/25 bg-black/70 px-4 py-2 text-[13px] font-semibold text-white backdrop-blur-md transition-colors hover:bg-black/85"
      >
        <ImageUp size={15} /> Change image
      </span>

      {open && (
        <span
          className="fixed inset-0 z-[120] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={(e) => {
            e.stopPropagation();
            if (!busy) setOpen(false);
          }}
        >

          <span
            className="block w-full max-w-sm rounded-2xl border border-white/12 bg-[#151515] p-5 text-left text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center justify-between">
              <span className="text-[15px] font-bold">Change this picture</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-full p-1 text-white/50 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </span>

            <span className="mt-1 block text-[12.5px] text-white/45">{imageKey}</span>

            {err && (
              <span className="mt-3 block rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200">
                {err}
              </span>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />

            <span className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="rita-btn rita-btn-primary"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <ImageUp size={15} />}
                Choose picture
              </button>
              {hasOverride && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onReset}
                  className="rita-btn rita-btn-secondary"
                >
                  <RotateCcw size={15} /> Reset to original
                </button>
              )}
            </span>
          </span>
        </span>
      )}
    </span>
  );
}
