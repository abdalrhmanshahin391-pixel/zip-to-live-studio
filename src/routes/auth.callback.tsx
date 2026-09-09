import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { RitaBrand } from "@/components/brand/RitaBrand";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing in — RitaJet" },
      { name: "description", content: "Securely completing your RitaJet sign-in." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Signing in — RitaJet" },
      { property: "og:description", content: "Securely completing your RitaJet sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GoogleCallbackPage,
});

function safeReturnPath() {
  const saved = sessionStorage.getItem("ritajet:oauth-return") ?? "/";
  sessionStorage.removeItem("ritajet:oauth-return");
  return saved.startsWith("/") && !saved.startsWith("//") && !saved.startsWith("/auth/callback")
    ? saved
    : "/";
}

function GoogleCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = async () => {
      const query = new URLSearchParams(window.location.search);
      const providerError = query.get("error_description") ?? query.get("error");
      if (providerError) {
        if (active) setError(providerError);
        return;
      }

      const code = query.get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError && !/code verifier|already/i.test(exchangeError.message)) {
          if (active) setError(exchangeError.message);
          return;
        }
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      if (data.session) {
        window.location.replace(safeReturnPath());
        return;
      }

      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" && session && active) {
          listener.subscription.unsubscribe();
          window.location.replace(safeReturnPath());
        }
      });
      timer = setTimeout(() => {
        listener.subscription.unsubscribe();
        if (active) setError("Google sign-in did not finish. Please return and try again.");
      }, 10000);
    };

    void finish();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-12 text-foreground">
      <section className="w-full max-w-md text-center" aria-live="polite">
        <div className="flex justify-center"><RitaBrand size={52} /></div>
        {error ? (
          <>
            <CircleAlert className="mx-auto mt-8 text-destructive" size={32} aria-hidden="true" />
            <h1 className="mt-4 font-display text-3xl font-black">Sign-in wasn’t completed</h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{error}</p>
            <a href="/" className="rita-btn rita-btn-primary mt-7">Return to RitaJet</a>
          </>
        ) : (
          <>
            <LoaderCircle className="mx-auto mt-8 animate-spin text-primary" size={32} aria-hidden="true" />
            <h1 className="mt-4 font-display text-3xl font-black">Welcome back</h1>
            <p className="mt-3 text-sm text-muted-foreground">Securely finishing your Google sign-in…</p>
          </>
        )}
      </section>
    </main>
  );
}