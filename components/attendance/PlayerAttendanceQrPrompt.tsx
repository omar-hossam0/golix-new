"use client";

import Image from "next/image";
import { BellRing, CheckCircle2, Clock, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { PlayerAttendanceQr } from "@/lib/store/api/calendarApi";
import { cn, formatTime12 } from "@/lib/utils";

type AttendanceStatus = string | null | undefined;

type PlayerAttendanceQrPromptProps = {
  kind: "match" | "training";
  title: string;
  startsAt: string;
  qr?: PlayerAttendanceQr;
  attendanceStatus?: AttendanceStatus;
  className?: string;
};

const attendedStatuses = new Set(["present", "late"]);

const titleCase = (value: string | null | undefined) =>
  (value || "not marked")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export function PlayerAttendanceQrPrompt({
  kind,
  title,
  startsAt,
  qr,
  attendanceStatus,
  className,
}: PlayerAttendanceQrPromptProps) {
  const attended = attendedStatuses.has(String(attendanceStatus || ""));

  return (
    <Card
      className={cn(
        "overflow-hidden border-cyan-300/20 bg-cyan-400/[0.07] shadow-none",
        attended && "border-emerald-300/35 bg-emerald-400/[0.08]",
        className,
      )}
    >
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={attended ? "success" : "info"}
              className="gap-1.5"
            >
              {attended ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <BellRing className="h-3.5 w-3.5" />
              )}
              {attended ? "Attendance recorded" : "QR ready"}
            </Badge>
            <Badge variant="outline">{kind === "match" ? "Match" : "Training"}</Badge>
          </div>

          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-300">
              <Clock className="h-4 w-4 text-cyan-200" />
              Starts at {formatTime12(startsAt)}
            </p>
          </div>

          {attended ? (
            <div className="relative overflow-hidden rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
              <span className="absolute right-4 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full bg-emerald-300/20 animate-ping" />
              <span className="relative flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                You are checked in. Status: {titleCase(attendanceStatus)}
              </span>
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-300">
              Show this fixed player QR to the coach scanner for fast attendance.
            </p>
          )}
        </div>

        <div
          className={cn(
            "mx-auto flex w-full max-w-64 flex-col items-center gap-2 rounded-xl border border-white/10 bg-white p-4 text-slate-900 lg:w-64",
            attended && "ring-2 ring-emerald-300/70",
          )}
        >
          {qr?.qrCodeDataUrl ? (
            <Image
              src={qr.qrCodeDataUrl}
              alt="Attendance QR"
              width={240}
              height={240}
              unoptimized
              className="aspect-square w-full object-contain"
            />
          ) : (
            <div className="grid aspect-square w-full place-items-center rounded-lg bg-slate-100 text-slate-400">
              <QrCode className="h-12 w-12" />
            </div>
          )}
          <span className="max-w-full truncate text-xs font-semibold">
            {qr?.playerCode || "Loading QR..."}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
