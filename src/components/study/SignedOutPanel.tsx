import { openAuth } from "@/lib/auth-dialog";

export function SignedOutPanel({ what }: { what: string }) {
  const next =
    typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined;

  return (
    <div className="mt-14 max-w-lg">
      <h2 className="font-display text-2xl font-black">Sign in to keep {what}</h2>
      <p className="mt-3 text-[15px] leading-relaxed text-[#6d665c]">
        Your subjects and cards are private to your account, so Rita needs to know who you are
        before she can save them.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => openAuth("signin", next)}
          className="rita-pill inline-flex h-13 items-center rounded-full px-8 py-3.5 text-[15px] font-semibold"
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => openAuth("signup", next)}
          className="inline-flex items-center rounded-full border border-black/10 bg-white px-8 py-3.5 text-[15px] font-semibold text-[#23201d]"
        >
          Create an account
        </button>
      </div>
    </div>
  );
}
