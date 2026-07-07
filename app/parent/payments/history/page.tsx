"use client";

import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PAYMENT_STATUS_CONFIG } from "@/lib/constants";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { useParentSelectedChild } from "@/lib/hooks/useParentSelectedChild";
import { useGetParentChildPaymentsQuery } from "@/lib/store/api/calendarApi";
import { formatCurrency, formatDate } from "@/lib/utils";

const copy = {
  en: {
    title: "Payment History",
    description: "All past payments and invoices",
    childDescription: (name: string) => `All invoices for ${name}`,
    home: "Home",
    payments: "Payments",
    history: "History",
    loading: "Loading payment history...",
    date: "Date",
    player: "Player",
    plan: "Plan",
    amount: "Amount",
    dueDate: "Due Date",
    paidDate: "Paid Date",
    status: "Status",
    noInvoices: "No invoices yet.",
  },
  ar: {
    title: "سجل المدفوعات",
    description: "كل المدفوعات والفواتير السابقة",
    childDescription: (name: string) => `كل فواتير ${name}`,
    home: "الرئيسية",
    payments: "المدفوعات",
    history: "السجل",
    loading: "جاري تحميل سجل المدفوعات...",
    date: "التاريخ",
    player: "اللاعب",
    plan: "الخطة",
    amount: "المبلغ",
    dueDate: "تاريخ الاستحقاق",
    paidDate: "تاريخ الدفع",
    status: "الحالة",
    noInvoices: "لا توجد فواتير بعد.",
  },
} as const;

const statusLabels = {
  en: {
    paid: "Paid",
    pending: "Pending",
    overdue: "Overdue",
    cancelled: "Cancelled",
  },
  ar: {
    paid: "مدفوع",
    pending: "معلق",
    overdue: "متأخر",
    cancelled: "ملغي",
  },
} as const;

const planLabels = {
  en: {
    monthly: "Monthly",
    yearly: "Yearly",
    annual: "Annual",
    basic: "Basic",
    premium: "Premium",
    academy: "Academy",
    individual: "Individual",
    group: "Group",
  },
  ar: {
    monthly: "شهري",
    yearly: "سنوي",
    annual: "سنوي",
    basic: "أساسي",
    premium: "مميز",
    academy: "أكاديمي",
    individual: "فردي",
    group: "جماعي",
  },
} as const;

function money(value: string | number | undefined | null) {
  return formatCurrency(Number(value || 0));
}

function planLabel(plan: string | undefined | null, language: keyof typeof copy) {
  if (!plan) return "-";
  const normalized = plan.toLowerCase() as keyof typeof planLabels.en;
  return planLabels[language][normalized] || plan;
}

export default function ParentPaymentHistoryPage() {
  const language = useDashboardLanguage();
  const t = copy[language];
  const { selectedChild, selectedChildId } = useParentSelectedChild();
  const { data, isLoading } = useGetParentChildPaymentsQuery(selectedChildId, {
    skip: !selectedChildId,
  });
  const invoices = data?.invoices ?? [];

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title={t.title}
        description={
          selectedChild
            ? t.childDescription(selectedChild.full_name)
            : t.description
        }
        breadcrumbs={[
          { label: t.home, href: "/parent/home" },
          { label: t.payments },
          { label: t.history },
        ]}
      />

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loading}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 bg-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-left text-muted-foreground">
                    <th className="p-4 font-semibold">{t.date}</th>
                    <th className="p-4 font-semibold">{t.player}</th>
                    <th className="p-4 font-semibold">{t.plan}</th>
                    <th className="p-4 font-semibold">{t.amount}</th>
                    <th className="p-4 font-semibold">{t.dueDate}</th>
                    <th className="p-4 font-semibold">{t.paidDate}</th>
                    <th className="p-4 font-semibold">{t.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-border/20">
                      <td className="p-4">{formatDate(invoice.created_at || invoice.due_date)}</td>
                      <td className="p-4 font-semibold">{selectedChild?.full_name || "-"}</td>
                      <td className="p-4">{planLabel(invoice.plan, language)}</td>
                      <td className="p-4 font-semibold">{money(invoice.amount)}</td>
                      <td className="p-4">{formatDate(invoice.due_date)}</td>
                      <td className="p-4">{invoice.paid_at ? formatDate(invoice.paid_at) : "-"}</td>
                      <td className="p-4">
                        <Badge variant={PAYMENT_STATUS_CONFIG[invoice.status]?.variant || "secondary"}>
                          {statusLabels[language][invoice.status as keyof typeof statusLabels.en] || invoice.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!invoices.length && (
              <div className="p-8 text-center text-muted-foreground">
                {t.noInvoices}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
