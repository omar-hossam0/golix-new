"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { StatsCard } from "@/components/shared/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DoughnutChart } from "@/components/charts/DoughnutChart";
import { Button } from "@/components/ui/button";
import {
  useGetPaymentOverviewQuery,
  useGetSubscriptionsQuery,
} from "@/lib/store/api/adminApi";
import { formatCurrency } from "@/lib/utils";
import { FileDown } from "lucide-react";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";

const copy = {
  en: {
    title: "Financial Reports",
    description: "Detailed financial analytics and reports.",
    dashboard: "Dashboard",
    payments: "Payments",
    reports: "Reports",
    exportFull: "Export Full Report",
    totalRevenue: "Total Revenue (Collected)",
    avgPerPlayer: "Avg per Player",
    totalSubscriptions: "Total Subscriptions",
    statusDistribution: "Payment Status Distribution",
    noPaymentData: "No payment data.",
    revenueByStatus: "Revenue by Status",
    subscriptions: "subscriptions",
  },
  ar: {
    title: "التقارير المالية",
    description: "تحليلات وتقارير مالية تفصيلية.",
    dashboard: "الرئيسية",
    payments: "المدفوعات",
    reports: "التقارير",
    exportFull: "تصدير التقرير الكامل",
    totalRevenue: "إجمالي الإيرادات المحصلة",
    avgPerPlayer: "متوسط كل لاعب",
    totalSubscriptions: "إجمالي الاشتراكات",
    statusDistribution: "توزيع حالات الدفع",
    noPaymentData: "لا توجد بيانات مدفوعات.",
    revenueByStatus: "الإيرادات حسب الحالة",
    subscriptions: "اشتراكات",
  },
} as const;

const statusLabel = (status: string, language: keyof typeof copy) => {
  const labels = {
    en: { paid: "Paid", pending: "Pending", overdue: "Overdue", cancelled: "Cancelled" },
    ar: { paid: "مدفوع", pending: "معلق", overdue: "متأخر", cancelled: "ملغي" },
  } as const;
  return labels[language][status as keyof typeof labels.en] ?? status;
};

export default function PaymentReportsPage() {
  const language = useDashboardLanguage();
  const t = copy[language];
  const { data: overview, isLoading: loadingOverview } = useGetPaymentOverviewQuery();
  const { data: subsRes, isLoading: loadingSubs } = useGetSubscriptionsQuery({ limit: 200 });

  if (loadingOverview || loadingSubs) return <LoadingSkeleton />;

  const paidItem = overview?.find((o) => o.status === "paid");
  const totalRevenue = paidItem ? Number(paidItem.total_amount) : 0;
  const paidCount = paidItem ? Number(paidItem.count) : 1;
  const avgPerPlayer = paidCount > 0 ? totalRevenue / paidCount : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.payments },
          { label: t.reports },
        ]}
        actions={
          <Button variant="outline" className="gap-1.5">
            <FileDown className="h-4 w-4" />
            {t.exportFull}
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard label={t.totalRevenue} value={formatCurrency(totalRevenue)} icon="CreditCard" />
        <StatsCard label={t.avgPerPlayer} value={formatCurrency(avgPerPlayer)} icon="Users" />
        <StatsCard label={t.totalSubscriptions} value={subsRes?.pagination?.total ?? 0} icon="ClipboardCheck" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t.statusDistribution}</CardTitle>
          </CardHeader>
          <CardContent>
            {overview && overview.length > 0 ? (
              <DoughnutChart
                labels={overview.map((o) => statusLabel(o.status, language))}
                data={overview.map((o) => Number(o.count))}
                colors={["#7bea28", "#b6ff00", "#2d9ad5", "#2ee8c9"]}
                height={260}
              />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">{t.noPaymentData}</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t.revenueByStatus}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(overview ?? []).map((item) => (
                <div key={item.status} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                  <span className="font-medium text-sm capitalize">{statusLabel(item.status, language)}</span>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(Number(item.total_amount))}</p>
                    <p className="text-xs text-muted-foreground">{item.count} {t.subscriptions}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
