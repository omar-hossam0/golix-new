import type { CoachPermission } from "@/lib/store/api/calendarApi";
import type { UserRole } from "@/lib/types";
import type { NavItem } from "@/components/layout/dashboardFrameTypes";

export const roleLabels: Record<UserRole, string> = {
  admin: "Academy OS",
  coach: "Coach Hub",
  player: "Player Hub",
  parent: "Family Hub",
};

export const settingsRoutes: Partial<Record<UserRole, string>> = {
  admin: "/admin/settings",
  coach: "/coach/settings",
  player: "/player/settings",
};

const adminNavPermissions: Record<string, string[]> = {
  "/admin/dashboard": ["access_admin_dashboard", "admin.dashboard.access"],
  "/admin/chat": ["access_admin_dashboard", "admin.dashboard.access"],
  "/admin/requests": ["manage_users", "admin.user.update"],
  "/admin/academy/branches": ["manage_teams", "admin.group.manage"],
  "/admin/academy/birth-years": ["manage_teams", "admin.group.manage"],
  "/admin/academy/groups": ["manage_teams", "admin.group.manage"],
  "/admin/coaches": ["manage_coaches", "coach.read.academy", "coach.read.branch"],
  "/admin/coaches/assign": ["manage_coaches", "coach.update"],
  "/admin/coaches/assignments": ["manage_coaches", "coach.update"],
  "/admin/players": ["manage_players", "player.read.academy", "player.read.branch"],
  "/admin/parents": ["manage_users", "admin.user.read", "admin.user.update"],
  "/admin/calendar": ["manage_schedules", "calendar.manage.academy"],
  "/admin/matches": ["manage_schedules", "calendar.manage.academy", "ranking.read.academy"],
  "/admin/matches/archive": ["manage_schedules", "calendar.manage.academy", "ranking.read.academy"],
  "/admin/attendance": ["manage_attendance", "attendance.view.academy", "attendance.export"],
  "/admin/rankings": ["rankings:read", "ranking.read.academy", "ranking.read.branch"],
  "/admin/rankings/weekly": ["rankings:read", "ranking.read.academy", "ranking.read.branch"],
  "/admin/rankings/monthly": ["rankings:read", "ranking.read.academy", "ranking.read.branch"],
  "/admin/payments": ["view_financial_reports", "payment.read.academy"],
  "/admin/payments/subscriptions": ["manage_subscriptions", "payment.read.academy"],
  "/admin/payments/invoices": ["manage_payments", "payment.read.academy"],
  "/admin/payments/reports": ["view_financial_reports", "payment.export", "payment.read.academy"],
  "/admin/notifications": ["access_admin_dashboard", "admin.dashboard.access"],
  "/admin/notifications/compose": ["access_admin_dashboard", "admin.dashboard.access"],
  "/admin/reports/s": ["view_financial_reports", "payment.export", "attendance.export"],
  "/admin/reports/player-progress": ["manage_players", "player.read.academy", "ranking.read.academy"],
  "/admin/reports/attendance": ["manage_attendance", "attendance.export", "attendance.view.academy"],
  "/admin/reports/coach": ["manage_coaches", "coach.read.academy"],
  "/admin/settings": ["manage_academy_settings", "admin.settings.update"],
  "/admin/settings/roles": ["manage_roles", "manage_permissions", "admin.role.manage"],
  "/admin/settings/integrations": ["manage_academy_settings", "admin.settings.update"],
};

const coachNavPermissions: Record<string, CoachPermission> = {
  "/coach/training/create": "can_create_training",
  "/coach/measurements": "can_record_measurements",
  "/coach/injury-risk-ai": "can_view_injury_risk",
  "/coach/matches/evaluation": "can_evaluate_players",
  "/coach/matches/configuration": "can_manage_matches",
};

export const hasAnyPermission = (
  granted: Set<string>,
  required: string[] | undefined,
) => !required?.length || required.some((permission) => granted.has(permission));

export function filterAdminNav(items: NavItem[], granted: Set<string>) {
  return items
    .map((item) => {
      const children = item.children?.filter((child) =>
        hasAnyPermission(granted, adminNavPermissions[child.href]),
      );
      return children ? { ...item, children } : item;
    })
    .filter((item) => {
      if (item.children) return item.children.length > 0;
      return hasAnyPermission(
        granted,
        item.href ? adminNavPermissions[item.href] : undefined,
      );
    });
}

export function firstNavHref(items: NavItem[]) {
  for (const item of items) {
    if (item.href) return item.href;
    const childHref = item.children?.find((child) => child.href)?.href;
    if (childHref) return childHref;
  }
  return null;
}

export function requiredAdminPermissions(pathname: string): string[] | null {
  const match = Object.entries(adminNavPermissions)
    .filter(([href]) => pathname === href || pathname.startsWith(`${href}/`))
    .sort(([left], [right]) => right.length - left.length)[0];
  return match?.[1] ?? null;
}

export function filterCoachNav(
  items: NavItem[],
  canUse: (permission: CoachPermission) => boolean,
) {
  return items
    .map((item) => {
      const children = item.children?.filter((child) => {
        const permission = coachNavPermissions[child.href];
        return !permission || canUse(permission);
      });
      return children ? { ...item, children } : item;
    })
    .filter((item) => {
      if (item.children) return item.children.length > 0;
      const permission = item.href ? coachNavPermissions[item.href] : undefined;
      return !permission || canUse(permission);
    });
}

export function requiredCoachPermission(pathname: string): CoachPermission | null {
  const match = Object.entries(coachNavPermissions)
    .filter(([href]) => pathname === href || pathname.startsWith(`${href}/`))
    .sort(([left], [right]) => right.length - left.length)[0];
  if (match) return match[1];
  if (pathname.startsWith("/coach/evaluations")) return "can_evaluate_players";
  return null;
}
