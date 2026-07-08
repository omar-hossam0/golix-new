"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Baby,
  Bell,
  CheckCheck,
  ExternalLink,
  Loader2,
  Mail,
  Menu,
  Moon,
  MessageSquare,
  RefreshCw,
  Search,
  Settings,
  ShieldAlert,
  Sun,
} from "lucide-react";
import { NAV_ITEMS, ROLE_ROUTES } from "@/lib/constants";
import { useCoachPermissions } from "@/lib/hooks/useCoachPermissions";
import { useRealtimeNotifications } from "@/lib/hooks/useRealtimeNotifications";
import { getNotificationHref, localizeNotification } from "@/lib/notifications";
import type { CoachPermission } from "@/lib/store/api/calendarApi";
import { useDashboardNotifications } from "@/lib/hooks/useDashboardNotifications";
import {
  useGetAcademyQuery,
  useGetCurrentPermissionsQuery,
} from "@/lib/store/api/adminApi";
import type { UserRole } from "@/lib/types";
import { useAuth, useCurrentUser } from "@/lib/auth/auth-context";
import { useParentSelectedChild } from "@/lib/hooks/useParentSelectedChild";
import { cn, formatDateTime, getInitials } from "@/lib/utils";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";
import { arCopy } from "@/lib/translations";
import type { DashboardLanguage, NavItem } from "@/components/layout/dashboardFrameTypes";
import {
  filterAdminNav,
  filterCoachNav,
  firstNavHref,
  hasAnyPermission,
  requiredAdminPermissions,
  requiredCoachPermission,
  roleLabels,
  settingsRoutes,
} from "@/components/layout/dashboardNavigation";
import { useDashboardPreferences } from "@/components/layout/useDashboardPreferences";
import { useDashboardDomTranslations } from "@/components/layout/useDashboardDomTranslations";

const getExternalHref = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

function translateDynamicLabel(label: string, language: DashboardLanguage): string | null {
  if (language !== "ar") return null;

  const welcomeMatch = label.match(/^Welcome,\s*(.+)$/i);
  if (welcomeMatch) return `أهلا، ${translate(welcomeMatch[1], language)}`;

  const doneMatch = label.match(/^(.+)\sDone$/i);
  if (doneMatch) return `${translate(doneMatch[1], language)} ${arCopy.Done}`;

  const fractionDoneMatch = label.match(/^(\d+\s*\/\s*\d+)\sDone$/i);
  if (fractionDoneMatch) return `${fractionDoneMatch[1]} ${arCopy.Done}`;

  const rankingsInMatch = label.match(/^Rankings in\s+(.+)$/i);
  if (rankingsInMatch) return `الترتيب داخل ${translate(rankingsInMatch[1], language)}`;

  const rankedMatchesMatch = label.match(/^(\d+)\s+(?:ranked\s+matches?|matches?\s+ranked)$/i);
  if (rankedMatchesMatch) {
    const count = Number(rankedMatchesMatch[1]);
    return count === 1 ? "مباراة واحدة في الترتيب" : `${rankedMatchesMatch[1]} مباريات في الترتيب`;
  }

  const recordsCountMatch = label.match(/^(\d+)\s+records?$/i);
  if (recordsCountMatch) {
    const count = Number(recordsCountMatch[1]);
    return count === 1 ? "سجل واحد" : `${recordsCountMatch[1]} سجلات`;
  }

  const trainingRecordsMatch = label.match(/^(\d+)\s+training records?$/i);
  if (trainingRecordsMatch) {
    const count = Number(trainingRecordsMatch[1]);
    return count === 1 ? "سجل تدريب واحد" : `${trainingRecordsMatch[1]} سجلات تدريب`;
  }

  const matchRecordsMatch = label.match(/^(\d+)\s+match records?$/i);
  if (matchRecordsMatch) {
    const count = Number(matchRecordsMatch[1]);
    return count === 1 ? "سجل مباراة واحد" : `${matchRecordsMatch[1]} سجلات مباريات`;
  }

  const recordedSessionsAttendedMatch = label.match(/^(\d+)\s*\/\s*(\d+)\s+recorded sessions attended$/i);
  if (recordedSessionsAttendedMatch) return `${recordedSessionsAttendedMatch[1]}/${recordedSessionsAttendedMatch[2]} حصص مسجلة تم حضورها`;

  const showingDatabaseRecordsMatch = label.match(/^Showing\s+(\d+)\s+of\s+(\d+)\s+database records$/i);
  if (showingDatabaseRecordsMatch) return `يعرض ${showingDatabaseRecordsMatch[1]} من ${showingDatabaseRecordsMatch[2]} سجلات قاعدة البيانات`;

  const subscriptionsCountMatch = label.match(/^(\d+)\s+subscriptions?$/i);
  if (subscriptionsCountMatch) {
    const count = Number(subscriptionsCountMatch[1]);
    return count === 1 ? "اشتراك واحد" : `${subscriptionsCountMatch[1]} اشتراكات`;
  }

  const sessionCountMatch = label.match(/^(\d+)\s+sessions?$/i);
  if (sessionCountMatch) return `${sessionCountMatch[1]} ${Number(sessionCountMatch[1]) === 1 ? "حصة" : "حصص"}`;

  const attendedSessionsMatch = label.match(/^(\d+)\s*\/\s*(\d+)\s+sessions?\s+attended$/i);
  if (attendedSessionsMatch) return `${attendedSessionsMatch[1]}/${attendedSessionsMatch[2]} حصص تم حضورها`;

  const countedPhraseMatch = label.match(/^(\d+)\s+(.+)$/i);
  if (countedPhraseMatch) return `${countedPhraseMatch[1]} ${translate(countedPhraseMatch[2], language)}`;

  const ratingBadgeMatch = label.match(/^(Overall|Fatigue)\s+(.+)$/i);
  if (ratingBadgeMatch) return `${translate(ratingBadgeMatch[1], language)} ${ratingBadgeMatch[2]}`;

  const upcomingSessionsMatch = label.match(/^Upcoming sessions for\s+(.+)$/i);
  if (upcomingSessionsMatch) return `الحصص القادمة لـ ${translate(upcomingSessionsMatch[1], language)}`;

  const selectedMatch = label.match(/^(\d+)\s+selected$/i);
  if (selectedMatch) return `${selectedMatch[1]} محدد`;

  const groupsInMatch = label.match(/^Groups in\s+(.+)$/i);
  if (groupsInMatch) return `المجموعات في ${translate(groupsInMatch[1], language)}`;

  const birthdaysInMatch = label.match(/^Birthdays in\s+(.+)$/i);
  if (birthdaysInMatch) return `سنوات الميلاد في ${translate(birthdaysInMatch[1], language)}`;

  const loadingMatch = label.match(/^Loading\s+(.+?)\.\.\.$/i);
  if (loadingMatch) return `جاري تحميل ${translate(loadingMatch[1], language)}...`;

  const searchMatch = label.match(/^Search\s+(.+?)\.\.\.$/i);
  if (searchMatch) return `ابحث في ${translate(searchMatch[1], language)}...`;

  const chooseMatch = label.match(/^Choose\s+(.+?)\.\.\.$/i);
  if (chooseMatch) return `اختر ${translate(chooseMatch[1], language)}...`;

  const noFoundMatch = label.match(/^No\s+(.+?)\s+found(?:\s+for\s+(.+?))?\.?$/i);
  if (noFoundMatch) {
    const subject = translate(noFoundMatch[1], language);
    const scope = noFoundMatch[2] ? ` في ${translate(noFoundMatch[2], language)}` : "";
    return `لا توجد ${subject}${scope}.`;
  }

  const dueDateMatch = label.match(/^Due date:\s*(.+)$/i);
  if (dueDateMatch) return `تاريخ الاستحقاق: ${translate(dueDateMatch[1], language)}`;

  const onMatch = label.match(/^On\s+(.+)$/i);
  if (onMatch) return `على ${translate(onMatch[1], language)}`;

  return null;
}

function translate(label: string, language: DashboardLanguage): string {
  if (language !== "ar") return label;
  const normalizedLabel = label.replace(/\u00a0/g, " ").replace(/[’]/g, "'").trim();
  if (arCopy[normalizedLabel]) return arCopy[normalizedLabel];
  

  const dynamicTranslation = translateDynamicLabel(normalizedLabel, language);
  if (dynamicTranslation) return dynamicTranslation;

  const pipeParts = normalizedLabel.split("|");
  if (pipeParts.length > 1) {
    return pipeParts.map((part) => translate(part, language)).join(" | ");
  }

  let next = normalizedLabel;
  const terms = Object.entries(arCopy).sort((a, b) => b[0].length - a[0].length);

  for (const [source, target] of terms) {
    if (!source || source.length < 3 || source === target) continue;
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const hasOnlyAsciiWords = /^[A-Za-z0-9 ]+$/.test(source);
    const pattern = hasOnlyAsciiWords
      ? new RegExp(`(^|[^A-Za-z0-9])(${escaped})(?=$|[^A-Za-z0-9])`, "gi")
      : new RegExp(escaped, "gi");
    next = next.replace(pattern, (...args) => {
      const leading = hasOnlyAsciiWords ? args[1] : "";
      return `${leading}${target}`;
    });
  }

  return next;
}

function ParentChildSwitcher({ t }: { t: (label: string) => string }) {
  const { children, selectedChildId, setSelectedChildId, isLoading } =
    useParentSelectedChild();

  if (isLoading || children.length <= 1) return null;

  return (
    <label className="goalix-parent-child-switcher">
      <Baby size={15} />
      <select
        aria-label={t("Switch child")}
        value={selectedChildId}
        onChange={(event) => setSelectedChildId(event.target.value)}
      >
        {children.map((child) => (
          <option key={child.id} value={child.id}>
            {child.full_name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DashboardFrame({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  useRealtimeNotifications();
  const pathname = usePathname();
  const router = useRouter();
  const authState = useCurrentUser();
  const { user } = authState;
  const mfaSetupRequired = Boolean(authState.mfaSetupRequired);
  const { logout } = useAuth();
  const contentRef = useRef<HTMLDivElement>(null);
  const messageMenuRef = useRef<HTMLDivElement>(null);
  const {
    can: coachCan,
    isLoading: coachPermissionsLoading,
    isFetching: coachPermissionsFetching,
  } = useCoachPermissions({
    skip: role !== "coach" || !authState.isAuthenticated || mfaSetupRequired,
  });
  const {
    data: currentPermissions,
    isLoading: adminPermissionsLoading,
    isFetching: adminPermissionsFetching,
  } = useGetCurrentPermissionsQuery(user?.id, {
    skip: role !== "admin" || !authState.isAuthenticated || mfaSetupRequired,
  });
  const adminPermissionSet = useMemo(
    () => new Set(currentPermissions?.permissions ?? []),
    [currentPermissions?.permissions],
  );
  const nav = useMemo(() => {
    const items = NAV_ITEMS[role] as NavItem[];
    if (mfaSetupRequired) {
      const settingsHref = settingsRoutes[role];
      return settingsHref
        ? items
            .map((item) => {
              const children = item.children?.filter((child) => child.href === settingsHref);
              return children ? { ...item, children } : item;
            })
            .filter((item) => item.href === settingsHref || Boolean(item.children?.length))
        : items;
    }
    if (role === "admin") return filterAdminNav(items, adminPermissionSet);
    if (role !== "coach") return items;
    return filterCoachNav(items, coachCan);
  }, [adminPermissionSet, coachCan, mfaSetupRequired, role]);
  const hasSettingsInMainNav = useMemo(
    () =>
      nav.some((item) =>
        item.href === (settingsRoutes[role] ?? ROLE_ROUTES[role]) ||
        item.children?.some(
          (child) => child.href === (settingsRoutes[role] ?? ROLE_ROUTES[role]),
        ),
      ),
    [nav, role],
  );
  const firstAllowedHref = useMemo(() => firstNavHref(nav), [nav]);
  const adminPagePermissions =
    role === "admin" ? requiredAdminPermissions(pathname) : null;
  const pagePermission =
    role === "coach" ? requiredCoachPermission(pathname) : null;
  const pagePermissionLoading =
    (Boolean(pagePermission) &&
      (coachPermissionsLoading || coachPermissionsFetching)) ||
    (Boolean(adminPagePermissions) &&
      (adminPermissionsLoading || adminPermissionsFetching));
  const pagePermissionDenied =
    !mfaSetupRequired &&
    ((Boolean(pagePermission) &&
    !pagePermissionLoading &&
      !coachCan(pagePermission as CoachPermission)) ||
    (Boolean(adminPagePermissions) &&
      !pagePermissionLoading &&
      !hasAnyPermission(adminPermissionSet, adminPagePermissions || undefined)));

  useEffect(() => {
    if (
      role === "admin" &&
      pagePermissionDenied &&
      firstAllowedHref &&
      firstAllowedHref !== pathname
    ) {
      router.replace(firstAllowedHref);
    }
  }, [firstAllowedHref, pagePermissionDenied, pathname, role, router]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const {
    language,
    setLanguage,
    theme,
    setTheme,
    density,
    motion,
    focusMode,
    compactNav,
  } = useDashboardPreferences();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [messageMenuOpen, setMessageMenuOpen] = useState(false);
  const { data: academy } = useGetAcademyQuery(undefined, {
    skip: !authState.isAuthenticated,
  });
  const academySettings = (academy?.settings ?? {}) as Record<string, unknown>;
  const communityWhatsappUrl =
    typeof academySettings.communityWhatsappUrl === "string"
      ? academySettings.communityWhatsappUrl
      : "";
  const communityWhatsappHref = getExternalHref(communityWhatsappUrl);

  const t = useMemo(() => (label: string) => translate(label, language), [language]);

  useDashboardDomTranslations({
    language,
    pathname,
    contentRef,
    translateLabel: translate,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setMobileNavOpen(false);
      setMessageMenuOpen(false);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [pathname]);

  useEffect(() => {
    if (!messageMenuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && messageMenuRef.current?.contains(target)) return;
      setMessageMenuOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);

    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [messageMenuOpen]);
  const {
    notificationsOpen,
    setNotificationsOpen,
    notifications,
    notificationsLoading,
    notificationsError,
    refetchNotifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    markAllNotificationsReadState,
    notificationsEnabled,
  } = useDashboardNotifications(role);
  const mobileNavToggleId = `goalix-mobile-nav-toggle-${role}`;

  const toggleMobileNav = () => {
    setMobileNavOpen((current) => !current);
  };

  const closeMobileNav = () => {
    setMobileNavOpen(false);
    const toggle = document.getElementById(mobileNavToggleId) as HTMLInputElement | null;
    if (toggle) toggle.checked = false;
  };

  return (
    <div
      className={`goalix-reference-frame goalix-reference-${role}`}
      data-dashboard-theme={theme}
      data-dashboard-language={language}
      data-dashboard-density={density}
      data-dashboard-motion={motion}
      data-dashboard-focus={focusMode}
      dir={language === "ar" ? "rtl" : "ltr"}
      lang={language}
    >
      <input
        id={mobileNavToggleId}
        className="goalix-mobile-nav-checkbox"
        type="checkbox"
        aria-hidden="true"
        tabIndex={-1}
        checked={mobileNavOpen}
        readOnly
      />
      <header className="goalix-mobile-header">
        <button
          type="button"
          className="goalix-mobile-menu-button"
          aria-label={t("Menu")}
          aria-expanded={mobileNavOpen}
          onClick={toggleMobileNav}
        >
          <Menu size={18} />
        </button>
        <Link href={ROLE_ROUTES[role]} className="goalix-mobile-logo" aria-label={t("Goalix dashboard home")}>
          <span className="goalix-mobile-logo-mark">G</span>
          <strong>GOALIX</strong>
        </Link>
        <div className="goalix-mobile-header-actions">
          <Link href={`/${role}/notifications`} className="goalix-mobile-notification" aria-label={t("Notifications")}>
            <Bell size={18} />
            {unreadCount > 0 && <span />}
          </Link>
          <div className="goalix-mobile-avatar" aria-label={user?.fullName || t(roleLabels[role])}>
            {getInitials(user?.fullName || role)}
          </div>
        </div>
      </header>

      <button
        type="button"
        className="goalix-mobile-nav-backdrop"
        aria-label={t("Close menu")}
        onClick={() => setMobileNavOpen(false)}
      />

      <DashboardSidebar
        role={role}
        theme={theme}
        setTheme={setTheme}
        language={language}
        setLanguage={setLanguage}
        mobileNavOpen={mobileNavOpen}
        closeMobileNav={closeMobileNav}
        nav={nav}
        openSections={openSections}
        setOpenSections={setOpenSections}
        compactNav={compactNav}
        logout={logout}
        hasSettingsInMainNav={hasSettingsInMainNav}
        t={t}
      />

      <main className="goalix-reference-main">
        <header className="goalix-reference-topbar">
          <label className="goalix-reference-search">
            <Search size={18} />
            <input placeholder={t("Search players, sessions, matches...")} />
            <kbd>{t("Ctrl F")}</kbd>
          </label>

          <div className="goalix-reference-top-actions">
            {role === "parent" && <ParentChildSwitcher t={t} />}
            <div className="goalix-reference-switches">
              <button
                type="button"
                className="goalix-reference-pill-control"
                aria-label={language === "ar" ? t("English") : t("Arabic")}
                onClick={() => setLanguage((current) => (current === "ar" ? "en" : "ar"))}
              >
                <span>{language === "ar" ? "EN" : "AR"}</span>
              </button>
              <button
                type="button"
                className="goalix-reference-pill-control"
                aria-label={theme === "dark" ? t("Light theme") : t("Dark theme")}
                onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
              >
                {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
                <span>{theme === "dark" ? t("Light theme") : t("Dark theme")}</span>
              </button>
            </div>
            <div className="goalix-reference-message-menu" ref={messageMenuRef}>
              <button
                type="button"
                className="goalix-reference-message-trigger"
                aria-label={t("Messages")}
                aria-expanded={messageMenuOpen}
                onClick={() => setMessageMenuOpen((current) => !current)}
              >
                <Mail size={18} />
              </button>
              {messageMenuOpen && (
                <div className="goalix-reference-message-panel" role="menu" aria-label={t("Messages")}>
                  <strong>{t("Community")}</strong>
                  {communityWhatsappHref ? (
                    <a
                      href={communityWhatsappHref}
                      target="_blank"
                      rel="noreferrer"
                      role="menuitem"
                      onClick={() => setMessageMenuOpen(false)}
                    >
                      <MessageSquare size={16} />
                      <span>{t("WhatsApp Community")}</span>
                      <ExternalLink size={14} />
                    </a>
                  ) : (
                    <p>{t("WhatsApp community link is not set yet.")}</p>
                  )}
                  {role === "admin" && (
                    <Link href="/admin/settings" role="menuitem" onClick={() => setMessageMenuOpen(false)}>
                      <Settings size={16} />
                      <span>{t("Edit community link")}</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
            <div className="goalix-reference-notifications">
              <button
                type="button"
                className="goalix-reference-notification-trigger"
                aria-label={t("Notifications")}
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((current) => !current)}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="goalix-reference-notification-badge">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="goalix-reference-notification-panel" role="dialog" aria-label={t("Notifications")}>
                  <div className="goalix-reference-notification-head">
                    <div>
                      <strong>{t("Notifications")}</strong>
                      <small>{unreadCount} {t("unread")}</small>
                    </div>
                    <div>
                      <button
                        type="button"
                        aria-label={t("Refresh notifications")}
                        disabled={!notificationsEnabled}
                        onClick={() => {
                          if (notificationsEnabled) refetchNotifications();
                        }}
                      >
                        <RefreshCw size={14} />
                      </button>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          disabled={markAllNotificationsReadState.isLoading}
                          onClick={() => markAllNotificationsRead()}
                        >
                          <CheckCheck size={14} />
                          <span>{t("Read all")}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="goalix-reference-notification-list">
                    {notificationsLoading ? (
                      <div className="goalix-reference-notification-empty">{t("Loading notifications...")}</div>
                    ) : notificationsError ? (
                      <div className="goalix-reference-notification-empty">{t("Could not load notifications.")}</div>
                    ) : notifications.length ? (
                      notifications.slice(0, 8).map((notification) => {
                        const localized = localizeNotification(notification, language);

                        return (
                          <Link
                            key={notification.id}
                            href={getNotificationHref(role, notification.type, notification.data)}
                            className={cn(
                              "goalix-reference-notification-row",
                              !notification.is_read && "is-unread",
                            )}
                            onClick={() => {
                              setNotificationsOpen(false);
                              if (!notification.is_read) {
                                markNotificationRead(notification.id);
                              }
                            }}
                          >
                            <span />
                            <div>
                              <strong>{localized.title}</strong>
                              <p>{localized.body}</p>
                              <small>
                                {formatDateTime(
                                  notification.created_at,
                                  language === "ar" ? "ar-EG" : "en-US",
                                )}
                              </small>
                            </div>
                          </Link>
                        );
                      })
                    ) : (
                      <div className="goalix-reference-notification-empty">{t("No notifications yet.")}</div>
                    )}
                  </div>

                  <Link
                    className="goalix-reference-notification-all"
                    href={`/${role}/notifications`}
                    onClick={() => setNotificationsOpen(false)}
                  >
                    {t("View all notifications")}
                  </Link>
                </div>
              )}
            </div>
            <div className="goalix-reference-user">
              <span>{getInitials(user?.fullName || role)}</span>
              <div>
                <strong>{user?.fullName || t(roleLabels[role])}</strong>
                <small>{user?.email || `${role}@goalix.local`}</small>
              </div>
            </div>
          </div>
        </header>

        <div ref={contentRef} className="goalix-reference-content">
          {pagePermissionLoading ? (
            <div className="flex min-h-[45vh] items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("Checking coach permissions...")}
            </div>
          ) : pagePermissionDenied ? (
            <div className="mx-auto flex min-h-[45vh] max-w-xl items-center justify-center">
              <div className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
                <ShieldAlert className="mx-auto h-9 w-9 text-amber-300" />
                <h1 className="mt-3 text-lg font-semibold">{t("Access not assigned")}</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("Your current role does not include permission for this page. Ask an academy administrator to update your role or permission grants.")}
                </p>
                <button
                  type="button"
                  className="mt-4 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted/50"
                  onClick={() => router.replace(firstAllowedHref || ROLE_ROUTES[role] || "/")}
                >
                  {t("Back to home")}
                </button>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}
