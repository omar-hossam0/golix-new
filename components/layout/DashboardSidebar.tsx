import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Baby,
  BarChart3,
  Bell,
  BrainCircuit,
  Cake,
  Calendar,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  Dumbbell,
  GraduationCap,
  HelpCircle,
  Home,
  Inbox,
  LayoutDashboard,
  LogOut,
  Moon,
  MessageSquare,
  Ruler,
  Settings,
  Star,
  Sun,
  TrendingUp,
  Trophy,
  User,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { ROLE_ROUTES } from "@/lib/constants";
import type { UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href?: string;
  icon?: string;
  children?: { label: string; href: string }[];
};

const iconMap: Record<string, React.ElementType> = {
  Baby,
  BarChart3,
  Bell,
  BrainCircuit,
  Cake,
  Calendar,
  ClipboardCheck,
  CreditCard,
  Dumbbell,
  GraduationCap,
  Home,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  Ruler,
  Settings,
  Star,
  TrendingUp,
  Trophy,
  User,
  UserCheck,
  UserPlus,
  Users,
};

const roleLabels: Record<UserRole, string> = {
  admin: "Academy OS",
  coach: "Coach Hub",
  player: "Player Hub",
  parent: "Family Hub",
};

const settingsRoutes: Partial<Record<UserRole, string>> = {
  admin: "/admin/settings",
  coach: "/coach/settings",
  player: "/player/settings",
};

function firstHref(item: NavItem) {
  return item.href ?? item.children?.[0]?.href ?? "#";
}

function isActive(pathname: string, item: NavItem) {
  if (item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`))) return true;
  return Boolean(item.children?.some((child) => pathname === child.href || pathname.startsWith(`${child.href}/`)));
}

type DashboardLanguage = "en" | "ar";
type DashboardTheme = "light" | "dark";

type DashboardSidebarProps = {
  role: UserRole;
  theme: DashboardTheme;
  setTheme: React.Dispatch<React.SetStateAction<DashboardTheme>>;
  language: DashboardLanguage;
  setLanguage: React.Dispatch<React.SetStateAction<DashboardLanguage>>;
  mobileNavOpen: boolean;
  closeMobileNav: () => void;
  nav: NavItem[];
  openSections: Record<string, boolean>;
  setOpenSections: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  compactNav: boolean;
  logout: () => void;
  hasSettingsInMainNav: boolean;
  t: (label: string) => string;
};

export function DashboardSidebar({
  role,
  theme,
  setTheme,
  language,
  setLanguage,
  mobileNavOpen,
  closeMobileNav,
  nav,
  openSections,
  setOpenSections,
  compactNav,
  logout,
  hasSettingsInMainNav,
  t,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className={cn("goalix-reference-sidebar", mobileNavOpen && "is-mobile-open")}>
      <Link
        href={ROLE_ROUTES[role]}
        className="goalix-reference-brand"
        aria-label={t("Goalix dashboard home")}
        onClick={closeMobileNav}
      >
        <span className="goalix-reference-mark">G</span>
        <span>
          <strong>Goalix</strong>
          <small>{t(roleLabels[role])}</small>
        </span>
      </Link>

      <div className="goalix-mobile-drawer-tools">
        <button
          type="button"
          aria-label={language === "ar" ? t("English") : t("Arabic")}
          onClick={() => setLanguage((current) => (current === "ar" ? "en" : "ar"))}
        >
          {language === "ar" ? "EN" : "AR"}
        </button>
        <button
          type="button"
          aria-label={theme === "dark" ? t("Light theme") : t("Dark theme")}
          onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          <span>{theme === "dark" ? t("Light theme") : t("Dark theme")}</span>
        </button>
      </div>

      <div className="goalix-reference-menu-label">{t("Menu")}</div>
      <nav className="goalix-reference-nav">
        {nav.map((item) => {
          const Icon = (item.icon && iconMap[item.icon]) || LayoutDashboard;
          const active = isActive(pathname, item);
          const isOpen = openSections[item.label] ?? active;

          if (item.children?.length) {
            return (
              <div key={item.label} className={cn("goalix-reference-nav-group", isOpen && "is-open")}>
                <button
                  type="button"
                  className={cn("goalix-reference-nav-item is-section", active && "is-active")}
                  aria-expanded={isOpen}
                  aria-label={t(item.label)}
                  title={t(item.label)}
                  onClick={() => {
                    const isMobileViewport = window.matchMedia("(max-width: 760px)").matches;

                    if (compactNav && !mobileNavOpen && !isMobileViewport) {
                      closeMobileNav();
                      router.push(firstHref(item));
                      return;
                    }

                    setOpenSections((current) => ({ ...current, [item.label]: !isOpen }));
                  }}
                >
                  <Icon size={17} />
                  <span>{t(item.label)}</span>
                  <em>{item.children.length}</em>
                  <ChevronDown className="goalix-reference-chevron" size={15} />
                </button>
                <div className="goalix-reference-subnav">
                  {item.children.map((child) => {
                    const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`);

                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn("goalix-reference-subnav-link", childActive && "is-active")}
                        onClick={closeMobileNav}
                      >
                        {t(child.label)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href ?? firstHref(item)}
              className={cn("goalix-reference-nav-item", active && "is-active")}
              aria-label={t(item.label)}
              title={t(item.label)}
              onClick={closeMobileNav}
            >
              <Icon size={17} />
              <span>{t(item.label)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="goalix-reference-menu-label">{t("General")}</div>
      <div className="goalix-reference-nav">
        {!hasSettingsInMainNav && (
          <Link
            href={settingsRoutes[role] ?? ROLE_ROUTES[role]}
            className="goalix-reference-nav-item"
            onClick={closeMobileNav}
          >
            <Settings size={17} />
            <span>{t("Settings")}</span>
          </Link>
        )}
        <Link href={`/${role}/help`} className="goalix-reference-nav-item" onClick={closeMobileNav}>
          <HelpCircle size={17} />
          <span>{t("Help")}</span>
        </Link>
        <button type="button" onClick={logout} className="goalix-reference-nav-item">
          <LogOut size={17} />
          <span>{t("Logout")}</span>
        </button>
      </div>

    </aside>
  );
}
