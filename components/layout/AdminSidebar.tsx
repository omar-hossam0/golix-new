"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import {
  LayoutDashboard,
  MessageSquare,
  GraduationCap,
  Users,
  UserCheck,
  ClipboardCheck,
  Inbox,
  Trophy,
  CreditCard,
  Bell,
  BarChart3,
  Settings,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DashboardBrand } from "@/components/layout/DashboardBrand";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { toggleSidebarCollapse, setMobileSidebarOpen } from "@/lib/store/slices/uiSlice";

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  MessageSquare,
  GraduationCap,
  Users,
  UserCheck,
  ClipboardCheck,
  Inbox,
  Trophy,
  CreditCard,
  Bell,
  BarChart3,
  Settings,
};

interface NavItemProps {
  label: string;
  href?: string;
  icon?: string;
  children?: { label: string; href: string }[];
  collapsed: boolean;
  onOpenChildren?: () => void;
}

function NavItem({ label, href, icon, children, collapsed, onOpenChildren }: NavItemProps) {
  const pathname = usePathname();
  const Icon = icon ? iconMap[icon] : null;
  const isActive = href ? pathname === href : children?.some((c) => pathname.startsWith(c.href));

  if (children && children.length > 0) {
    return (
      <button
        onClick={onOpenChildren}
        className={cn(
          "group flex w-full items-center gap-3 rounded-full border px-3 py-2.5 text-sm font-medium transition-all",
          isActive
            ? "border-lime-300/45 bg-lime-300/10 text-lime-300 shadow-[0_0_24px_rgba(163,230,53,0.14)]"
            : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white",
          collapsed && "justify-center px-2"
        )}
      >
        {Icon && <Icon className="h-4.5 w-4.5 shrink-0" />}
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{label}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-lime-300" />
          </>
        )}
      </button>
    );
  }

  return (
    <Link
      href={href || "#"}
      className={cn(
        "flex items-center gap-3 rounded-full border px-3 py-2.5 text-sm font-medium transition-all",
        isActive
          ? "border-lime-300/45 bg-lime-300/10 text-lime-300 shadow-[0_0_24px_rgba(163,230,53,0.14)]"
          : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white",
        collapsed && "justify-center px-2"
      )}
    >
      {Icon && <Icon className="h-4.5 w-4.5 shrink-0" />}
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

export function AdminSidebar() {
  const language = useDashboardLanguage();
  const dispatch = useAppDispatch();
  const { sidebarCollapsed, mobileSidebarOpen } = useAppSelector((s) => s.ui);
  const navItems = NAV_ITEMS.admin;
  const pathname = usePathname();
  const initialParent = useMemo(
    () => navItems.find((item) => item.children?.some((child) => pathname.startsWith(child.href))),
    [navItems, pathname]
  );
  const [activeParent, setActiveParent] = useState<typeof navItems[number] | null>(initialParent ?? null);
  const visibleChildren = !sidebarCollapsed ? activeParent?.children : null;

  return (
    <>
      {/* Mobile Overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => dispatch(setMobileSidebarOpen(false))}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/10 bg-[#06111f]/92 text-slate-100 shadow-[20px_0_70px_rgba(0,0,0,0.25)] backdrop-blur-2xl transition-all duration-300",
          sidebarCollapsed ? "w-[68px]" : "w-64",
          mobileSidebarOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "border-b border-white/10",
            sidebarCollapsed
              ? "flex flex-col items-center gap-2 px-2 py-3"
              : "flex min-h-20 items-center justify-between px-4 py-3"
          )}
        >
          <DashboardBrand href="/admin/dashboard" collapsed={sidebarCollapsed} />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => dispatch(toggleSidebarCollapse())}
            className="hidden rounded-full text-slate-300 hover:bg-white/10 hover:text-lime-300 lg:flex"
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 transition-transform",
                sidebarCollapsed && "rotate-180"
              )}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => dispatch(setMobileSidebarOpen(false))}
            className="rounded-full text-slate-300 hover:bg-white/10 hover:text-lime-300 lg:hidden"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          {visibleChildren ? (
            <div className="animate-slide-in space-y-4">
              <button
                onClick={() => setActiveParent(null)}
                className="flex w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-lime-300/40 hover:text-lime-300"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="min-w-0 flex-1 truncate text-left">{activeParent?.label}</span>
              </button>
              <nav className="space-y-1">
                {visibleChildren.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={() => dispatch(setMobileSidebarOpen(false))}
                    className={cn(
                      "flex items-center justify-between rounded-full border px-3 py-2.5 text-sm transition-all",
                      pathname === child.href
                        ? "border-lime-300/45 bg-lime-300/10 font-medium text-lime-300"
                        : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                    )}
                  >
                    <span>{child.label}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                ))}
              </nav>
            </div>
          ) : (
            <nav className="space-y-1">
              {navItems.map((item, i) => (
                <NavItem
                  key={i}
                  {...item}
                  collapsed={sidebarCollapsed}
                  onOpenChildren={() => setActiveParent(item)}
                />
              ))}
            </nav>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-white/10 p-3">
          {!sidebarCollapsed && (
            <div className="rounded-2xl border border-lime-300/20 bg-lime-300/5 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-lime-300/80">
                Goalix Academy
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {language === "ar" ? "عمليات رياضية v1.0" : "Sports operations v1.0"}
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export function AdminMobileToggle() {
  const dispatch = useAppDispatch();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => dispatch(setMobileSidebarOpen(true))}
      className="rounded-full text-slate-200 hover:bg-white/10 hover:text-lime-300 lg:hidden"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}
