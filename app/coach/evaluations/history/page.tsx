"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useGetCoachEvaluationsQuery,
  type CoachEvaluation,
} from "@/lib/store/api/coachApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { formatDate } from "@/lib/utils";
import { Loader2, RefreshCw } from "lucide-react";

const columns: Column<CoachEvaluation>[] = [
  {
    key: "date",
    header: "Date",
    sortable: true,
    sortValue: (row) => row.date,
    accessor: (row) => formatDate(row.date),
  },
  {
    key: "playerName",
    header: "Player",
    sortable: true,
    sortValue: (row) => row.playerName,
    accessor: (row) => row.playerName,
  },
  {
    key: "groupName",
    header: "Group",
    sortable: true,
    sortValue: (row) => row.groupName ?? "",
    accessor: (row) => row.groupName ?? "Unassigned",
  },
  {
    key: "technicalScore",
    header: "Technical",
    accessor: (row) => <span className="font-semibold">{row.technicalScore}</span>,
  },
  {
    key: "tacticalScore",
    header: "Tactical",
    accessor: (row) => <span className="font-semibold">{row.tacticalScore}</span>,
  },
  {
    key: "physicalScore",
    header: "Physical",
    accessor: (row) => <span className="font-semibold">{row.physicalScore}</span>,
  },
  {
    key: "mentalScore",
    header: "Mental",
    accessor: (row) => <span className="font-semibold">{row.mentalScore}</span>,
  },
  {
    key: "overallScore",
    header: "Overall",
    sortable: true,
    sortValue: (row) => row.overallScore,
    accessor: (row) => {
      const score = row.overallScore;
      const color =
        score >= 8 ? "text-emerald-400" : score >= 6 ? "text-amber-400" : "text-red-400";
      return <span className={`text-lg font-bold ${color}`}>{score.toFixed(1)}</span>;
    },
  },
  {
    key: "notes",
    header: "Notes",
    accessor: (row) => (
      <span className="block max-w-[220px] truncate text-xs text-muted-foreground">
        {row.notes || "No notes"}
      </span>
    ),
  },
];

const historyCopy = {
  en: {
    title: "Evaluation History",
    description: "Past player evaluations",
    home: "Home",
    evaluations: "Evaluations",
    history: "History",
    loading: "Loading evaluations...",
    loadError: "Could not load evaluations.",
    retry: "Retry",
  },
  ar: {
    title: "تاريخ التقييمات",
    description: "تقييمات اللاعبين السابقة",
    home: "الرئيسية",
    evaluations: "التقييمات",
    history: "التاريخ",
    loading: "جاري تحميل التقييمات...",
    loadError: "تعذر تحميل التقييمات.",
    retry: "إعادة المحاولة",
  },
} as const;

export default function CoachEvaluationHistoryPage() {
  const language = useDashboardLanguage();
  const t = historyCopy[language];
  const { data, isLoading, isError, refetch } = useGetCoachEvaluationsQuery({
    limit: 100,
  });
  const evaluations = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.home, href: "/coach/home" },
          { label: t.evaluations },
          { label: t.history },
        ]}
      />

      {isLoading && (
        <Card className="border-border/50 bg-card">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loading}
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="flex items-center justify-between gap-3 p-4 text-sm text-red-300">
            <span>{t.loadError}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-1 h-4 w-4" />
              {t.retry}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && (
        <DataTable
          data={evaluations}
          columns={columns}
          searchKey={(row) => `${row.playerName} ${row.groupName ?? ""}`}
          searchPlaceholder="Search players..."
          emptyTitle="No evaluations yet"
          emptyDescription="Submitted player evaluations will appear here."
        />
      )}
    </div>
  );
}
