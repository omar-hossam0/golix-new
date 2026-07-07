"use client";

import { useMemo } from "react";
import { Calendar, CalendarCheck, Clock, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DoughnutChart } from "@/components/charts/DoughnutChart";
import { ParentChildTabs } from "@/components/parent/ParentChildTabs";
import { ParentDataError } from "@/components/parent/ParentDataError";
import {
  useGetParentChildAttendanceQuery,
  useGetParentChildProgressQuery,
} from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { useParentSelectedChild } from "@/lib/hooks/useParentSelectedChild";
import { formatDate, formatTime12 } from "@/lib/utils";

const copy = {
  en: {
    title: "Child Attendance",
    description: (name?: string | null) =>
      name ? `${name}'s attendance record` : "Attendance record for your linked player.",
    home: "Home",
    child: "Child",
    attendance: "Attendance",
    noChild: "No linked child found for this parent account.",
    selectChild: "Select a child",
    loading: "Loading attendance...",
    loadError: "Attendance could not be loaded",
    loadErrorBody: "Check your connection, then try loading attendance again.",
    retry: "Try again",
    rate: "Rate",
    present: "Present",
    absent: "Absent",
    late: "Late",
    excused: "Excused",
    breakdown: "Breakdown",
    records: "Records",
    noRecords: "No attendance records yet.",
    training: "Training",
    match: "Match",
    activity: "Academy activity",
    unknownStatus: "Unknown status",
  },
  ar: {
    title: "حضور اللاعب",
    description: (name?: string | null) =>
      name ? `سجل حضور ${name}` : "سجل الحضور للاعب المرتبط بحسابك.",
    home: "الرئيسية",
    child: "اللاعب",
    attendance: "الحضور",
    noChild: "لا يوجد لاعب مرتبط بحساب ولي الأمر.",
    selectChild: "اختر اللاعب",
    loading: "جاري تحميل الحضور...",
    loadError: "تعذر تحميل الحضور",
    loadErrorBody: "تحقق من الاتصال ثم حاول تحميل سجل الحضور مرة أخرى.",
    retry: "إعادة المحاولة",
    rate: "النسبة",
    present: "حاضر",
    absent: "غائب",
    late: "متأخر",
    excused: "بعذر",
    breakdown: "حالة الحضور",
    records: "السجلات",
    noRecords: "لا توجد سجلات حضور حتى الآن.",
    training: "تدريب",
    match: "مباراة",
    activity: "نشاط بالأكاديمية",
    unknownStatus: "حالة غير محددة",
  },
} as const;

const statusTone: Record<string, string> = {
  present: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  late: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  absent: "bg-red-500/10 text-red-400 border-red-500/20",
  excused: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
};

export default function ParentChildAttendancePage() {
  const language = useDashboardLanguage();
  const t = copy[language];
  const locale = language === "ar" ? "ar-EG" : "en-US";
  const {
    children,
    selectedChildId: childId,
    setSelectedChildId: setChildId,
    isLoading: childrenLoading,
    isError: childrenError,
    refetch: refetchChildren,
  } = useParentSelectedChild();

  const child = children.find((item) => item.id === childId);
  const canViewProgress = child?.can_view_progress !== false;
  const {
    data: progress,
    isLoading: progressLoading,
    isError: progressError,
    refetch: refetchProgress,
  } = useGetParentChildProgressQuery(childId, {
    skip: !childId || !canViewProgress,
  });
  const {
    data,
    isLoading: attendanceLoading,
    isError: attendanceError,
    refetch: refetchAttendance,
  } = useGetParentChildAttendanceQuery(
    { childId, limit: 100 },
    { skip: !childId },
  );
  const records = useMemo(() => data?.data ?? [], [data?.data]);

  const statusCounts = useMemo(
    () => ({
      present: records.filter((record) => record.status === "present").length,
      absent: records.filter((record) => record.status === "absent").length,
      late: records.filter((record) => record.status === "late").length,
      excused: records.filter((record) => record.status === "excused").length,
    }),
    [records],
  );

  const chartData = (["present", "late", "absent", "excused"] as const).map(
    (key) => ({
      label: t[key],
      value: statusCounts[key] || 0,
    }),
  );
  const isLoading =
    childrenLoading || attendanceLoading || (canViewProgress && progressLoading);
  const isError =
    childrenError || attendanceError || (canViewProgress && progressError);

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title={t.title}
        description={t.description(child?.full_name)}
        breadcrumbs={[
          { label: t.home, href: "/parent/home" },
          { label: t.child },
          { label: t.attendance },
        ]}
      />

      <ParentChildTabs
        items={children}
        selectedChildId={childId}
        onSelect={setChildId}
        ariaLabel={t.selectChild}
      />

      {isError ? (
        <ParentDataError
          title={t.loadError}
          description={t.loadErrorBody}
          retryLabel={t.retry}
          onRetry={() => {
            refetchChildren();
            if (childId) {
              refetchAttendance();
              if (canViewProgress) refetchProgress();
            }
          }}
        />
      ) : !childId && !childrenLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {t.noChild}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loading}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            {[
              { label: t.rate, value: canViewProgress ? `${progress?.attendancePercentage ?? 0}%` : "-", color: "text-primary" },
              { label: t.present, value: statusCounts.present, color: "text-emerald-400" },
              { label: t.absent, value: statusCounts.absent, color: "text-red-400" },
              { label: t.late, value: statusCounts.late, color: "text-amber-400" },
            ].map((stat) => (
              <Card key={stat.label} className="border-border/50 bg-card">
                <CardContent className="p-4 text-center">
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="border-border/50 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">{t.breakdown}</CardTitle>
              </CardHeader>
              <CardContent>
                <DoughnutChart
                  labels={chartData.map((d) => d.label)}
                  data={chartData.map((d) => d.value)}
                  height={250}
                />
              </CardContent>
            </Card>

            <div className="lg:col-span-2">
              <Card className="border-border/50 bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">{t.records}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {records.map((record) => {
                    const dateValue =
                      record.start_datetime ||
                      record.match_date ||
                      new Date().toISOString();
                    const timeValue =
                      record.start_datetime ||
                      record.match_time ||
                      dateValue;
                    return (
                      <div
                        key={record.id}
                        className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/20 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <CalendarCheck className="h-5 w-5 text-primary" />
                          <div>
                            <p className="text-sm font-medium">
                              {record.title ||
                                record.opponent_name ||
                                t[record.record_type as "training" | "match"] ||
                                t.activity}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {formatDate(dateValue, locale)}
                              <Clock className="h-3 w-3" />
                              {formatTime12(timeValue, locale)}
                            </div>
                            {record.notes && (
                              <p className="text-xs text-muted-foreground">{record.notes}</p>
                            )}
                          </div>
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${
                            statusTone[record.status] || "border-border/30 bg-muted/20 text-muted-foreground"
                          }`}
                        >
                          {t[record.status as "present" | "late" | "absent" | "excused"] || t.unknownStatus}
                        </span>
                      </div>
                    );
                  })}
                  {!records.length && (
                    <div className="rounded-lg border border-dashed border-border/40 p-8 text-center text-muted-foreground">
                      {t.noRecords}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
