"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { FileDown, RefreshCw } from "lucide-react";
import { useGetInvoicesQuery, type Invoice } from "@/lib/store/api/adminApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  paid: "success",
  pending: "warning",
  overdue: "destructive",
  cancelled: "secondary",
};

const copy = {
  en: {
    loadError: "Failed to load invoices.",
    retry: "Retry",
    invoiceNumber: "Invoice #",
    amount: "Amount",
    dueDate: "Due Date",
    paidAt: "Paid At",
    notPaid: "Not paid",
    status: "Status",
    invoices: "Invoices",
    description: "All invoices with payment status and history.",
    dashboard: "Dashboard",
    payments: "Payments",
    export: "Export",
    search: "Search invoices...",
  },
  ar: {
    loadError: "تعذر تحميل الفواتير.",
    retry: "إعادة المحاولة",
    invoiceNumber: "رقم الفاتورة",
    amount: "المبلغ",
    dueDate: "تاريخ الاستحقاق",
    paidAt: "تاريخ الدفع",
    notPaid: "لم يتم الدفع",
    status: "الحالة",
    invoices: "الفواتير",
    description: "كل الفواتير مع حالة الدفع والسجل.",
    dashboard: "الرئيسية",
    payments: "المدفوعات",
    export: "تصدير",
    search: "ابحث في الفواتير...",
  },
} as const;

const statusLabels = {
  en: { paid: "Paid", pending: "Pending", overdue: "Overdue", cancelled: "Cancelled" },
  ar: { paid: "مدفوع", pending: "معلق", overdue: "متأخر", cancelled: "ملغي" },
} as const;

export default function InvoicesPage() {
  const language = useDashboardLanguage();
  const t = copy[language];
  const { data, isLoading, isError, refetch } = useGetInvoicesQuery({ limit: 50 });

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

  const invoices = data?.data ?? [];
  const columns: Column<Invoice>[] = [
    {
      key: "id",
      header: t.invoiceNumber,
      accessor: (row) => (
        <span className="font-mono text-xs text-primary">{row.id.slice(0, 8).toUpperCase()}</span>
      ),
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
      key: "dueDate",
      header: t.dueDate,
      accessor: (row) => formatDate(row.due_date),
      sortable: true,
      sortValue: (row) => row.due_date,
    },
    {
      key: "paidAt",
      header: t.paidAt,
      accessor: (row) => (
        <span className={row.paid_at ? "" : "text-muted-foreground"}>
          {row.paid_at ? formatDate(row.paid_at) : t.notPaid}
        </span>
      ),
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
        title={`${t.invoices} (${data?.pagination?.total ?? invoices.length})`}
        description={t.description}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.payments },
          { label: t.invoices },
        ]}
        actions={
          <Button variant="outline" className="gap-1.5">
            <FileDown className="h-4 w-4" />
            {t.export}
          </Button>
        }
      />

      <DataTable
        data={invoices}
        columns={columns}
        searchable
        searchPlaceholder={t.search}
        searchKey={(row) => `${row.id} ${row.status}`}
      />
    </div>
  );
}
