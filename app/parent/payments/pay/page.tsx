"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, CreditCard, Lock, Shield, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { useParentSelectedChild } from "@/lib/hooks/useParentSelectedChild";
import { useGetParentChildPaymentsQuery } from "@/lib/store/api/calendarApi";
import { formatCurrency, formatDate } from "@/lib/utils";

const copy = {
  en: {
    title: "Pay Now",
    home: "Home",
    payments: "Payments",
    description: "Make a payment for your child's subscription",
    childDescription: (name: string) => `Review outstanding invoices for ${name}`,
    successTitle: "Payment request prepared",
    successAmount: (amount: string) => `${amount} is ready for secure processing.`,
    successNote: "Final collection depends on the connected payment gateway.",
    outstandingInvoices: "Outstanding Invoices",
    due: "Due",
    noOutstanding: "No outstanding invoices. You are all caught up.",
    paymentMethod: "Payment Method",
    creditCard: "Credit Card",
    mobileWallet: "Mobile Wallet",
    bankTransfer: "Bank Transfer",
    cardDetails: "Card Details",
    cardNumber: "Card Number",
    expiry: "Expiry",
    securityCode: "CVV",
    nameOnCard: "Name on Card",
    guardianName: "Guardian name",
    provider: "Provider",
    phoneNumber: "Phone Number",
    bankTransferDetails: "Bank Transfer Details",
    bankName: "Bank Name",
    bankAccount: "Goalix Academy Bank Account",
    reference: "Reference",
    bankHint: "Use the reference above so the academy can reconcile the payment quickly.",
    summary: "Summary",
    invoice: "Invoice",
    total: "Total",
    processing: "Processing...",
    pay: "Pay",
    secureGateway: "Secure payment gateway ready",
    plan: "plan",
  },
  ar: {
    title: "ادفع الآن",
    home: "الرئيسية",
    payments: "المدفوعات",
    description: "ادفع اشتراك اللاعب.",
    childDescription: (name: string) => `راجع الفواتير المستحقة لـ ${name}`,
    successTitle: "تم تجهيز طلب الدفع",
    successAmount: (amount: string) => `المبلغ ${amount} جاهز للمعالجة الآمنة.`,
    successNote: "التحصيل النهائي يعتمد على بوابة الدفع المتصلة.",
    outstandingInvoices: "الفواتير المستحقة",
    due: "الاستحقاق",
    noOutstanding: "لا توجد فواتير مستحقة. كل شيء محدث.",
    paymentMethod: "طريقة الدفع",
    creditCard: "بطاقة ائتمان",
    mobileWallet: "محفظة إلكترونية",
    bankTransfer: "تحويل بنكي",
    cardDetails: "بيانات البطاقة",
    cardNumber: "رقم البطاقة",
    expiry: "تاريخ الانتهاء",
    securityCode: "رمز الأمان",
    nameOnCard: "الاسم على البطاقة",
    guardianName: "اسم ولي الأمر",
    provider: "مزود الخدمة",
    phoneNumber: "رقم الهاتف",
    bankTransferDetails: "بيانات التحويل البنكي",
    bankName: "اسم البنك",
    bankAccount: "حساب بنك أكاديمية Goalix",
    reference: "المرجع",
    bankHint: "استخدم المرجع بالأعلى حتى تتمكن الأكاديمية من مطابقة الدفع بسرعة.",
    summary: "الملخص",
    invoice: "فاتورة",
    total: "الإجمالي",
    processing: "جاري المعالجة...",
    pay: "ادفع",
    secureGateway: "بوابة الدفع الآمنة جاهزة",
    plan: "خطة",
  },
} as const;

const statusLabels = {
  en: {
    pending: "Pending",
    overdue: "Overdue",
  },
  ar: {
    pending: "معلق",
    overdue: "متأخر",
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

const providerLabels = {
  en: {
    vodafone: "Vodafone Cash",
    orange: "Orange Money",
    etisalat: "Etisalat Cash",
    fawry: "Fawry",
  },
  ar: {
    vodafone: "فودافون كاش",
    orange: "أورنج موني",
    etisalat: "اتصالات كاش",
    fawry: "فوري",
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

export default function ParentPayNowPage() {
  const language = useDashboardLanguage();
  const t = copy[language];
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const { selectedChild, selectedChildId } = useParentSelectedChild();
  const { data } = useGetParentChildPaymentsQuery(selectedChildId, {
    skip: !selectedChildId,
  });

  const pendingInvoices = useMemo(
    () =>
      (data?.invoices ?? []).filter(
        (invoice) => invoice.status === "pending" || invoice.status === "overdue",
      ),
    [data?.invoices],
  );
  const totalDue = pendingInvoices.reduce(
    (acc, invoice) => acc + Number(invoice.amount || 0),
    0,
  );
  const fallbackAmount = Number(data?.currentSubscription?.amount || 0);

  const handlePay = () => {
    setProcessing(true);
    window.setTimeout(() => {
      setProcessing(false);
      setSuccess(true);
    }, 900);
  };

  if (success) {
    return (
      <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
        <PageHeader
          title={t.title}
          breadcrumbs={[
            { label: t.home, href: "/parent/home" },
            { label: t.payments },
            { label: t.title },
          ]}
        />
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-400" />
            <h2 className="text-2xl font-bold">{t.successTitle}</h2>
            <p className="text-muted-foreground">
              {t.successAmount(money(totalDue || fallbackAmount))}
            </p>
            <p className="text-sm text-muted-foreground">
              {t.successNote}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          { label: t.title },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{t.outstandingInvoices}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/20 p-4"
                >
                  <div>
                    <p className="font-semibold">{money(invoice.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.due}: {formatDate(invoice.due_date)}
                    </p>
                  </div>
                  <Badge variant={invoice.status === "overdue" ? "destructive" : "warning"}>
                    {statusLabels[language][invoice.status as keyof typeof statusLabels.en] || invoice.status}
                  </Badge>
                </div>
              ))}
              {!pendingInvoices.length && (
                <div className="rounded-lg border border-dashed border-border/40 p-8 text-center text-muted-foreground">
                  {t.noOutstanding}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{t.paymentMethod}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: "card", label: t.creditCard, icon: CreditCard },
                  { id: "mobile", label: t.mobileWallet, icon: Smartphone },
                  { id: "bank", label: t.bankTransfer, icon: Shield },
                ].map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id)}
                    className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border-2 p-4 transition-all ${
                      paymentMethod === method.id
                        ? "border-primary bg-primary/5"
                        : "border-border/30 hover:border-border"
                    }`}
                  >
                    <method.icon
                      className={`h-6 w-6 ${
                        paymentMethod === method.id ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <span className="text-xs font-medium">{method.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {paymentMethod === "card" && (
            <Card className="border-border/50 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Lock className="h-4 w-4 text-emerald-400" />
                  {t.cardDetails}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-1.5 block text-sm">{t.cardNumber}</Label>
                  <Input inputMode="numeric" placeholder="4242 4242 4242 4242" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-1.5 block text-sm">{t.expiry}</Label>
                    <Input placeholder={language === "ar" ? "شهر/سنة" : "MM/YY"} />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-sm">{t.securityCode}</Label>
                    <Input placeholder="123" type="password" />
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">{t.nameOnCard}</Label>
                  <Input placeholder={t.guardianName} />
                </div>
              </CardContent>
            </Card>
          )}

          {paymentMethod === "mobile" && (
            <Card className="border-border/50 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">{t.mobileWallet}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="mb-1.5 block text-sm">{t.provider}</Label>
                  <Select defaultValue="vodafone">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vodafone">{providerLabels[language].vodafone}</SelectItem>
                      <SelectItem value="orange">{providerLabels[language].orange}</SelectItem>
                      <SelectItem value="etisalat">{providerLabels[language].etisalat}</SelectItem>
                      <SelectItem value="fawry">{providerLabels[language].fawry}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block text-sm">{t.phoneNumber}</Label>
                  <Input placeholder="+20 10x xxx xxxx" />
                </div>
              </CardContent>
            </Card>
          )}

          {paymentMethod === "bank" && (
            <Card className="border-border/50 bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">{t.bankTransferDetails}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">{t.bankName}</p>
                  <p className="font-medium">{t.bankAccount}</p>
                </div>
                <div className="rounded-lg bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground">{t.reference}</p>
                  <p className="font-mono font-medium">{selectedChild?.player_code || selectedChildId}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.bankHint}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit border-border/50 bg-card lg:sticky lg:top-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{t.summary}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingInvoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t.invoice} #{invoice.id.slice(-4)}</span>
                <span className="font-medium">{money(invoice.amount)}</span>
              </div>
            ))}
            {!pendingInvoices.length && data?.currentSubscription && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {planLabel(data.currentSubscription.plan, language)} {t.plan}
                </span>
                <span className="font-medium">{money(data.currentSubscription.amount)}</span>
              </div>
            )}
            <div className="border-t border-border/30 pt-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{t.total}</span>
                <span className="text-xl font-bold text-primary">
                  {money(totalDue || fallbackAmount)}
                </span>
              </div>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handlePay}
              disabled={processing || (!totalDue && !fallbackAmount)}
            >
              {processing ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t.processing}
                </span>
              ) : (
                <>
                  <Lock className={`${language === "ar" ? "ml-2" : "mr-2"} h-4 w-4`} />
                  {t.pay} {money(totalDue || fallbackAmount)}
                </>
              )}
            </Button>
            <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
              <Shield className="h-3 w-3" />
              {t.secureGateway}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
