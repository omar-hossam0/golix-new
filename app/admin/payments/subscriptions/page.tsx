"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { RefreshCw } from "lucide-react";
import { useGetSubscriptionsQuery, type Subscription } from "@/lib/store/api/adminApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  active: "success",
  paid: "success",
  pending: "warning",
  overdue: "destructive",
  expired: "secondary",
  cancelled: "destructive",
};

const copy = {
  en: {
    loadError: "Failed to load subscriptions.",
    retry: "Retry",
    id: "ID",
    plan: "Plan",
    amount: "Amount",
    period: "Period",
    status: "Status",
    subscriptions: "Subscriptions",
    description: "Manage all active subscriptions and renewal dates.",
    dashboard: "Dashboard",
    payments: "Payments",
    search: "Search subscriptions...",
  },
  ar: {
    loadError: "تعذر تحميل الاشتراكات.",
    retry: "إعادة المحاولة",
    id: "المعرف",
    plan: "الخطة",
    amount: "المبلغ",
    period: "الفترة",
    status: "الحالة",
    subscriptions: "الاشتراكات",
    description: "إدارة كل الاشتراكات النشطة وتواريخ التجديد.",
    dashboard: "الرئيسية",
    payments: "المدفوعات",
    search: "ابحث في الاشتراكات...",
  },
} as const;

const statusLabels = {
  en: {
    active: "Active",
    paid: "Paid",
    pending: "Pending",
    overdue: "Overdue",
    expired: "Expired",
    cancelled: "Cancelled",
  },
  ar: {
    active: "نشط",
    paid: "مدفوع",
    pending: "معلق",
    overdue: "متأخر",
    expired: "منتهي",
    cancelled: "ملغي",
  },
} as const;

export default function SubscriptionsPage() {
  const language = useDashboardLanguage();
  const t = copy[language];
  const { data, isLoading, isError, refetch } = useGetSubscriptionsQuery({ limit: 50 });

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">{t.loadError}</p>
        <Button variant="outline" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-4 w-4" />
          {t.retry}
        </Button>
      </div>
    );
  }

  const subscriptions = data?.data ?? [];
  const columns: Column<Subscription>[] = [
    {
      key: "id",
      header: t.id,
      accessor: (row) => (
        <span className="font-mono text-xs text-primary">{row.id.slice(0, 8).toUpperCase()}</span>
      ),
    },
    {
      key: "plan",
      header: t.plan,
      accessor: (row) => (
        <Badge variant="outline" className="capitalize">{row.plan_id}</Badge>
      ),
      sortable: true,
      sortValue: (row) => row.plan_id,
    },
    {
      key: "amount",
      header: t.amount,
      accessor: (row) => (
        <span className="font-semibold">{formatCurrency(parseFloat(row.amount))}</span>
      ),
      sortable: true,
      sortValue: (row) => parseFloat(row.amount),
    },
    {
      key: "period",
      header: t.period,
      accessor: (row) => (
        <span className="text-xs text-muted-foreground">
          {formatDate(row.starts_at)} - {formatDate(row.ends_at)}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.starts_at,
    },
    {
      key: "status",
      header: t.status,
      accessor: (row) => (
        <Badge variant={STATUS_VARIANT[row.status] ?? "secondary"} className="capitalize">
          {statusLabels[language][row.status as keyof typeof statusLabels.en] ?? row.status}
        </Badge>
      ),
      sortable: true,
      sortValue: (row) => row.status,
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={`${t.subscriptions} (${data?.pagination?.total ?? subscriptions.length})`}
        description={t.description}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.payments },
          { label: t.subscriptions },
        ]}
      />

      <DataTable
        data={subscriptions}
        columns={columns}
        searchable
        searchPlaceholder={t.search}
        searchKey={(row) => `${row.id} ${row.plan_id} ${row.status}`}
      />
    </div>
  );
}
