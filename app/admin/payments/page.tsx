"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatsCard } from "@/components/shared/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DoughnutChart } from "@/components/charts/DoughnutChart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { FileDown, RefreshCw } from "lucide-react";
import { useGetPaymentOverviewQuery } from "@/lib/store/api/adminApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";

const copy = {
  en: {
    loadError: "Failed to load payment overview.",
    retry: "Retry",
    title: "Payments Overview",
    description: "Revenue summary, pending, and overdue payments.",
    dashboard: "Dashboard",
    payments: "Payments",
    overview: "Overview",
    exportReport: "Export Financial Report",
    totalPaid: "Total Paid",
    pending: "Pending",
    overdue: "Overdue",
    totalSubscriptions: "Total Subscriptions",
    breakdown: "Payment Breakdown",
    noData: "No payment data available.",
    subscriptions: "subscriptions",
    viewSubscriptions: "View Subscriptions",
    viewInvoices: "View Invoices",
    status: "Payment Status",
    paid: "Paid",
    overduePayments: "Overdue Payments",
    overdueSummary: (count: number, amount: string) =>
      `${count} overdue subscription${count > 1 ? "s" : ""} totalling ${amount}.`,
    viewOverdue: "View Overdue Invoices",
  },
  ar: {
    loadError: "تعذر تحميل ملخص المدفوعات.",
    retry: "إعادة المحاولة",
    title: "ملخص المدفوعات",
    description: "ملخص الإيرادات والمدفوعات المعلقة والمتأخرة.",
    dashboard: "الرئيسية",
    payments: "المدفوعات",
    overview: "نظرة عامة",
    exportReport: "تصدير التقرير المالي",
    totalPaid: "إجمالي المدفوع",
    pending: "معلق",
    overdue: "متأخر",
    totalSubscriptions: "إجمالي الاشتراكات",
    breakdown: "تفصيل المدفوعات",
    noData: "لا توجد بيانات مدفوعات.",
    subscriptions: "اشتراكات",
    viewSubscriptions: "عرض الاشتراكات",
    viewInvoices: "عرض الفواتير",
    status: "حالة المدفوعات",
    paid: "مدفوع",
    overduePayments: "مدفوعات متأخرة",
    overdueSummary: (count: number, amount: string) =>
      `${count} اشتراك متأخر بإجمالي ${amount}.`,
    viewOverdue: "عرض الفواتير المتأخرة",
  },
} as const;

const statusLabel = (status: string, language: keyof typeof copy) => {
  const labels = {
    en: { paid: "Paid", pending: "Pending", overdue: "Overdue", cancelled: "Cancelled" },
    ar: { paid: "مدفوع", pending: "معلق", overdue: "متأخر", cancelled: "ملغي" },
  } as const;
  return labels[language][status as keyof typeof labels.en] ?? status;
};

export default function PaymentsOverviewPage() {
  const language = useDashboardLanguage();
  const t = copy[language];
  const { data: overview, isLoading, isError, refetch } = useGetPaymentOverviewQuery();

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
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

  const items = overview ?? [];
  const getAmount = (status: string) => {
    const found = items.find((item) => item.status === status);
    return found ? parseFloat(found.total_amount) : 0;
  };
  const getCount = (status: string) => {
    const found = items.find((item) => item.status === status);
    return found ? parseInt(found.count, 10) : 0;
  };

  const paid = getAmount("paid");
  const pending = getAmount("pending");
  const overdue = getAmount("overdue");
  const paidCount = getCount("paid");
  const pendingCount = getCount("pending");
  const overdueCount = getCount("overdue");
  const totalSubscriptions = items.reduce((sum, item) => sum + parseInt(item.count, 10), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.payments },
          { label: t.overview },
        ]}
        actions={
          <Button variant="outline" className="gap-1.5">
            <FileDown className="h-4 w-4" />
            {t.exportReport}
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard label={t.totalPaid} value={formatCurrency(paid)} icon="CreditCard" />
        <StatsCard label={t.pending} value={formatCurrency(pending)} icon="AlertTriangle" />
        <StatsCard label={t.overdue} value={formatCurrency(overdue)} icon="AlertTriangle" />
        <StatsCard label={t.totalSubscriptions} value={totalSubscriptions} icon="Users" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-border/50 bg-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t.breakdown}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noData}</p>
            ) : (
              items.map((item) => (
                <div key={item.status} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                  <div>
                    <p className="font-medium capitalize">{statusLabel(item.status, language)}</p>
                    <p className="text-xs text-muted-foreground">{item.count} {t.subscriptions}</p>
                  </div>
                  <p className="font-bold">{formatCurrency(parseFloat(item.total_amount))}</p>
                </div>
              ))
            )}
            <div className="flex gap-2 pt-2">
              <Link href="/admin/payments/subscriptions">
                <Button variant="outline" size="sm">{t.viewSubscriptions}</Button>
              </Link>
              <Link href="/admin/payments/invoices">
                <Button variant="outline" size="sm">{t.viewInvoices}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t.status}</CardTitle>
          </CardHeader>
          <CardContent>
            <DoughnutChart
              labels={[t.paid, t.pending, t.overdue]}
              data={[paidCount, pendingCount, overdueCount]}
              colors={["#7bea28", "#b6ff00", "#2d9ad5"]}
              height={220}
              centerValue={`${paidCount}`}
              centerLabel={t.paid}
            />
          </CardContent>
        </Card>
      </div>

      {overdueCount > 0 && (
        <Card className="border-cyan-500/30 bg-cyan-500/5">
          <CardHeader>
            <CardTitle className="text-base text-cyan-400">{t.overduePayments}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t.overdueSummary(overdueCount, formatCurrency(overdue))}
            </p>
            <Link href="/admin/payments/invoices?status=overdue">
              <Button size="sm" className="mt-3 bg-cyan-500 text-slate-950 hover:bg-cyan-400">{t.viewOverdue}</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
