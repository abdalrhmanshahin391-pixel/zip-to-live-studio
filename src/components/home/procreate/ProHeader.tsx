import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  Gauge,
  ImageUp,
  LayoutGrid,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { openAuth } from "@/lib/auth-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { supabase } from "@/integrations/supabase/client";
import { CreditsMeter } from "@/components/CreditsMeter";
import { GoldenBadge } from "@/components/GoldenBadge";
import { AdminBadge, StudentBadge } from "@/components/RoleBadge";
import { InstallAppButton } from "@/components/InstallAppButton";
import { avatarTone, useAvatarUrl } from "@/lib/avatars";
import { setImageEditMode, useImageEditMode } from "@/lib/image-edit-mode";
import { ProWordmark } from "./ProWordmark";

import { NAV_GROUPS } from "@/components/SiteHeader";

const SIMPLE_LINKS: { to: string; label: string }[] = [
  { to: "/learn", label: "Rooms" },
  { to: "/tour", label: "How it works" },
];

/** Transparent, white-only top bar that floats over the artwork. */
export function ProHeader() {
  const { t } = useTranslation();
  const { user, profile, isAdmin, isRealAdmin, isGolden, adminMode, setAdminMode, loading: authLoading } = useAuth();
  const settings = useSiteSettings();
  const navigate = useNavigate();
  const [open, setOpen] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const imageEdit = useImageEditMode();

  const displayName = profile?.username ?? user?.email ?? "";
  const avatar = useAvatarUrl((profile as any)?.avatar_url ?? null);
  const tone = avatarTone(user?.id ?? displayName ?? "rita");
  const initial = (profile?.full_name || profile?.username || user?.email || "?")
    .charAt(0)
    .toUpperCase();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-pro-account]")) return;
      setAccountOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleLogout() {
    setAccountOpen(false);
    setSheet(false);
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  function toggleAdminMode() {
    setAdminMode(!adminMode);
  }

  const darkMenuLink =
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white";

  return (
    <header className="absolute inset-x-0 top-0 z-50">
      {/* Soft scrim so white words stay readable over the artwork below. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[130px]"
        style={{
          background:
            "linear-gradient(180deg,rgba(0,0,0,.34) 0%,rgba(0,0,0,.14) 55%,rgba(0,0,0,0) 100%)",
        }}
      />
      <div className="rita-onart relative mx-auto flex h-[72px] max-w-[1120px] items-center justify-between gap-4 px-6 md:px-10">
        <Link to="/" className="shrink-0 text-white [&_*]:!text-white">
          <ProWordmark size={30} />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          <div
            className="relative"
            onMouseEnter={() => setOpen("learn")}
            onMouseLeave={() => setOpen(null)}
          >
            <button
              type="button"
              className="flex items-center gap-1.5 text-[16px] font-semibold !text-white transition-opacity hover:opacity-75"
              style={{ fontFamily: "var(--font-grotesk)" }}
            >
              Start learning
              <ChevronDown size={16} strokeWidth={2.2} />
            </button>
            {open === "learn" && (
              <div className="absolute left-1/2 top-full w-[46rem] max-w-[90vw] -translate-x-1/2 pt-3">
                <div className="space-y-4 rounded-[26px] border border-black/[0.07] bg-[#fffdf7] p-4 shadow-[0_28px_70px_-30px_rgba(60,45,20,0.45)]">
                  {NAV_GROUPS.map((group) => (
                    <div key={group.id}>
                      <div className="flex items-center gap-3 px-1">
                        <span className="rita-accent text-[11px] font-black uppercase tracking-[0.18em]">
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
                                  key={item.to + item.label}
                                  to={item.to as never}
                                  params={item.params as never}
                                  onClick={() => setOpen(null)}
                                  className="group flex items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-[#f4efe3]"
                                >
                                  <span
                                    className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-transform group-hover:-translate-y-0.5"
                                    style={{ background: item.soft, color: item.ink }}
                                  >
                                    <item.icon size={16} />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate text-[14px] font-extrabold !text-[#23201d]">
                                      {item.label}
                                    </span>
                                    <span className="block truncate text-[11.5px] font-semibold !text-[#a29a8d]">
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

          {SIMPLE_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to as never}
              className="text-[16px] font-semibold !text-white/90 transition-opacity hover:opacity-75"
              style={{ fontFamily: "var(--font-grotesk)" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>


        {/* Each action stands alone so the header stays light and easy to scan. */}
        <div className="hidden items-center gap-2.5 lg:flex">
          <Link
            to="/pricing"
            className="px-2 py-2 text-[14px] font-semibold text-white/80 transition-colors hover:text-white"
            style={{ fontFamily: "var(--font-grotesk)" }}
          >
            Pricing
          </Link>
          {settings.offers_page_enabled && (
            <Link
              to="/offers"
              className="rita-accent-bg inline-flex h-10 items-center rounded-full px-5 text-[14px] font-bold transition-opacity hover:opacity-90"
              style={{ fontFamily: "var(--font-grotesk)" }}
            >
              Special offers
            </Link>
          )}
          {user && <CreditsMeter dark />}

          {authLoading ? (
            <div aria-hidden="true" className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
          ) : !user ? (
            <button
              type="button"
              onClick={() => openAuth("signin")}
              className="inline-flex h-10 items-center rounded-full border border-white/15 bg-white/[0.06] px-5 text-[14px] font-semibold text-white/90 backdrop-blur-xl transition-colors hover:bg-white/[0.12] hover:text-white"
              style={{ fontFamily: "var(--font-grotesk)" }}
            >
              Sign in
            </button>
          ) : (
            <div className="relative" data-pro-account>
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                aria-label="Account menu"
                aria-expanded={accountOpen}
                className="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] pe-3 ps-1 backdrop-blur-xl transition-colors hover:bg-white/[0.12]"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full text-sm font-black text-white"
                  style={{ background: tone }}
                >
                  {avatar ? (
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initial
                  )}
                </span>
                {isRealAdmin ? <AdminBadge /> : isGolden ? <GoldenBadge /> : <StudentBadge />}
                <ChevronDown size={14} className="text-white/60" />
              </button>

              {accountOpen && (
                <div className="rita-ondark absolute right-0 z-50 mt-3 flex max-h-[calc(100vh-8rem)] w-72 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#0c0c0e] shadow-[0_28px_70px_-30px_rgba(43,39,33,0.35)] backdrop-blur-xl">
                  <div className="shrink-0 px-4 pb-3 pt-4">
                    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] px-3.5 py-3">
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
                        <p className="truncate text-[14.5px] font-extrabold text-white">
                          {profile?.full_name || displayName}
                        </p>
                        <p className="mt-0.5 inline-flex rounded-full bg-white/10 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/60">
                          {isAdmin ? t("cms.header.roleAdmin") : isGolden ? "Golden member" : t("cms.header.roleUser")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
                    {isRealAdmin && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={adminMode}
                        onClick={toggleAdminMode}
                        className="mx-2 flex w-[calc(100%-1rem)] items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold text-white/85 transition-colors hover:bg-white/10"
                      >
                        <span className="inline-flex items-center gap-3">
                          <ShieldCheck size={16} className={adminMode ? "rita-accent" : "text-white/40"} />
                          Admin mode
                        </span>
                        <span
                          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                            adminMode ? "rita-accent-bg" : "bg-white/20"
                          }`}
                        >
                          <span
                            className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
                              adminMode ? "left-6" : "left-1"
                            }`}
                          />
                        </span>
                      </button>
                    )}
                    {isRealAdmin && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={imageEdit}
                        onClick={() => setImageEditMode(!imageEdit)}
                        className="mx-2 flex w-[calc(100%-1rem)] items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold text-white/85 transition-colors hover:bg-white/10"
                      >
                        <span className="inline-flex items-center gap-3">
                          <ImageUp size={16} className={imageEdit ? "rita-accent" : "text-white/40"} />
                          Image edit mode
                        </span>
                        <span
                          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                            imageEdit ? "rita-accent-bg" : "bg-white/20"
                          }`}
                        >
                          <span
                            className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
                              imageEdit ? "left-6" : "left-1"
                            }`}
                          />
                        </span>
                      </button>
                    )}
                    <Link to="/profile" onClick={() => setAccountOpen(false)} className={`mx-2 ${darkMenuLink}`}>
                      <Settings size={16} className="text-white/50" />
                      {t("cms.header.profileSettings")}
                    </Link>
                    <Link to="/my-plan" onClick={() => setAccountOpen(false)} className={`mx-2 ${darkMenuLink}`}>
                      <Gauge size={16} className="text-white/50" />
                      My plan
                    </Link>
                    <Link to="/pricing" onClick={() => setAccountOpen(false)} className={`mx-2 ${darkMenuLink}`}>
                      <Sparkles size={16} className="text-white/50" />
                      Plans & pricing
                    </Link>
                    <Link
                      to="/profile"
                      hash="notifications"
                      onClick={() => setAccountOpen(false)}
                      className={`mx-2 ${darkMenuLink}`}
                    >
                      <Bell size={16} className="text-white/50" />
                      {t("cms.header.notifications", { defaultValue: "Notifications" })}
                    </Link>
                    <InstallAppButton />
                    {isAdmin && (
                      <>
                        <div className="mx-3 my-1 border-t border-white/10" />
                        <Link to="/admin" onClick={() => setAccountOpen(false)} className={`mx-2 ${darkMenuLink}`}>
                          <LayoutGrid size={16} className="text-white/50" />
                          Admin
                        </Link>
                      </>
                    )}
                  </div>

                  <div className="shrink-0 border-t border-white/10 p-2">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-bold text-rose-300 transition-colors hover:bg-rose-500/10"
                    >
                      <LogOut size={16} />
                      {t("cms.header.logout")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="Menu"
          onClick={() => setSheet((s) => !s)}
          className="text-white lg:hidden"
        >
          {sheet ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {sheet && (
        <div className="rita-ondark relative mx-4 max-h-[80vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/85 p-3 backdrop-blur-xl lg:hidden">
          {NAV_GROUPS.flatMap((g) => g.columns.flatMap((c) => c.items)).map((i) => (
            <Link
              key={i.to + i.label}
              to={i.to as never}
              params={i.params as never}
              onClick={() => setSheet(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-white/90 hover:bg-white/10"
              style={{ fontFamily: "var(--font-grotesk)" }}
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                style={{ background: i.soft, color: i.ink }}
              >
                <i.icon size={15} />
              </span>
              {i.label}
            </Link>
          ))}
          <div className="mx-1 my-2 border-t border-white/10" />
          {SIMPLE_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to as never}
              onClick={() => setSheet(false)}
              className="block rounded-xl px-3 py-3 text-[16px] text-white/90 hover:bg-white/10"
              style={{ fontFamily: "var(--font-grotesk)" }}
            >
              {l.label}
            </Link>
          ))}
          <div className="mx-1 my-2 border-t border-white/10" />
          <Link
            to="/pricing"
            onClick={() => setSheet(false)}
            className="block rounded-xl px-3 py-3 text-[16px] text-white/90 hover:bg-white/10"
            style={{ fontFamily: "var(--font-grotesk)" }}
          >
            Pricing
          </Link>
          {settings.offers_page_enabled && (
            <Link
              to="/offers"
              onClick={() => setSheet(false)}
              className="block rounded-xl px-3 py-3 text-[16px] font-bold text-white hover:bg-white/10"
              style={{ fontFamily: "var(--font-grotesk)" }}
            >
              Special offers
            </Link>
          )}
          {user && (
            <div className="px-1 py-2">
              <CreditsMeter dark compact />
            </div>
          )}
          {user ? (
            <>
              <div className="mx-1 my-2 border-t border-white/10" />
              <div className="flex items-center gap-3 px-3 py-2">
                <span
                  className="grid h-9 w-9 place-items-center overflow-hidden rounded-full text-sm font-black text-white"
                  style={{ background: tone }}
                >
                  {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initial}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-bold text-white">{profile?.full_name || displayName}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                    {isAdmin ? "Admin" : isGolden ? "Golden member" : "Student"}
                  </p>
                </div>
              </div>
              <Link to="/profile" onClick={() => setSheet(false)} className="block rounded-xl px-3 py-3 text-[16px] text-white/90 hover:bg-white/10" style={{ fontFamily: "var(--font-grotesk)" }}>
                Profile settings
              </Link>
              <Link to="/my-plan" onClick={() => setSheet(false)} className="block rounded-xl px-3 py-3 text-[16px] text-white/90 hover:bg-white/10" style={{ fontFamily: "var(--font-grotesk)" }}>
                My plan
              </Link>
              {isAdmin && (
                <Link to="/admin" onClick={() => setSheet(false)} className="block rounded-xl px-3 py-3 text-[16px] font-bold text-white hover:bg-white/10" style={{ fontFamily: "var(--font-grotesk)" }}>
                  Admin panel
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="block w-full rounded-xl px-3 py-3 text-left text-[16px] font-bold text-rose-300 hover:bg-rose-500/10"
                style={{ fontFamily: "var(--font-grotesk)" }}
              >
                {t("cms.header.logout")}
              </button>
            </>
          ) : (
            !authLoading && (
              <button
                type="button"
                onClick={() => {
                  setSheet(false);
                  openAuth("signin");
                }}
                className="block w-full rounded-xl px-3 py-3 text-left text-[16px] text-white/90 hover:bg-white/10"
                style={{ fontFamily: "var(--font-grotesk)" }}
              >
                Sign in
              </button>
            )
          )}
        </div>
      )}
    </header>
  );
}
