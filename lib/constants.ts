export const ROLES = {
  ADMIN: "admin" as const,
  COACH: "coach" as const,
  PLAYER: "player" as const,
  PARENT: "parent" as const,
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  coach: "Coach",
  player: "Player",
  parent: "Parent",
};

export const ROLE_ROUTES: Record<string, string> = {
  admin: "/admin/dashboard",
  coach: "/coach/home",
  player: "/player/home",
  parent: "/parent/home",
};

export const PLAYER_LEVELS = {
  A: { label: "Level A", color: "emerald" },
  B: { label: "Level B", color: "amber" },
  C: { label: "Level C", color: "amber" },
  D: { label: "Level D", color: "orange" },
  F: { label: "Level F", color: "red" },
};

export const PAYMENT_STATUS_CONFIG = {
  paid: { label: "Paid", variant: "success" as const },
  pending: { label: "Pending", variant: "warning" as const },
  overdue: { label: "Overdue", variant: "destructive" as const },
  cancelled: { label: "Cancelled", variant: "secondary" as const },
};

export const ATTENDANCE_STATUS_CONFIG = {
  present: { label: "Present", color: "#7bea28" },
  absent: { label: "Absent", color: "#2d9ad5" },
  late: { label: "Late", color: "#b6ff00" },
  excused: { label: "Excused", color: "#2ee8c9" },
};

export const TREND_CONFIG = {
  improving: { label: "Improving", icon: "↑", color: "#7bea28" },
  stable: { label: "Stable", icon: "→", color: "#b6ff00" },
  declining: { label: "Declining", icon: "↓", color: "#2d9ad5" },
};

export const RANKING_WEIGHTS = {
  coachEvaluation: 0.35,
  attendance: 0.20,
  discipline: 0.15,
  matchPerformance: 0.20,
  aiScore: 0.10,
};

export const NAV_ITEMS = {
  admin: [
    { label: "Dashboard", href: "/admin/dashboard", icon: "LayoutDashboard" },
    { label: "Chats", href: "/admin/chat", icon: "MessageSquare" },
    { label: "Requests", href: "/admin/requests", icon: "Inbox" },
    {
      label: "Academy",
      icon: "GraduationCap",
      children: [
        { label: "Branches", href: "/admin/academy/branches" },
        { label: "Birth Years", href: "/admin/academy/birth-years" },
        { label: "Groups", href: "/admin/academy/groups" },
      ],
    },
    {
      label: "Coaches",
      icon: "Users",
      children: [
        { label: "All Coaches", href: "/admin/coaches" },
        { label: "Assign Coach", href: "/admin/coaches/assign" },
        { label: "Assignments", href: "/admin/coaches/assignments" },
      ],
    },
    { label: "Players", href: "/admin/players", icon: "UserCheck" },
    { label: "Parents", href: "/admin/parents", icon: "Users" },
    { label: "Calendar", href: "/admin/calendar", icon: "Calendar" },
    {
      label: "Matches",
      icon: "Trophy",
      children: [
        { label: "All Matches", href: "/admin/matches" },
        { label: "Archive", href: "/admin/matches/archive" },
      ],
    },
    { label: "Attendance", href: "/admin/attendance", icon: "ClipboardCheck" },
    {
      label: "Rankings",
      icon: "Trophy",
      children: [
        { label: "Overview", href: "/admin/rankings" },
        { label: "Weekly", href: "/admin/rankings/weekly" },
        { label: "Monthly", href: "/admin/rankings/monthly" },
      ],
    },
    {
      label: "Payments",
      icon: "CreditCard",
      children: [
        { label: "Overview", href: "/admin/payments" },
        { label: "Subscriptions", href: "/admin/payments/subscriptions" },
        { label: "Invoices", href: "/admin/payments/invoices" },
        { label: "Reports", href: "/admin/payments/reports" },
      ],
    },
    {
      label: "Notifications",
      icon: "Bell",
      children: [
        { label: "Center", href: "/admin/notifications" },
        { label: "Compose", href: "/admin/notifications/compose" },
      ],
    },
    {
      label: "Reports",
      icon: "BarChart3",
      children: [
        { label: "Overview", href: "/admin/reports/s" },
        { label: "Player Progress", href: "/admin/reports/player-progress" },
        { label: "Attendance", href: "/admin/reports/attendance" },
        { label: "Coach", href: "/admin/reports/coach" },
      ],
    },
    {
      label: "Settings",
      icon: "Settings",
      children: [
        { label: "Academy Profile", href: "/admin/settings" },
        { label: "Roles & Permissions", href: "/admin/settings/roles" },
        { label: "Integrations", href: "/admin/settings/integrations" },
      ],
    },
  ],
  coach: [
    { label: "Home", href: "/coach/home", icon: "Home" },
    { label: "Chats", href: "/coach/chat", icon: "MessageSquare" },
    { label: "Notifications", href: "/coach/notifications", icon: "Bell" },
    { label: "Players", href: "/coach/players", icon: "Users" },
    { label: "Parents", href: "/coach/parents", icon: "Users" },
    { label: "Birthdays", href: "/coach/birthdays", icon: "Cake" },
    { label: "Calendar", href: "/coach/calendar", icon: "Calendar" },
    { label: "My Groups", href: "/coach/my-groups", icon: "Users" },
    { label: "Ranking System", href: "/coach/ranking-system", icon: "Star" },
    { label: "Measurements", href: "/coach/measurements", icon: "Ruler" },
    { label: "Injury Risk AI", href: "/coach/injury-risk-ai", icon: "BrainCircuit" },
    { label: "Assignments", href: "/coach/assignments", icon: "ClipboardCheck" },
    {
      label: "Training",
      icon: "Dumbbell",
      children: [
        { label: "All Training", href: "/coach/training" },
        { label: "Create Training", href: "/coach/training/create" },
      ],
    },
    {
      label: "Matches",
      icon: "Trophy",
      children: [
        { label: "All Matches", href: "/coach/matches" },
        { label: "Match Evaluations", href: "/coach/matches/evaluation" },
        { label: "Archive", href: "/coach/matches/archive" },
        { label: "Configuration", href: "/coach/matches/configuration" },
      ],
    },
    { label: "Rankings", href: "/coach/rankings", icon: "Trophy" },
    { label: "Settings", href: "/coach/settings", icon: "Settings" },
  ],
  player: [
    { label: "Home", href: "/player/home", icon: "Home" },
    { label: "Chats", href: "/player/chat", icon: "MessageSquare" },
    { label: "Notifications", href: "/player/notifications", icon: "Bell" },
    { label: "Calendar", href: "/player/calendar", icon: "Calendar" },
    { label: "Matches", href: "/player/matches", icon: "Trophy" },
    { label: "Assignments", href: "/player/assignments", icon: "ClipboardCheck" },
    {
      label: "Profile",
      icon: "User",
      children: [
        { label: "Overview", href: "/player/profile" },
        { label: "Measurements", href: "/player/profile/measurements" },
      ],
    },
    {
      label: "Performance",
      icon: "TrendingUp",
      children: [
        { label: "Ranking", href: "/player/performance/ranking" },
        { label: "Progress Chart", href: "/player/performance/progress" },
      ],
    },
    {
      label: "Training",
      icon: "Dumbbell",
      children: [
        { label: "My Plan", href: "/player/training" },
        { label: "History", href: "/player/training/history" },
      ],
    },
    { label: "Attendance", href: "/player/attendance", icon: "ClipboardCheck" },
    { label: "Settings", href: "/player/settings", icon: "Settings" },
  ],
  parent: [
    { label: "Home", href: "/parent/home", icon: "Home" },
    { label: "Chats", href: "/parent/chat", icon: "MessageSquare" },
    { label: "Matches", href: "/parent/matches", icon: "Trophy" },
    {
      label: "Child",
      icon: "Baby",
      children: [
        { label: "Performance", href: "/parent/child/performance" },
        { label: "Ranking", href: "/parent/child/ranking" },
        { label: "Attendance", href: "/parent/child/attendance" },
        { label: "Measurements", href: "/parent/child/measurements" },
      ],
    },
    {
      label: "Payments",
      icon: "CreditCard",
      children: [
        { label: "Status", href: "/parent/payments" },
        { label: "History", href: "/parent/payments/history" },
        { label: "Pay Now", href: "/parent/payments/pay" },
      ],
    },
    { label: "Notifications", href: "/parent/notifications", icon: "Bell" },
    { label: "Schedule", href: "/parent/schedule", icon: "Calendar" },
  ],
};
