"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface DashboardBrandProps {
  href: string;
  collapsed?: boolean;
  subtitle?: string;
  className?: string;
}

export function DashboardBrand({
  href,
  collapsed = false,
  subtitle,
  className,
}: DashboardBrandProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-w-0 transition-opacity hover:opacity-95",
        collapsed ? "items-center justify-center" : "flex-col items-start gap-1.5",
        className
      )}
      aria-label="Goalix"
    >
      <div
        className={cn(
          "relative shrink-0 overflow-hidden",
          collapsed ? "h-12 w-12" : "h-[78px] w-[210px]"
        )}
      >
        <Image
          src="/Logo.png"
          alt="Goalix"
          fill
          sizes={collapsed ? "48px" : "210px"}
          className={cn(
            "transition-transform duration-300 group-hover:scale-[1.02]",
            collapsed ? "object-cover object-left" : "object-contain object-left"
          )}
          priority
        />
      </div>
      {subtitle && !collapsed && (
        <span className="pl-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80">
          {subtitle}
        </span>
      )}
    </Link>
  );
}