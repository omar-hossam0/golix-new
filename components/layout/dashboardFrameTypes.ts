export type DashboardLanguage = "en" | "ar";
export type DashboardTheme = "light" | "dark";
export type DashboardDensity = "comfortable" | "compact";
export type DashboardMotion = "full" | "reduced";
export type DashboardFocus = "off" | "on";

export type NavItem = {
  label: string;
  href?: string;
  icon?: string;
  children?: { label: string; href: string }[];
};
