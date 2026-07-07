"use client";

import { Activity, Footprints, Loader2, Ruler, Scale, UserCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ParentChildTabs } from "@/components/parent/ParentChildTabs";
import { ParentDataError } from "@/components/parent/ParentDataError";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { useParentSelectedChild } from "@/lib/hooks/useParentSelectedChild";
import { useGetParentChildMeasurementsQuery } from "@/lib/store/api/calendarApi";
import { formatDate } from "@/lib/utils";

const copy = {
  en: {
    title: "Child Measurements",
    description: (name?: string | null) =>
      name ? `${name}'s current academy profile measurements` : "Physical profile for your linked player.",
    home: "Home",
    child: "Child",
    measurements: "Measurements",
    noChild: "No linked child found for this parent account.",
    selectChild: "Select a child",
    noProgressAccess: "Progress access is not enabled for this child.",
    noProgressAccessBody: "Measurements are part of the performance profile controlled by the coach or academy admin.",
    loading: "Loading measurements...",
    loadError: "Measurements could not be loaded",
    loadErrorBody: "Check your connection, then try loading the measurements again.",
    retry: "Try again",
    height: "Height",
    weight: "Weight",
    bmi: "BMI",
    preferredFoot: "Preferred Foot",
    profile: "Profile",
    history: "Measurement History",
    measuredAt: "Measured at",
    speed: "Speed",
    endurance: "Endurance",
    flexibility: "Flexibility",
    noHistory: "No measurement history has been recorded yet.",
    left: "Left",
    right: "Right",
    both: "Both",
    complete: "Complete",
    incomplete: "Incomplete",
    unknown: "Not specified",
  },
  ar: {
    title: "قياسات اللاعب",
    description: (name?: string | null) =>
      name ? `القياسات الحالية لملف ${name}` : "الملف البدني للاعب المرتبط بحسابك.",
    home: "الرئيسية",
    child: "اللاعب",
    measurements: "القياسات",
    noChild: "لا يوجد لاعب مرتبط بحساب ولي الأمر.",
    selectChild: "اختر اللاعب",
    noProgressAccess: "صلاحية عرض التقدم غير مفعلة لهذا اللاعب.",
    noProgressAccessBody: "القياسات جزء من ملف الأداء الذي يتحكم المدرب أو إدارة الأكاديمية في ظهوره.",
    loading: "جاري تحميل القياسات...",
    loadError: "تعذر تحميل القياسات",
    loadErrorBody: "تحقق من الاتصال ثم حاول تحميل القياسات مرة أخرى.",
    retry: "إعادة المحاولة",
    height: "الطول",
    weight: "الوزن",
    bmi: "مؤشر الكتلة",
    preferredFoot: "القدم المفضلة",
    profile: "الملف",
    history: "سجل القياسات",
    measuredAt: "وقت القياس",
    speed: "السرعة",
    endurance: "التحمل",
    flexibility: "المرونة",
    noHistory: "لم يتم تسجيل قياسات بعد.",
    left: "اليسرى",
    right: "اليمنى",
    both: "كلتاهما",
    complete: "مكتمل",
    incomplete: "غير مكتمل",
    unknown: "غير محدد",
  },
} as const;

export default function ParentChildMeasurementsPage() {
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
    data: measurementsData,
    isLoading: measurementsLoading,
    isError: measurementsError,
    refetch: refetchMeasurements,
  } =
    useGetParentChildMeasurementsQuery(
      { childId, limit: 100 },
      { skip: !childId || !canViewProgress },
    );
  const measurements = measurementsData?.data ?? [];
  const latestMeasurement = measurements[0];
  const isLoading = childrenLoading || measurementsLoading;
  const isError = childrenError || (canViewProgress && measurementsError);

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title={t.title}
        description={t.description(child?.full_name)}
        breadcrumbs={[
          { label: t.home, href: "/parent/home" },
          { label: t.child },
          { label: t.measurements },
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
            if (childId && canViewProgress) refetchMeasurements();
          }}
        />
      ) : isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loading}
          </CardContent>
        </Card>
      ) : !child ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {t.noChild}
          </CardContent>
        </Card>
      ) : !canViewProgress ? (
        <Card className="border-border/50 bg-card">
          <CardContent className="p-8 text-center">
            <Activity className="mx-auto h-12 w-12 text-primary" />
            <h2 className="mt-4 text-xl font-black text-foreground">{t.noProgressAccess}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-muted-foreground">
              {t.noProgressAccessBody}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: t.height, value: latestMeasurement?.height_cm ? `${latestMeasurement.height_cm} cm` : "-", Icon: Ruler, color: "text-primary" },
              { label: t.weight, value: latestMeasurement?.weight_kg ? `${latestMeasurement.weight_kg} kg` : "-", Icon: Scale, color: "text-accent" },
              { label: t.bmi, value: latestMeasurement?.bmi ?? "-", Icon: Activity, color: "text-lime-400" },
              {
                label: t.preferredFoot,
                value: t[child.preferred_foot as "left" | "right" | "both"] || t.unknown,
                Icon: Footprints,
                color: "text-amber-400",
              },
              {
                label: t.profile,
                value: t[child.profile_status as "complete" | "incomplete"] || t.unknown,
                Icon: UserCheck,
                color: "text-cyan-300",
              },
            ].map(({ label, value, Icon, color }) => (
              <Card key={label} className="border-border/50 bg-card">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </div>
                  <Icon className={`h-7 w-7 ${color}`} />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{t.history}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {measurements.map((measurement) => (
                <div
                  key={measurement.id}
                  className="grid gap-3 rounded-lg border border-border/30 bg-muted/20 p-4 sm:grid-cols-7"
                >
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">{t.measuredAt}</p>
                    <p className="font-semibold">{formatDate(measurement.measured_at, locale)}</p>
                  </div>
                  {[
                    [t.height, measurement.height_cm ? `${measurement.height_cm} cm` : "-"],
                    [t.weight, measurement.weight_kg ? `${measurement.weight_kg} kg` : "-"],
                    [t.speed, measurement.sprint_speed ? `${measurement.sprint_speed}` : "-"],
                    [t.endurance, measurement.stamina ?? "-"],
                    [t.flexibility, measurement.flexibility ?? "-"],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-semibold">{value}</p>
                    </div>
                  ))}
                  {measurement.notes && (
                    <p className="sm:col-span-6 text-sm text-muted-foreground">
                      {measurement.notes}
                    </p>
                  )}
                </div>
              ))}
              {!measurements.length && (
                <div className="rounded-lg border border-dashed border-border/40 p-8 text-center text-muted-foreground">
                  {t.noHistory}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
