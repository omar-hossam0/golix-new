"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { StatsCard } from "@/components/shared/StatsCard";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useGetBranchByIdQuery,
  useGetGroupsQuery,
  type Group,
} from "@/lib/store/api/adminApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { Edit, Plus } from "lucide-react";

const branchCopy = {
  en: {
    branchNotFound: "Branch not found.",
    dashboard: "Dashboard",
    academy: "Academy",
    branches: "Branches",
    editBranch: "Edit Branch",
    capacity: "Capacity",
    groups: "Groups",
    status: "Status",
    city: "City",
    active: "Active",
    inactive: "Inactive",
    group: "Group",
    birthYear: "Birth Year",
    noBirthYear: "No birth year",
    maxPlayers: "Max Players",
    addGroup: "Add Group",
  },
  ar: {
    branchNotFound: "الفرع غير موجود.",
    dashboard: "لوحة التحكم",
    academy: "الأكاديمية",
    branches: "الفروع",
    editBranch: "تعديل الفرع",
    capacity: "السعة",
    groups: "المجموعات",
    status: "الحالة",
    city: "المدينة",
    active: "نشط",
    inactive: "غير نشط",
    group: "المجموعة",
    birthYear: "سنة الميلاد",
    noBirthYear: "لا توجد سنة ميلاد",
    maxPlayers: "الحد الأقصى للاعبين",
    addGroup: "إضافة مجموعة",
  },
} as const;

export default function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const language = useDashboardLanguage();
  const t = branchCopy[language];
  const { data: branch, isLoading, error } = useGetBranchByIdQuery(id);
  const { data: groups } = useGetGroupsQuery({ branchId: id });
  const groupColumns: Column<Group>[] = [
    {
      key: "name",
      header: t.group,
      accessor: (row) => <span className="font-medium">{row.name}</span>,
      sortable: true,
      sortValue: (row) => row.name,
    },
    {
      key: "birthYear",
      header: t.birthYear,
      accessor: (row) => row.birth_year ?? t.noBirthYear,
      sortable: true,
      sortValue: (row) => row.birth_year ?? 0,
    },
    {
      key: "players",
      header: t.maxPlayers,
      accessor: (row) => row.max_players ?? "\u2014",
      sortable: true,
      sortValue: (row) => row.max_players ?? 0,
    },
    {
      key: "status",
      header: t.status,
      accessor: (row) => (
        <Badge variant={row.is_active ? "success" : "secondary"}>
          {row.is_active ? t.active : t.inactive}
        </Badge>
      ),
    },
  ];

  if (isLoading) return <LoadingSkeleton />;
  if (error || !branch) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">{t.branchNotFound}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={branch.name}
        description={branch.address ?? ""}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.academy },
          { label: t.branches, href: "/admin/academy/branches" },
          { label: branch.name },
        ]}
        actions={
          <Button variant="outline" className="gap-1.5">
            <Edit className="h-4 w-4" />
            {t.editBranch}
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label={t.capacity} value={branch.capacity ?? "\u2014"} icon="Layers" />
        <StatsCard label={t.groups} value={groups?.length ?? 0} icon="Layers" />
        <StatsCard label={t.status} value={branch.is_active ? t.active : t.inactive} icon="UserCheck" />
        <StatsCard label={t.city} value={branch.city ?? "\u2014"} icon="MapPin" />
      </div>
      <Card className="border-border/50 bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">{t.groups}</CardTitle>
          <Button size="sm" className="gap-1.5" onClick={() => router.push("/admin/academy/groups")}>
            <Plus className="h-3.5 w-3.5" />
            {t.addGroup}
          </Button>
        </CardHeader>
        <CardContent>
          <DataTable data={groups ?? []} columns={groupColumns} searchable={false} pageSize={10} />
        </CardContent>
      </Card>
    </div>
  );
}
