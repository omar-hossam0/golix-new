"use client";

import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetBirthYearByIdQuery } from "@/lib/store/api/adminApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { ArrowLeft, Users } from "lucide-react";

const birthYearDetailCopy = {
  en: {
    back: "Back",
    loadError: "Birth year details could not be loaded.",
    branchOverview: (branch: string) => `${branch} branch overview`,
    dashboard: "Dashboard",
    academy: "Academy",
    birthYears: "Birth Years",
    coaches: "Coaches",
    coachFallback: "Coach",
    noCoaches: "No coaches assigned to this branch.",
    groups: "Groups",
    noDescription: "No description",
    noGroups: "This birth year is not used in any group.",
    players: "Players",
    playersBorn: (from: number, to: number) => `Players born from ${from} to ${to}`,
    playersInBirthYear: "Players In This Birth Year",
    noBirthDate: "No birth date",
    noPlayers: "No players found for this birth year range.",
  },
  ar: {
    back: "رجوع",
    loadError: "تعذر تحميل تفاصيل سنة الميلاد.",
    branchOverview: (branch: string) => `نظرة على فرع ${branch}`,
    dashboard: "لوحة التحكم",
    academy: "الأكاديمية",
    birthYears: "سنوات الميلاد",
    coaches: "المدربون",
    coachFallback: "مدرب",
    noCoaches: "لا يوجد مدربون معينون لهذا الفرع.",
    groups: "المجموعات",
    noDescription: "لا يوجد وصف",
    noGroups: "سنة الميلاد هذه غير مستخدمة في أي مجموعة.",
    players: "اللاعبون",
    playersBorn: (from: number, to: number) => `لاعبون مواليد من ${from} إلى ${to}`,
    playersInBirthYear: "اللاعبون في سنة الميلاد هذه",
    noBirthDate: "لا يوجد تاريخ ميلاد",
    noPlayers: "لا يوجد لاعبون في نطاق سنة الميلاد هذا.",
  },
} as const;

export default function BirthYearDetailPage() {
  const language = useDashboardLanguage();
  const t = birthYearDetailCopy[language];
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const { data, isLoading, isError } = useGetBirthYearByIdQuery(id, { skip: !id });

  if (isLoading) return <LoadingSkeleton />;

  if (isError || !data) {
    return (
      <div className="space-y-4 p-6">
        <Button variant="outline" onClick={() => router.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t.back}
        </Button>
        <p className="text-sm text-muted-foreground">{t.loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={`${data.label} (${data.fromYear}-${data.toYear})`}
        description={t.branchOverview(data.branchName)}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.academy },
          { label: t.birthYears, href: "/admin/academy/birth-years" },
          { label: data.label },
        ]}
        actions={
          <Button variant="outline" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t.back}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>{t.coaches}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.coaches.length ? data.coaches.map((coach) => (
              <div key={coach.id} className="rounded-md border border-border p-3">
                <p className="font-medium">{coach.full_name}</p>
                <p className="text-xs text-muted-foreground">{coach.role ?? t.coachFallback} | {coach.email ?? coach.phone ?? ""}</p>
              </div>
            )) : <p className="text-sm text-muted-foreground">{t.noCoaches}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t.groups}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.groups.length ? data.groups.map((group) => (
              <div key={group.id} className="rounded-md border border-border p-3">
                <p className="font-medium">{group.name}</p>
                <p className="text-xs text-muted-foreground">{group.description ?? t.noDescription}</p>
              </div>
            )) : <p className="text-sm text-muted-foreground">{t.noGroups}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t.players}</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-2xl font-semibold">
              <Users className="h-5 w-5 text-primary" />
              {data.players.length}
            </div>
            <p className="text-sm text-muted-foreground">{t.playersBorn(data.fromYear, data.toYear)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>{t.playersInBirthYear}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.players.length ? data.players.map((player) => (
            <div key={player.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <div>
                <p className="font-medium">{player.full_name}</p>
                <p className="text-xs text-muted-foreground">#{player.player_code ?? player.id} | {player.date_of_birth ?? t.noBirthDate}</p>
              </div>
              {player.level && <Badge variant="secondary">{player.level}</Badge>}
            </div>
          )) : <p className="text-sm text-muted-foreground">{t.noPlayers}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
