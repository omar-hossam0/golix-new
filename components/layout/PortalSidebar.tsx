"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import type { UserRole } from "@/lib/types";
import {
  Home,
  Users,
  ClipboardCheck,
  Star,
  Ruler,
  Calendar,
  Trophy,
  User,
  TrendingUp,
  Dumbbell,
  Baby,
  CreditCard,
  Bell,
  BrainCircuit,
  Cake,
  ChevronDown,
  Menu,
  X,
  LogOut,
  MessageSquare,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth, useCurrentUser } from "@/lib/auth/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DashboardBrand } from "@/components/layout/DashboardBrand";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { getInitials } from "@/lib/utils";

const iconMap: Record<string, React.ElementType> = {
  Home,
  MessageSquare,
  Users,
  ClipboardCheck,
  Star,
  Ruler,
  Calendar,
  Trophy,
  User,
  TrendingUp,
  Dumbbell,
  Baby,
  CreditCard,
  Bell,
  BrainCircuit,
  Cake,
  Settings,
};

interface PortalSidebarProps {
  role: UserRole;
  brandColor?: string;
}

function NavItem({
  label,
  href,
  icon,
  children,
}: {
  label: string;
  href?: string;
  icon?: string;
  children?: { label: string; href: string }[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(() =>
    children ? children.some((c) => pathname.startsWith(c.href)) : false
  );
  const Icon = icon ? iconMap[icon] : null;
  const isActive = href ? pathname === href || pathname.startsWith(href + "/") : false;

  if (children) {
    const hasActiveChild = children.some((c) => pathname.startsWith(c.href));
    const activeChildHref = [...children]
      .filter((child) => pathname === child.href || pathname.startsWith(`${child.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href;
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
            hasActiveChild
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          <span className="flex-1 text-left">{label}</span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
        {open && (
          <div className="ml-7 mt-1 space-y-0.5 border-l border-border/50 pl-3">
            {children.map((child) => {
              const childActive = child.href === activeChildHref;
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm transition-colors",
                    childActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={href || "#"}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      <span>{label}</span>
    </Link>
  );
}

export function PortalSidebar({ role }: PortalSidebarProps) {
  const language = useDashboardLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useCurrentUser();
  const { logout } = useAuth();
  const nav = NAV_ITEMS[role] || [];

  const roleTitles: Record<string, string> = {
    coach: "Coach Portal",
    player: "Player Portal",
    parent: "Parent Portal",
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-card border-r border-border/50">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 py-4">
        <DashboardBrand
          href={`/${role}/home`}
          subtitle={roleTitles[role]}
          className="flex-1"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* User Info */}
      {user && (
        <div className="mx-4 mb-4 flex items-center gap-3 rounded-lg bg-muted/30 p-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/20 text-sm text-primary">
              {getInitials(user.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.fullName}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{role}</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1">
          {nav.map((item: { label: string; href?: string; icon?: string; children?: { label: string; href: string }[] }) => (
            <NavItem key={item.label} {...item} />
          ))}
        </div>
      </ScrollArea>

      {/* Logout */}
      <div className="border-t border-border/50 p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          <span>{language === "ar" ? "تسجيل الخروج" : "Sign Out"}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="fixed left-4 top-4 z-50 lg:hidden"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-full w-64 transition-transform lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebar}
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:left-0 lg:top-0 lg:z-30 lg:block lg:h-full lg:w-64">
        {sidebar}
      </aside>
    </>
  );
}
