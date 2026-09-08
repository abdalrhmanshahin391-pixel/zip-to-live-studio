import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Eye, EyeOff, Mail, MailCheck, X, ArrowLeft } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/legacy-client";
import {
  loadRememberedLogin,
  saveRememberedLogin,
  clearRememberedLogin,
} from "@/lib/remember-login";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { RitaFace } from "@/components/brand/RitaBrand";
import {
  closeAuth,
  getAuthDialogState,
  setAuthMode,
  subscribeAuthDialog,
  type AuthDialogState,
  type AuthMode,
} from "@/lib/auth-dialog";

/* ── shared bits ────────────────────────────────────────────────────────── */

const field =
  "w-full rounded-2xl border-2 border-black/[0.07] bg-[#fbf7ef] px-4 py-3.5 text-[15px] font-medium text-foreground placeholder:font-normal placeholder:text-muted-foreground outline-none transition-all focus:border-[var(--rita-green)] focus:bg-white focus:ring-4 focus:ring-[var(--rita-green-soft)]";

const bigOutline =
  "flex h-14 w-full items-center justify-center gap-3 rounded-full border-2 border-black/[0.08] bg-white px-4 text-[16px] font-black text-foreground shadow-[0_14px_28px_-22px_rgba(35,32,29,0.9)] transition-all hover:-translate-y-0.5 hover:bg-[#fbf7ef] disabled:translate-y-0 disabled:opacity-60";

const primaryBtn =
  "inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--rita-green)] px-8 py-4 text-[16px] font-black text-[color:var(--rita-green-ink)] shadow-[0_16px_30px_-16px_rgba(122,160,44,0.9)] transition-all hover:-translate-y-0.5 hover:bg-[var(--rita-green-deep)] active:translate-y-0 disabled:translate-y-0 disabled:opacity-60";

function Err({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
    >
      {message}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[12px] font-black uppercase tracking-[0.08em] text-[#6b655c]">
      {children}
    </span>
  );
}

/* ── the window ─────────────────────────────────────────────────────────── */

export function AuthDialogHost() {
  const [state, setState] = useState<AuthDialogState>(() => getAuthDialogState());

  useEffect(() => {
    const unsub = subscribeAuthDialog(setState);
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAuth();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [state.open]);

  if (!state.open) return null;
  return <AuthWindow mode={state.mode} next={state.next} />;
}

function AuthWindow({ mode, next }: { mode: AuthMode; next?: string }) {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (!cardRef.current?.contains(e.target as Node)) closeAuth();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to RitaJet"
        className="rita-dialog-pop relative w-full max-w-[27rem] rounded-[30px] border border-black/[0.06] bg-[#fdfaf3] p-6 shadow-[0_60px_120px_-45px_rgba(35,32,29,0.8)] sm:p-9"
      >
        <button
          type="button"
          onClick={closeAuth}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[#6b655c] transition-colors hover:bg-black/[0.05] hover:text-foreground"
        >
          <X size={18} />
        </button>

        <div className="mb-6 flex flex-col items-center text-center">
          <RitaFace size={68} />
          <h2 className="mt-3 font-display text-[24px] font-black leading-tight tracking-tight text-foreground">
            {mode === "signup"
              ? "Create your RitaJet account"
              : mode === "forgot"
                ? "Reset your password"
                : "Welcome back"}
          </h2>
          <p className="mt-1.5 max-w-[19rem] text-[14px] leading-relaxed text-[#6b655c]">
            {mode === "signup"
              ? "Your flashcards, summaries and to-dos, saved to one account."
              : mode === "forgot"
                ? "We'll email you a link to choose a new password."
                : "Pick up your cards, decks and study streak where you left them."}
          </p>
        </div>

        {mode === "signin" && <SignInPanel next={next} />}
        {mode === "signup" && <SignUpPanel next={next} />}
        {mode === "forgot" && <ForgotPanel />}
      </div>
    </div>
  );
}

/* ── sign in ────────────────────────────────────────────────────────────── */

function SignInPanel({ next }: { next?: string }) {
  const router = useRouter();
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState<{
    kind: "block" | "suspend";
    message: string | null;
    until: string | null;
  } | null>(null);

  useEffect(() => {
    const saved = loadRememberedLogin();
    if (saved?.email) setEmail(saved.email);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!agree) {
      setError("Please accept the Terms, Privacy Policy and Refund Policy to sign in.");
      return;
    }
    if (!email.trim() || !password) {
      setError("Please fill in your email and password.");
      return;
    }
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) {
        const msg = (signInError.message ?? "").toLowerCase();
        setError(
          msg.includes("confirm") || msg.includes("verif")
            ? "Your email isn't verified yet. Open the verification link we sent you, then sign in again — check your spam folder too."
            : "That email and password don't match.",
        );
        setLoading(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (uid) {
        const { data: prof } = await (supabase.from as any)("profiles")
          .select("locked_at, lock_kind, lock_until, lock_message")
          .eq("id", uid)
          .maybeSingle();
        const stillLocked =
          prof?.locked_at &&
          (prof.lock_kind !== "suspend" ||
            !prof.lock_until ||
            new Date(prof.lock_until).getTime() > Date.now());
        if (stillLocked) {
          await supabase.auth.signOut();
          setBlocked({
            kind: prof.lock_kind === "suspend" ? "suspend" : "block",
            message: prof.lock_message ?? null,
            until: prof.lock_until ?? null,
          });
          setLoading(false);
          return;
        }
      }

      if (remember) saveRememberedLogin({ email: email.trim().toLowerCase() });
      else clearRememberedLogin();

      closeAuth();
      if (next) {
        void router.navigate({ href: next });
      }
      void router.invalidate();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (blocked) {
    return (
      <div className="text-center">
        <h3 className="text-lg font-black text-foreground">
          {blocked.kind === "suspend"
            ? "Your account is temporarily stopped"
            : "Your account has been blocked"}
        </h3>
        {blocked.message && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{blocked.message}</p>
        )}
        {blocked.kind === "suspend" && blocked.until && (
          <p className="mt-3 text-sm font-bold text-muted-foreground">
            Access returns on {new Date(blocked.until).toLocaleString()}
          </p>
        )}
        <button type="button" onClick={() => setBlocked(null)} className={primaryBtn + " mt-6"}>
          Close
        </button>
      </div>
    );
  }

  return (
    <div>
      {error && <Err message={error} />}

      <label className="mb-5 flex cursor-pointer select-none items-start gap-3 rounded-2xl border border-black/[0.05] bg-[#f6f1e5] px-4 py-3.5 text-[13px] font-semibold leading-relaxed text-[#4b463f]">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-border accent-[var(--rita-green)]"
        />
        <span>I accept RitaJet's terms of use, privacy practices and refund rules.</span>
      </label>

      <div className={agree ? "space-y-3" : "pointer-events-none space-y-3 opacity-50"}>
        <GoogleButton next={next} onError={setError} />
        {!emailOpen && (
          <button type="button" onClick={() => setEmailOpen(true)} className={bigOutline}>
            <Mail size={18} />
            Continue with email
          </button>
        )}
      </div>


      {emailOpen && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block">
            <Label>email</Label>
            <input
              type="email"
              autoComplete="email"
              autoFocus
              className={field}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <Label>password</Label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                className={field + " pr-12"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => {
                  setRemember(e.target.checked);
                  if (!e.target.checked) clearRememberedLogin();
                }}
                className="h-4 w-4 rounded border-2 border-border accent-[var(--rita-green)]"
              />
              keep me signed in
            </label>
            <button
              type="button"
              onClick={() => setAuthMode("forgot")}
              className="text-sm font-medium text-muted-foreground underline hover:text-foreground"
            >
              forgot your password?
            </button>
          </div>

          <button type="submit" disabled={loading || !agree} className={primaryBtn}>

            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}

      <p className="mt-6 border-t border-black/[0.07] pt-4 text-center text-sm font-medium text-muted-foreground">
        New to Rita?{" "}
        <button
          type="button"
          onClick={() => setAuthMode("signup")}
          className="font-black text-[color:var(--rita-green-deep)] underline"
        >
          Create account
        </button>
      </p>
    </div>
  );
}

/* ── sign up ────────────────────────────────────────────────────────────── */

const signupSchema = z
  .object({
    full_name: z.string().trim().min(2, "Please enter your full name.").max(100),
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters.")
      .max(30, "Username must be less than 30 characters.")
      .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores."),
    email: z.string().trim().email("Please enter a valid email address.").max(255),
    phone: z
      .string()
      .trim()
      .max(20)
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || /^[0-9+\-\s()]{6,20}$/.test(v), "Please enter a valid phone number."),
    password: z.string().min(6, "Password must be at least 6 characters.").max(72),
  })
  .strip();

function SignUpPanel({ next }: { next?: string }) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
  });
  const [accepted, setAccepted] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!accepted) {
      setError("Please accept the Terms and Privacy Policy to continue.");
      return;
    }
    const parsed = signupSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Please check your information.");
      return;
    }
    const data = parsed.data;
    const phone = data.phone ? data.phone : null;

    setLoading(true);
    try {
      const { data: taken, error: rpcErr } = await (supabase.rpc as any)("identity_taken", {
        _username: data.username,
        _phone: phone ?? "",
      });
      if (rpcErr) {
        setError(rpcErr.message);
        setLoading(false);
        return;
      }
      if (taken?.username) {
        setError("This username is already taken.");
        setLoading(false);
        return;
      }
      if (taken?.phone) {
        setError("This phone number is already registered.");
        setLoading(false);
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: data.full_name,
            username: data.username,
            phone: phone ?? "",
          },
        },
      });
      if (signUpError) {
        const msg = signUpError.message.toLowerCase();
        setError(
          msg.includes("registered") || msg.includes("exists")
            ? "This email is already registered."
            : signUpError.message,
        );
        setLoading(false);
        return;
      }
      setSentTo(data.email);
      setLoading(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(/duplicate|unique/i.test(msg) ? "That username or phone is already in use." : msg);
      setLoading(false);
    }
  }

  if (sentTo) {
    return (
      <div className="space-y-4 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--rita-green)] text-[color:var(--rita-green-ink)]">
          <MailCheck size={26} />
        </span>
        <p className="text-sm font-bold text-foreground">
          We sent a verification link to <span className="underline">{sentTo}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Open that email to activate your account — check your spam folder if it isn't there.
        </p>
        <button type="button" onClick={() => setAuthMode("signin")} className={primaryBtn}>
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div>
      {error && <Err message={error} />}

      <div className="space-y-3">
        <GoogleButton label="Sign up with Google" next={next} onError={setError} />
        {!emailOpen && (
          <button type="button" onClick={() => setEmailOpen(true)} className={bigOutline}>
            <Mail size={18} />
            Sign up with email
          </button>
        )}
      </div>

      {emailOpen && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <label className="block">
            <Label>full name</Label>
            <input
              type="text"
              autoComplete="name"
              autoFocus
              className={field}
              value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              placeholder="Your full name"
            />
          </label>
          <label className="block">
            <Label>username</Label>
            <input
              type="text"
              autoComplete="username"
              className={field}
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
              placeholder="Choose a username"
            />
          </label>
          <label className="block">
            <Label>email</Label>
            <input
              type="email"
              autoComplete="email"
              className={field}
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <Label>phone (optional)</Label>
            <input
              type="tel"
              autoComplete="tel"
              className={field}
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="07XXXXXXXX"
            />
          </label>
          <label className="block">
            <Label>password</Label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                className={field + " pr-12"}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          <label className="flex cursor-pointer select-none items-start gap-2 rounded-2xl bg-[#f6f1e5] p-3 text-xs font-bold text-foreground">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-2 border-border accent-[var(--rita-green)]"
            />
            <span>
              I accept RitaJet's terms of use, privacy practices and refund rules.
            </span>
          </label>

          <button type="submit" disabled={loading || !accepted} className={primaryBtn}>
            {loading ? "Creating your account…" : "Create account"}
          </button>
        </form>
      )}

      <p className="mt-6 border-t border-black/[0.07] pt-4 text-center text-sm font-medium text-muted-foreground">
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => setAuthMode("signin")}
          className="font-black text-[color:var(--rita-green-deep)] underline"
        >
          Sign in
        </button>
      </p>
    </div>
  );
}

/* ── forgot password ────────────────────────────────────────────────────── */

function ForgotPanel() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  }

  return (
    <div>
      {sent ? (
        <div className="space-y-4 text-center">
          <MailCheck className="mx-auto text-[color:var(--rita-green-deep)]" size={28} />
          <p className="text-sm text-muted-foreground">
            If an account exists for <span className="font-bold">{email}</span>, a reset link is on
            its way.
          </p>
          <button type="button" onClick={() => setAuthMode("signin")} className={primaryBtn}>
            Back to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <Err message={error} />}
          <p className="text-center text-sm text-muted-foreground">
            Enter the email you signed up with and we'll send you a link to set a new password.
          </p>
          <label className="block">
            <Label>email</Label>
            <input
              type="email"
              autoComplete="email"
              autoFocus
              className={field}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <button type="submit" disabled={loading} className={primaryBtn}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("signin")}
            className="mx-auto flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline hover:text-foreground"
          >
            <ArrowLeft size={14} /> back to sign in
          </button>
        </form>
      )}
    </div>
  );
}
