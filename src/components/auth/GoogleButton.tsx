import { useState } from "react";
import { lovable } from "@/integrations/lovable/index";

/**
 * "Continue with Google" for the account window.
 *
 * Sign-in goes through the managed OAuth helper (iframe-safe in the editor
 * preview). We always return to the site root — the root route sends brand new
 * accounts on to /welcome, and any saved destination is handled there.
 */
export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.redirected) return;
      if (result.error) {
        setError("Google sign-in isn't available yet. Use your email and password for now.");
        setBusy(false);
        return;
      }
      window.location.assign("/");
    } catch {
      setError("Google sign-in isn't available yet. Use your email and password for now.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-3 rounded-full border-2 border-black/[0.08] bg-white px-6 py-3.5 text-[15px] font-black text-foreground transition-all hover:-translate-y-0.5 hover:border-[var(--rita-green)] hover:shadow-[0_16px_30px_-20px_rgba(35,32,29,0.6)] active:translate-y-0 disabled:translate-y-0 disabled:opacity-60"
      >
        <GoogleGlyph />
        {busy ? "Opening Google…" : label}
      </button>
      {error && (
        <p className="mt-2 text-center text-[13px] font-semibold text-destructive">{error}</p>
      )}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.4-4.7 7l7.6 5.9c4.4-4.1 6.8-10.1 6.8-17.4z"
      />
      <path
        fill="#FBBC05"
        d="M10.4 28.7a14.6 14.6 0 0 1 0-9.4l-7.8-6.1a24 24 0 0 0 0 21.6l7.8-6.1z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.7-3.7-13.6-9.9l-7.8 6.1C6.5 42.6 14.6 48 24 48z"
      />
    </svg>
  );
}

/** Small "or" divider between Google and the email form. */
export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-black/[0.08]" />
      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[#8a8377]">or</span>
      <span className="h-px flex-1 bg-black/[0.08]" />
    </div>
  );
}
