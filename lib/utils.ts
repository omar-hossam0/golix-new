import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-EG", {
    style: "currency",
    currency: "EGP",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(
  date: string | Date,
  locale = "en-US",
): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

const pad2 = (value: number) => String(value).padStart(2, "0");

export function localDatePart(value: string | Date): string {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
  }
  const raw = String(value || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
}

export function normalizeTime24(time: string | Date | null | undefined): string {
  if (!time) return "";
  if (time instanceof Date) {
    return `${pad2(time.getHours())}:${pad2(time.getMinutes())}`;
  }

  const raw = String(time).trim();
  if (raw.includes("T")) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
    }
  }

  const period = raw.match(/(AM|PM)\s*$/i)?.[1]?.toUpperCase();
  const clock = raw.replace(/\s*(?:AM|PM)+\s*$/i, "").trim();
  const match = clock.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return "";

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "";
  if (period === "AM" && hour === 12) hour = 0;
  if (period === "PM" && hour < 12) hour += 12;

  return `${pad2(hour)}:${pad2(minute)}`;
}

export function localDateTimeTimestamp(
  date: string | Date,
  time: string | Date | null | undefined,
): number {
  const normalizedTime = normalizeTime24(time);
  if (!normalizedTime) return 0;
  return Date.parse(`${localDatePart(date)}T${normalizedTime}:00`);
}

export function formatTime12(
  time: string | Date | null | undefined,
  locale = "en-US",
): string {
  if (!time) return "--";
  if (time instanceof Date || String(time).includes("T")) {
    const parsed = new Date(time);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(parsed);
    }
  }

  const normalizedTime = normalizeTime24(time);
  if (!normalizedTime) return String(time);
  const [hourValue = "0", minuteValue = "0"] = normalizedTime.split(":");
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return String(time);

  const syntheticDate = new Date(2000, 0, 1, hour, minute);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(syntheticDate);
}

export function formatDateTime(
  date: string | Date,
  locale = "en-US",
): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function calculatePercentage(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
}
