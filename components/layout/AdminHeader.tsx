"use client";

import { useAuth, useCurrentUser } from "@/lib/auth/auth-context";
import { AdminMobileToggle } from "./AdminSidebar";
import { SearchInput } from "@/components/shared/SearchInput";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, LogOut, User, Settings } from "lucide-react";
import { getInitials } from "@/lib/utils";
import Link from "next/link";
import { useGetUnreadNotificationsCountQuery } from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";

export function AdminHeader() {
  const language = useDashboardLanguage();
  const authState = useCurrentUser();
  const { user } = authState;
  const { logout } = useAuth();
  const displayIdentifier = user?.email || user?.username || "";
  const notificationsEnabled =
    authState.isAuthenticated && authState.role === "admin";
  const { data: unreadCount = 0 } = useGetUnreadNotificationsCountQuery(undefined, {
    skip: !notificationsEnabled,
    pollingInterval: 120000,
    skipPollingIfUnfocused: true,
  });

  return (
    <header className="sticky top-0 z-30 px-4 py-4 backdrop-blur-md lg:px-8">
      <div className="flex h-16 items-center justify-between rounded-full border border-white/10 bg-[#06111f]/78 px-4 shadow-[0_18px_54px_rgba(0,0,0,0.22)] backdrop-blur-xl lg:px-5">
      <div className="flex items-center gap-3">
        <AdminMobileToggle />
        <SearchInput
          placeholder={
            language === "ar"
              ? "ابحث عن لاعبين أو مدربين أو مجموعات..."
              : "Search players, coaches, groups..."
          }
          className="hidden w-80 rounded-full border-white/10 bg-white/[0.03] text-slate-200 placeholder:text-slate-500 sm:block"
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Link href="/admin/notifications">
          <Button variant="ghost" size="icon-sm" className="relative rounded-full text-slate-300 hover:bg-white/10 hover:text-lime-300">
            <Bell className="h-4.5 w-4.5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </Link>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 rounded-full px-2 text-slate-200 hover:bg-white/10">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-lime-300/20 text-xs font-semibold text-lime-300">
                  {user ? getInitials(user.fullName) : "?"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium text-slate-200 sm:block">
                {user?.fullName ?? "Guest"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium">{user?.fullName}</p>
              <p className="text-xs text-muted-foreground">{displayIdentifier}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-red-400">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </div>
    </header>
  );
}
