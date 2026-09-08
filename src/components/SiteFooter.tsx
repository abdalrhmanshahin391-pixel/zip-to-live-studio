import { Link } from "@tanstack/react-router";

import { useLang } from "@/components/LanguageProvider";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { SUPPORT_EMAIL } from "@/lib/legal-content";

type Col = { heading: string; links: { label: string; to: string }[] };

/**
 * Dark, wide site footer in the same editorial style as the home page:
 * wordmark and tagline on the left, four link columns, thin divider,
 * then a quiet bottom row.
 */
export function SiteFooter() {
  const { lang } = useLang();
  const ar = lang === "ar";
  const settings = useSiteSettings();

  const columns: Col[] = [
    {
      heading: ar ? "الأدوات" : "Study",
      links: [
        { label: ar ? "البطاقات" : "Flashcards", to: "/notes" },
        { label: ar ? "الملخّصات" : "Summaries", to: "/summaries" },
        { label: ar ? "أسئلة الذكاء الاصطناعي" : "AI questions", to: "/study/rita-ai" },
        { label: ar ? "الألمانية" : "German", to: "/learn/german" },
      ],
    },
    {
      heading: ar ? "المشاركة" : "Community",
      links: [
        { label: ar ? "تصفّح المجموعات" : "Browse decks", to: "/share" },
        { label: ar ? "شارك مجموعة" : "Share a deck", to: "/share/new" },
        { label: ar ? "المساحات" : "Study spaces", to: "/spaces" },
      ],
    },
    {
      heading: ar ? "الأسعار" : "Pricing",
      links: [
        { label: ar ? "الخطط" : "Plans", to: "/pricing" },
        { label: ar ? "عروض خاصة" : "Special offers", to: "/offers" },
        { label: ar ? "خطتي" : "My plan", to: "/my-plan" },
      ],
    },
    {
      heading: ar ? "الدعم" : "Learn & Support",
      links: [
        { label: ar ? "كيف يعمل" : "How it works", to: "/tour" },
        { label: ar ? "الدعم" : "Talk to the team", to: "/support" },
        { label: ar ? "حسابي" : "My profile", to: "/profile" },
        { label: ar ? "تسجيل الدخول" : "Sign in", to: "/login" },
      ],
    },
  ];

  return (
    <footer
      className="rita-cream mt-auto border-t border-white/10 bg-black text-white"
      style={{ fontFamily: "var(--font-grotesk)" }}
    >
      <div className="mx-auto max-w-[1240px] px-6 py-16 md:px-10 md:py-20">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,2.1fr)]">
          <div className="min-w-0">
            <p className="text-[30px] font-bold tracking-[-0.03em] text-white md:text-[34px]">
              {settings.site_name || "RitaJet"}
            </p>
            <p className="rita-accent mt-1 text-[24px] font-bold tracking-[-0.02em] md:text-[28px]">
              {ar ? "الدراسة للجميع." : "Study is for everyone."}
            </p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="mt-6 inline-block text-[15px] text-white/50 transition-colors hover:!text-[color:var(--rita-green-deep)]"
            >
              {SUPPORT_EMAIL}
            </a>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {columns.map((col) => (
              <nav key={col.heading} className="min-w-0">
                <h3 className="text-[16px] font-bold tracking-[-0.01em] text-white">
                  {col.heading}
                </h3>
                <ul className="mt-4 space-y-3">
                  {col.links.map((l) => (
                    <li key={l.to + l.label}>
                      <Link
                        to={l.to as any}
                        className="text-[15px] text-white/45 transition-colors hover:!text-[color:var(--rita-green-deep)]"
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

        <div className="mt-14 border-t border-white/10 pt-7 md:mt-16">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <p className="max-w-md text-[13.5px] leading-relaxed text-white/40">
              <span className="font-semibold text-white/70">
                {ar ? "صُنع بشغف." : "Made with care."}
              </span>
              <br />© {new Date().getFullYear()} {settings.site_name || "RitaJet"}.{" "}
              {ar ? "جميع الحقوق محفوظة." : "All rights reserved."}
            </p>
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-[13.5px] text-white/45">
              <Link to="/support" className="transition-colors hover:text-white">
                {ar ? "مركز المساعدة" : "Help Center"}
              </Link>
              <Link to="/pricing" className="transition-colors hover:text-white">
                {ar ? "الأسعار" : "Pricing"}
              </Link>
              <Link to="/register" className="transition-colors hover:text-white">
                {ar ? "إنشاء حساب" : "Create account"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
