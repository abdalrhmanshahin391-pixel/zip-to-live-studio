import { Link } from "@tanstack/react-router";

import { useLang } from "@/components/LanguageProvider";
import { KitaBrand } from "@/components/brand/KitaBrand";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { SUPPORT_EMAIL } from "@/lib/legal-content";

type Col = { heading: string; links: { label: string; to: string }[] };

/**
 * Site footer — Rita brand block plus three short link columns.
 */
export function SiteFooter() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const settings = useSiteSettings();

  const columns: Col[] = [
    {
      heading: ar ? "الأدوات" : "Product",
      links: [
        { label: ar ? "البطاقات" : "Flashcards", to: "/notes" },
        { label: ar ? "الملخّصات" : "Summaries", to: "/summaries" },
        { label: ar ? "أسئلة الذكاء الاصطناعي" : "AI questions", to: "/study/rita-ai" },
      ],
    },
    {
      heading: ar ? "الحساب" : "Account",
      links: [
        { label: ar ? "تسجيل الدخول" : "Sign in", to: "/login" },
        { label: ar ? "إنشاء حساب" : "Sign up", to: "/register" },
        { label: ar ? "حسابي" : "My profile", to: "/profile" },
      ],
    },
    {
      heading: ar ? "الأسعار" : "Pricing",
      links: [{ label: ar ? "الخطط" : "Plans", to: "/pricing" }],
    },

  ];

  return (
    <footer className="mt-auto border-t border-black/5 bg-[#fbf5e9] text-foreground">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
          <div className="min-w-0">
            <KitaBrand size={40} />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {ar
                ? "ريتا تحوّل محاضراتك وملاحظاتك إلى بطاقات مراجعة وملخّصات من صفحة واحدة وأسئلة على نمط الامتحان."
                : "Rita turns your lectures and notes into flashcards, one-page summaries and exam-style practice questions."}
            </p>
            <div className="mt-5 text-sm">
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="font-bold text-foreground transition-colors hover:text-primary"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>

          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((col) => (
              <nav key={col.heading} className="min-w-0">
                <h3 className="text-xs font-black uppercase tracking-[0.16em] text-foreground">
                  {col.heading}
                </h3>
                <ul className="mt-3 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.to + l.label}>
                      <Link
                        to={l.to as any}
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-black/10 pt-6">
          <span className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Rita
          </span>
        </div>
      </div>
    </footer>
  );
}
