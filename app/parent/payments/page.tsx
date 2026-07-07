"use client";

import Link from "next/link";
import { AlertCircle, Calendar, CheckCircle, CreditCard, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { useParentSelectedChild } from "@/lib/hooks/useParentSelectedChild";
import { useGetParentChildPaymentsQuery } from "@/lib/store/api/calendarApi";
import { PAYMENT_STATUS_CONFIG } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";

const copy = {
  en: {
    title: "Payment Status",
    description: "Live subscription and billing records.",
    childDescription: (name: string) => `${name}'s live subscription and invoices`,
    home: "Home",
    payments: "Payments",
    status: "Status",
    payNow: "Pay Now",
    noChild: "No linked child found for this parent account.",
    loading: "Loading payments...",
    noAccess: "Payment access is not enabled for this child.",
    currentSubscription: "Current Subscription",
    plan: "Plan",
    amount: "Amount",
    period: "Period",
    nextPayment: "Next payment",
    totalDue: "Total due",
    paid: "Paid",
    invoices: "Invoices",
    recentInvoices: "Recent Invoices",
    viewAll: "View All",
    due: "Due",
    noInvoices: "No invoices yet",
    outstandingBalance: "Outstanding balance",
    invoiceAttention: (count: number) => `${count} invoice(s) need attention.`,
    reviewPayment: "Review Payment",
  },
  ar: {
    title: "حالة المدفوعات",
    description: "الاشتراك والفواتير المباشرة.",
    childDescription: (name: string) => `اشتراك وفواتير ${name} مباشرة`,
    home: "الرئيسية",
    payments: "المدفوعات",
    status: "الحالة",
    payNow: "ادفع الآن",
    noChild: "لا يوجد لاعب مرتبط بحساب ولي الأمر.",
    loading: "جاري تحميل المدفوعات...",
    noAccess: "صلاحية المدفوعات غير مفعلة لهذا اللاعب.",
    currentSubscription: "الاشتراك الحالي",
    plan: "الخطة",
    amount: "المبلغ",
    period: "الفترة",
    nextPayment: "الدفعة القادمة",
    totalDue: "إجمالي المستحق",
    paid: "المدفوع",
    invoices: "الفواتير",
    recentInvoices: "آخر الفواتير",
    viewAll: "عرض الكل",
    due: "الاستحقاق",
    noInvoices: "لا توجد فواتير بعد",
    outstandingBalance: "رصيد مستحق",
    invoiceAttention: (count: number) =>
      count === 1 ? "توجد فاتورة واحدة تحتاج مراجعة." : `${count} فواتير تحتاج مراجعة.`,
    reviewPayment: "مراجعة الدفع",
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

export default function ParentPaymentsPage() {
  const language = useDashboardLanguage();
  const t = copy[language];
  const { selectedChild, selectedChildId } = useParentSelectedChild();
  const { data, isLoading, isError } = useGetParentChildPaymentsQuery(selectedChildId, {
    skip: !selectedChildId,
  });
  const current = data?.currentSubscription ?? null;
  const invoices = data?.invoices ?? [];
  const dueInvoices = invoices.filter((item) => item.status === "pending" || item.status === "overdue");

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
          { label: t.status },
        ]}
        actions={
          <Link href="/parent/payments/pay">
            <Button size="sm">
              <CreditCard className={`${language === "ar" ? "ml-1" : "mr-1"} h-4 w-4`} />
              {t.payNow}
            </Button>
          </Link>
        }
      />

      {!selectedChildId ? (
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
      ) : isError ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {t.noAccess}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{t.currentSubscription}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">{t.plan}</p>
                  <p className="text-lg font-bold">{planLabel(current?.plan, language)}</p>
                </div>
                <div className="rounded-lg bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">{t.amount}</p>
                  <p className="text-lg font-bold">{money(current?.amount)}</p>
                </div>
                <div className="rounded-lg bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">{t.period}</p>
                  <p className="text-sm font-medium">
                    {current ? `${formatDate(current.starts_at)} - ${formatDate(current.ends_at)}` : "-"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">{t.status}</p>
                  <Badge className="mt-1" variant={current?.status === "active" ? "success" : "secondary"}>
                    {current?.status
                      ? statusLabels[language][current.status as keyof typeof statusLabels.en] || current.status
                      : "-"}
                  </Badge>
                </div>
              </div>
              {current?.next_payment_due && (
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {t.nextPayment}: {formatDate(current.next_payment_due)}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: t.totalDue, value: money(data?.totals?.due), icon: AlertCircle },
              { label: t.paid, value: money(data?.totals?.paid), icon: CheckCircle },
              { label: t.invoices, value: String(invoices.length), icon: CreditCard },
            ].map((item) => (
              <Card key={item.label} className="border-border/50 bg-card">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-2xl font-bold">{item.value}</p>
                  </div>
                  <item.icon className="h-7 w-7 text-primary" />
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border/50 bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">{t.recentInvoices}</CardTitle>
              <Link href="/parent/payments/history">
                <Button variant="ghost" size="sm">{t.viewAll}</Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoices.slice(0, 5).map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/20 p-4"
                >
                  <div className="flex items-center gap-3">
                    {invoice.status === "paid" ? (
                      <CheckCircle className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-amber-400" />
                    )}
                    <div>
                      <p className="font-medium">{money(invoice.amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.due}: {formatDate(invoice.due_date)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={PAYMENT_STATUS_CONFIG[invoice.status]?.variant || "secondary"}>
                    {statusLabels[language][invoice.status as keyof typeof statusLabels.en] || invoice.status}
                  </Badge>
                </div>
              ))}
              {!invoices.length && (
                <p className="py-8 text-center text-muted-foreground">
                  {t.noInvoices}
                </p>
              )}
            </CardContent>
          </Card>

          {dueInvoices.length > 0 && (
            <Card className="border-amber-400/30 bg-amber-400/5">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{t.outstandingBalance}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.invoiceAttention(dueInvoices.length)}
                  </p>
                </div>
                <Link href="/parent/payments/pay">
                  <Button>{t.reviewPayment}</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
