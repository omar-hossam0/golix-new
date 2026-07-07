"use client";

import { CalendarClock, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ParentChildTabs } from "@/components/parent/ParentChildTabs";
import { ParentDataError } from "@/components/parent/ParentDataError";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { useParentSelectedChild } from "@/lib/hooks/useParentSelectedChild";
import { useGetParentChildMatchesQuery } from "@/lib/store/api/calendarApi";
import { formatDate, formatTime12 } from "@/lib/utils";

const copy = {
  en: {
    title: "Child Matches",
    description: "Upcoming matches, squad selection, and post-match stats.",
    home: "Home",
    matches: "Matches",
    noChild: "No linked child found for this parent account.",
    selectChild: "Select a child",
    loading: "Loading matches...",
    loadError: "Matches could not be loaded",
    loadErrorBody: "Check your connection, then try loading the matches again.",
    retry: "Try again",
    noMatches: "No matches yet.",
    notSelected: "Not selected yet",
    minutes: "Minutes",
    goals: "Goals",
    assists: "Assists",
    statsHidden: "Stats are hidden until the coach enables progress access.",
    starter: "Starter",
    substitute: "Substitute",
    reserve: "Reserve",
    unknownRole: "Squad member",
  },
  ar: {
    title: "مباريات اللاعب",
    description: "المباريات القادمة، اختيار القائمة، وإحصائيات ما بعد المباراة.",
    home: "الرئيسية",
    matches: "المباريات",
    noChild: "لا يوجد لاعب مرتبط بحساب ولي الأمر.",
    selectChild: "اختر اللاعب",
    loading: "جاري تحميل المباريات...",
    loadError: "تعذر تحميل المباريات",
    loadErrorBody: "تحقق من الاتصال ثم حاول تحميل المباريات مرة أخرى.",
    retry: "إعادة المحاولة",
    noMatches: "لا توجد مباريات حتى الآن.",
    notSelected: "لم يتم اختياره بعد",
    minutes: "الدقائق",
    goals: "الأهداف",
    assists: "التمريرات",
    statsHidden: "الإحصائيات مخفية حتى يفعّل المدرب صلاحية التقدم.",
    starter: "أساسي",
    substitute: "بديل",
    reserve: "احتياطي",
    unknownRole: "ضمن القائمة",
  },
} as const;

function squadRoleLabel(role: string, language: keyof typeof copy) {
  const labels = copy[language];
  return labels[role as "starter" | "substitute" | "reserve"] || labels.unknownRole;
}

export default function ParentMatchesPage() {
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
    data,
    isLoading: matchesLoading,
    isError: matchesError,
    refetch: refetchMatches,
  } = useGetParentChildMatchesQuery(childId, { skip: !childId });
  const matches = data?.data ?? [];
  const isLoading = childrenLoading || matchesLoading;
  const isError = childrenError || matchesError;

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.home, href: "/parent/home" },
          { label: t.matches },
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
            if (childId) refetchMatches();
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
        <div className="space-y-3">
          {matches.map((match) => {
            const squad = match.squad?.[0];
            const stats = match.stats?.[0];
            return (
              <Card key={match.id} className="border-border/50 bg-card">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-primary/10 p-2 text-primary">
                        <CalendarClock className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{match.opponent_name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatDate(match.match_date, locale)} · {formatTime12(match.match_time, locale)} · {match.location || "-"}
                        </p>
                      </div>
                    </div>
                    <Badge variant={squad ? "success" : "secondary"}>
                      {squad ? squadRoleLabel(squad.squad_role, language) : t.notSelected}
                    </Badge>
                  </div>

                  {stats ? (
                    <div className="mt-4 grid grid-cols-3 gap-3 rounded-md bg-muted/20 p-3 text-center text-sm">
                      <div>
                        <p className="font-semibold">{stats.minutes_played}</p>
                        <p className="text-xs text-muted-foreground">{t.minutes}</p>
                      </div>
                      <div>
                        <p className="font-semibold">{stats.goals}</p>
                        <p className="text-xs text-muted-foreground">{t.goals}</p>
                      </div>
                      <div>
                        <p className="font-semibold">{stats.assists}</p>
                        <p className="text-xs text-muted-foreground">{t.assists}</p>
                      </div>
                    </div>
                  ) : !canViewProgress ? (
                    <div className="mt-4 rounded-md border border-border/30 bg-muted/20 p-3 text-sm font-semibold text-muted-foreground">
                      {t.statsHidden}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}

          {!matches.length && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {t.noMatches}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
