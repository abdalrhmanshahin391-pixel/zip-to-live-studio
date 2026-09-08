import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { openAuth } from "@/lib/auth-dialog";
import { useTranslation } from "react-i18next";
import {
  Settings,
  LogOut,
  ChevronDown,
  Sparkles,
  Menu,
  X,
  ShieldCheck,
  LayoutGrid,
  Users,
  History,
  Bell,
  Lock,
  Layers,
  FileText,
  ListChecks,
  CalendarDays,
  Languages,
  Brain,
  CheckSquare,
  BookOpen,
  Wand2,
  Gauge,
  Flame,
  Share2,

} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GoldenBadge } from "@/components/GoldenBadge";
import { CommitteeBadge } from "@/components/CommitteeBadge";
import { AdminBadge, StudentBadge } from "@/components/RoleBadge";
import { KitaBrand } from "@/components/brand/KitaBrand";
import { CreditsMeter } from "@/components/CreditsMeter";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { resolveHeaderSkin } from "@/components/header/header-designs";
import { InstallAppButton } from "@/components/InstallAppButton";
import { avatarTone, useAvatarUrl } from "@/lib/avatars";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { SECTION_FLAG, TOOL_FLAG, toolForPath, type SectionId } from "@/lib/site-tools";

/** Header menu group id -> study section id used by the admin on/off switches. */
const GROUP_SECTION: Record<string, SectionId> = {
  space: "study-space",
  room: "study-room",
  german: "german",
};

/**
 * SiteHeader — institutional white top bar.
 * Variant prop is kept for backwards compatibility but no longer changes
 * appearance: the bar is the same on every page (white, 1px border, navy ink),
 * for a calmer, more authoritative feel.
 */
type NavItem = {
  to: string;
  params?: Record<string, string>;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ size?: number }>;
  soft: string;
  ink: string;
};
type NavGroup = { id: string; label: string; columns: { label: string; items: NavItem[] }[] };

const NAV_GROUPS: NavGroup[] = [


  {
    id: "space",
    label: "My Study Space",
    columns: [
      {
        label: "Without AI",
        items: [
          { to: "/study", label: "Flashcards", hint: "Active recall", icon: Layers, soft: "#e4dcf3", ink: "#4a3877" },
          { to: "/study/match", label: "Memory Lab", hint: "Matching games", icon: Brain, soft: "#f6ddd5", ink: "#7d3421" },
          { to: "/study/pdf", label: "PDF summaries", hint: "One-page sheets", icon: FileText, soft: "#fbe3c8", ink: "#7a4b16" },
          { to: "/study/todo", label: "To-do list", hint: "Study planner", icon: CheckSquare, soft: "#d8ecdd", ink: "#215237" },
          { to: "/study/exams", label: "Exam schedule", hint: "Month calendar", icon: CalendarDays, soft: "#e6f0d8", ink: "#2f6318" },
        ],
      },
      {
        label: "With AI",
        items: [
          { to: "/study/all-in-one", label: "All in one", hint: "One upload · everything", icon: Wand2, soft: "#e7dcf7", ink: "#3f2c73" },
          { to: "/study/rita-ai", label: "Rita AI 3.8", hint: "Question engine", icon: Sparkles, soft: "#e7dcf7", ink: "#3f2c73" },
          { to: "/courses/$courseId", params: { courseId: "22222222-2222-4222-8222-222222222222" }, label: "Question bank", hint: "Study · exam", icon: ListChecks, soft: "#d9ecf7", ink: "#1d4d6b" },
          { to: "/study/lectures", label: "Lecture Lab", hint: "Lecture → quiz", icon: BookOpen, soft: "#e6f0d8", ink: "#2f6318" },
        ],
      },
    ],
  },
  {
    id: "room",
    label: "Study Room",
    columns: [
      {
        label: "Study together",
        items: [
          { to: "/share", label: "Shared flashcards", hint: "Community decks", icon: Share2, soft: "#e6f4d8", ink: "#3d5c14" },
          { to: "/spaces", label: "Classrooms & groups", hint: "Your spaces", icon: Users, soft: "#f3e8ff", ink: "#4a3877" },
        ],
      },
    ],
  },
  {
    id: "german",
    label: "German",
    columns: [
      {
        label: "German study tools",
        items: [
          { to: "/german", label: "German Lab", hint: "der · die · das", icon: Languages, soft: "#dceafb", ink: "#12315e" },
        ],
      },
    ],
  },
];



export function SiteHeader(_props: { variant?: "dark" | "light" } = {}) {

  void _props;
  const { enabled } = useFeatureFlags();
  const [open, setOpen] = useState(false);
  const [studyOpen, setStudyOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Rooms and tools the admin switched off disappear from the menu.
  const navGroups: NavGroup[] = useMemo(
    () =>
      NAV_GROUPS.filter((g) => {
        const sec = GROUP_SECTION[g.id];
        return !sec || enabled(SECTION_FLAG(sec));
      })
        .map((g) => ({
          ...g,
          columns: g.columns
            .map((c) => ({
              ...c,
              items: c.items.filter((i) => {
                const tool = toolForPath(i.to);
                return !tool || enabled(TOOL_FLAG(tool.key));
              }),
            }))
            .filter((c) => c.items.length > 0),
        }))
        .filter((g) => g.columns.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled],
  );

  const { t } = useTranslation();
  const { user, profile, isAdmin, isRealAdmin, isGolden, isCommittee, isCommitteeHead, adminMode, setAdminMode, loading: authLoading } = useAuth();
  const settings = useSiteSettings();
  const skin = resolveHeaderSkin(settings.header_style);

  
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-study-menu]")) setStudyOpen(false);
      if (target && target.closest("[data-account-menu]")) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleLogout() {
    setOpen(false);
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  function toggleAdminMode() {
    const next = !adminMode;
    setAdminMode(next);
    if (!next && path.startsWith("/admin")) {
      setOpen(false);
      navigate({ to: "/" });
    }
  }

  const displayName = profile?.username ?? user?.email ?? "";
  const avatar = useAvatarUrl((profile as any)?.avatar_url ?? null);
  const tone = avatarTone(user?.id ?? displayName ?? "rita");
  const initial = (profile?.full_name || profile?.username || user?.email || "?")
    .charAt(0)
    .toUpperCase();

  // Nav links (resources, committee, packages, universities) are intentionally
  // not rendered — the header only carries the brand and the auth actions.



  function AccountBlock({ compact }: { compact?: boolean }) {
    if (authLoading) {
      // Session is still being restored. Rendering the sign-in buttons here is
      // what caused the "signed out for a split second" flash, so show a
      // neutral placeholder instead.
      return <div aria-hidden="true" className="h-9 w-9 rounded-full bg-muted animate-pulse" />;
    }
    if (!user) {
      return (
        <div className={`${compact ? "flex" : "hidden lg:flex"} items-center gap-2 shrink-0`}>
          <button type="button" onClick={() => openAuth("signin")} className={skin.loginBtn}>
            <Lock size={16} />
            {t("cms.header.login")}
          </button>
          <button type="button" onClick={() => openAuth("signup")} className={skin.registerBtn}>
            {t("cms.header.register")}
          </button>
        </div>
      );
    }
    return (
      <div className="relative" data-account-menu>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`${skin.avatarBtn} shrink-0`}
          aria-label="Account menu"
          aria-expanded={open}
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden text-sm font-black text-white ${skin.avatarShape}`}
            style={{ background: tone }}
          >
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              initial
            )}
          </span>
          {isRealAdmin ? (
            <AdminBadge />
          ) : isGolden ? (
            <GoldenBadge />
          ) : isCommittee ? (
            <CommitteeBadge head={isCommitteeHead} />
          ) : (
            <StudentBadge />
          )}
          <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
        </button>
        {open && (
          <div
            className="absolute start-0 lg:start-auto lg:end-0 mt-3 w-72 max-w-[calc(100vw-2rem)] flex flex-col max-h-[calc(100vh-8rem)] overflow-hidden z-50 rounded-[26px] border border-black/[0.07] bg-[#fbf5e9] shadow-[0_24px_60px_-24px_rgba(60,45,20,0.35)]"
          >
            <div className="shrink-0 px-4 pt-4 pb-3">
              <div className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3">
                <span
                  className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full text-[16px] font-black text-white"
                  style={{ background: tone }}
                >
                  {avatar ? (
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initial
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] font-extrabold text-[#23201d]">
                    {profile?.full_name || displayName}
                  </p>
                  <p className="mt-0.5 inline-flex rounded-full bg-[#fbf5e9] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#8a8072]">
                    {isAdmin
                      ? t("cms.header.roleAdmin")
                      : isGolden
                        ? "Golden member"
                        : isCommitteeHead
                          ? "رئيس لجنة"
                          : isCommittee
                            ? "لجنة"
                            : t("cms.header.roleUser")}
                  </p>
                </div>
              </div>
            </div>
            <div className="py-1 overflow-y-auto overscroll-contain flex-1 min-h-0">
              {isRealAdmin && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={adminMode}
                  onClick={toggleAdminMode}
                  className="mx-2 flex w-[calc(100%-1rem)] items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-semibold text-[#3a352e] transition-colors hover:bg-white"
                >
                  <span className="inline-flex items-center gap-3">
                    <ShieldCheck size={16} className={adminMode ? "text-emerald-600" : "text-muted-foreground"} />
                    Admin mode
                  </span>
                  <span
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      adminMode ? "bg-emerald-500" : "bg-muted-foreground/40"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-4 w-4 rounded-full bg-card shadow-sm transition-all ${
                        adminMode ? "left-6" : "left-1"
                      }`}
                    />
                  </span>
                </button>
              )}
              <MenuLink to="/profile" icon={<Settings size={16} />} tone="sky" onClick={() => setOpen(false)}>
                {t("cms.header.profileSettings")}
              </MenuLink>
              <MenuLink to="/my-plan" icon={<Gauge size={16} />} tone="mint" onClick={() => setOpen(false)}>
                My plan
              </MenuLink>
              <MenuLink to="/pricing" icon={<Sparkles size={16} />} tone="apricot" onClick={() => setOpen(false)}>
                Plans & pricing
              </MenuLink>
              {isAdmin && (
                <MenuLink to="/summaries" icon={<Sparkles size={16} />} tone="lilac" onClick={() => setOpen(false)}>
                  {t("cms.header.summaries")}
                </MenuLink>
              )}
              <Link
                to="/profile"
                hash="notifications"
                onClick={() => setOpen(false)}
                className="mx-2 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-bold text-[#3a352e] transition-colors hover:bg-white"
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
                  style={{ background: "#d8ecdd", color: "#215237" }}
                >
                  <Bell size={16} />
                </span>
                {t("cms.header.notifications", { defaultValue: "Notifications" })}
              </Link>
              <InstallAppButton />
              {(isAdmin || isCommitteeHead) && (
                <>
                  <div className="my-1 mx-3 border-t border-border" />
                  <MenuLink to="/admin" icon={<LayoutGrid size={16} />} tone="clay" onClick={() => setOpen(false)}>
                    Admin
                  </MenuLink>
                  {isCommitteeHead && (
                    <>
                      <MenuLink to="/committee/manage-team" icon={<Users size={16} />} tone="sky" onClick={() => setOpen(false)}>
                        Committee team
                      </MenuLink>
                      <MenuLink to="/admin/committee-log" icon={<History size={16} />} tone="lilac" onClick={() => setOpen(false)}>
                        Committee log
                      </MenuLink>
                    </>
                  )}
                </>
              )}

            </div>
            <div className="shrink-0 border-t border-black/[0.06] p-2">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-bold text-[#a23b22] transition-colors hover:bg-[#f6ddd5]"
              >
                <LogOut size={16} />
                {t("cms.header.logout")}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <header className={`left-0 right-0 ${skin.header}`}>
      <div
        className={`mx-auto max-w-7xl px-4 md:px-8 flex items-center ${skin.inner} ${
          skin.rail ? "" : "justify-between"
        }`}
      >
        {/* Brand */}
        <Link to="/" className={`${skin.brandWrap} min-w-0 max-w-[calc(100%-5rem)] overflow-hidden sm:max-w-none`}>
          <span className="sm:hidden">
            <KitaBrand size={32} />
          </span>
          <span className="hidden sm:inline">
            <KitaBrand size={42} />
          </span>
        </Link>

        {/* Center nav — one Study menu keeps the bar from overflowing */}
        <nav className="hidden lg:flex items-center gap-1.5" data-study-menu>
          <div className="relative">
            <button
              onClick={() => setStudyOpen((v) => !v)}
              aria-expanded={studyOpen}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13.5px] font-extrabold transition-colors ${
                studyOpen || path.startsWith("/study") || path.startsWith("/german")
                  ? "border-black/10 bg-white text-[#23201d]"
                  : "border-transparent text-[#6f675c] hover:bg-white/70"
              }`}
            >
              <LayoutGrid size={15} />
              Study
              <ChevronDown
                size={14}
                className={`transition-transform ${studyOpen ? "rotate-180" : ""}`}
              />
            </button>
            {studyOpen && (
              <div className="absolute start-0 z-50 mt-3 w-[44rem] max-w-[90vw] rounded-[26px] border border-black/[0.07] bg-white/95 p-4 shadow-[0_28px_70px_-30px_rgba(60,45,20,0.45)] backdrop-blur">
                <div className="space-y-4">
                  {navGroups.map((group) => (
                    <div key={group.id}>
                      <div className="flex items-center gap-3 px-1">
                        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7a4b16]">
                          {group.label}
                        </span>
                        <span className="h-px flex-1 bg-black/[0.08]" />
                      </div>
                      <div className="mt-2 grid gap-4 sm:grid-cols-2">
                        {group.columns.map((col) => (
                          <div key={col.label}>
                            <div className="px-3 pb-1 text-[10.5px] font-black uppercase tracking-[0.14em] text-[#a29a8d]">
                              {col.label}
                            </div>
                            <div className="grid gap-0.5">
                              {col.items.map((item) => (
                                <Link
                                  key={item.to}
                                  to={item.to}
                                  params={item.params as never}
                                  onClick={() => setStudyOpen(false)}
                                  className="group flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-[#fbf5e9]"
                                >
                                  <span
                                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-transform group-hover:-translate-y-0.5"
                                    style={{ background: item.soft, color: item.ink }}
                                  >
                                    <item.icon size={16} />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate text-[14px] font-extrabold text-[#23201d]">
                                      {item.label}
                                    </span>
                                    <span className="block truncate text-[11.5px] font-semibold text-[#a29a8d]">
                                      {item.hint}
                                    </span>
                                  </span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            )}
          </div>
          <Link
            to="/learn"
            className={`rounded-full px-3.5 py-2 text-[13.5px] font-extrabold transition-colors ${
              path === "/learn" ? "bg-white text-[#23201d]" : "text-[#6f675c] hover:bg-white/70"
            }`}
          >
            Start learning
          </Link>
        </nav>


        {/* Right cluster */}
        <div
          className={`flex min-w-0 shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2 md:gap-3 ${
            skin.rail ? "lg:ps-6 lg:border-s lg:border-border" : ""
          }`}
        >
          {/* Desktop: account lives in the top bar */}
          <div className="hidden lg:flex items-center gap-2 rounded-full border border-black/[0.07] bg-white/70 py-1 pe-1 ps-2 backdrop-blur">
            <Link
              to="/pricing"
              className={`rounded-full px-3 py-1.5 text-[13px] font-extrabold transition-colors ${
                path === "/pricing" ? "bg-[#fbf5e9] text-[#23201d]" : "text-[#6f675c] hover:bg-[#fbf5e9]"
              }`}
            >
              Pricing
            </Link>
            {settings.offers_page_enabled && (
              <Link
                to="/offers"
                className="rounded-full bg-[#c62828] px-3 py-1.5 text-[13px] font-extrabold text-white transition-transform hover:scale-[1.03]"
              >
                Special offers
              </Link>
            )}
            <CreditsMeter />
            <AccountBlock />
          </div>


          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden order-last inline-grid shrink-0 place-items-center h-9 w-9 rounded-md border border-border text-foreground hover:bg-muted"
            aria-label="Menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Phone / iPad: account row under the bar, full-width so badges show fully */}
      <div className="lg:hidden border-t border-black/5 bg-[#fbf5e9]">
        <div className="mx-auto max-w-7xl px-4 md:px-8 flex min-h-12 flex-wrap items-center justify-between gap-2 py-1.5">
          <AccountBlock compact />
          <CreditsMeter compact />
        </div>
      </div>

      {/* Mobile sheet */}
      {mobileOpen && (
        <div className={skin.mobileSheet}>

          <nav className="flex flex-col px-4 py-3">
            <div className="grid gap-3">
              {[
                ...navGroups,
                {
                  id: "more",
                  label: "Plans",
                  columns: [
                    {
                      label: "Buy & offers",
                      items: [
                        { to: "/pricing", label: "Pricing", icon: Sparkles, soft: "#fbe3c8", ink: "#7a4b16" },
                        ...(settings.offers_page_enabled
                          ? [{ to: "/offers", label: "Special offers", icon: Flame, soft: "#fbd5d5", ink: "#8e1414" }]
                          : []),
                      ],
                    },
                  ],
                } as NavGroup,
              ].map((group) => (
                <div key={group.id}>
                  <div className="px-2 pb-1 text-[10.5px] font-black uppercase tracking-[0.16em] text-[#7a4b16]">
                    {group.label}
                  </div>
                  {group.columns.map((col) => (
                    <div key={col.label} className="grid gap-1">
                      {col.items.map((item) => (
                        <Link
                          key={item.to}
                          to={item.to}
                          params={item.params as never}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-3 rounded-2xl px-2 py-2 text-[14.5px] font-extrabold text-[#3a352e] hover:bg-white"
                        >
                          <span
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                            style={{ background: item.soft, color: item.ink }}
                          >
                            <item.icon size={16} />
                          </span>
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="mb-2 mt-3 flex flex-wrap gap-2">
            </div>
            {!user && !authLoading && (
              <div className="pt-3 mt-2 border-t border-border flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    openAuth("signin");
                  }}
                  className="flex-1 text-center text-sm font-medium border border-border rounded-md py-2"
                >
                  {t("cms.header.login")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    openAuth("signup");
                  }}
                  className="flex-1 text-center text-sm font-medium bg-primary text-primary-foreground rounded-md py-2"
                >
                  {t("cms.header.register")}
                </button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

const MENU_TONES: Record<string, { soft: string; ink: string }> = {
  apricot: { soft: "#fbe3c8", ink: "#7a4b16" },
  sky: { soft: "#d6e8f6", ink: "#1f4c6d" },
  lilac: { soft: "#e4dcf3", ink: "#4a3877" },
  mint: { soft: "#d8ecdd", ink: "#215237" },
  clay: { soft: "#f6ddd5", ink: "#7d3421" },
};

function MenuLink({
  to,
  icon,
  children,
  onClick,
  tone = "apricot",
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  tone?: keyof typeof MENU_TONES;
}) {
  const c = MENU_TONES[tone] ?? MENU_TONES.apricot;
  return (
    <Link
      to={to}
      onClick={onClick}
      className="mx-2 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-bold text-[#3a352e] transition-colors hover:bg-white"
    >
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
        style={{ background: c.soft, color: c.ink }}
      >
        {icon}
      </span>
      {children}
    </Link>
  );
}

