"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { CreditCard, Lock, MessageSquare, Smartphone } from "lucide-react";

const previewCards = [
  {
    title: "WhatsApp Business",
    icon: MessageSquare,
    tone: "text-emerald-300 bg-emerald-400/10",
    fields: ["Provider", "Business Phone ID", "Access Token"],
  },
  {
    title: "SMS Gateway",
    icon: Smartphone,
    tone: "text-sky-300 bg-sky-400/10",
    fields: ["Provider", "Sender ID", "API Key"],
  },
  {
    title: "Payment Gateway",
    icon: CreditCard,
    tone: "text-amber-300 bg-amber-400/10",
    fields: ["Provider", "Mode", "Webhook Secret"],
  },
];

const integrationsCopy = {
  en: {
    title: "Integrations",
    description: "Manage third-party connections for notifications and payments.",
    dashboard: "Dashboard",
    settings: "Settings",
    off: "Off",
    comingSoon: "Coming Soon",
    comingSoonBody: "External providers for WhatsApp, SMS, and payments are being prepared for production setup.",
    whatsappBusiness: "WhatsApp Business",
    smsGateway: "SMS Gateway",
    paymentGateway: "Payment Gateway",
  },
  ar: {
    title: "التكاملات",
    description: "إدارة ربط مزودي الإشعارات والخدمات الخارجية.",
    dashboard: "لوحة التحكم",
    settings: "الإعدادات",
    off: "متوقف",
    comingSoon: "قريبًا",
    comingSoonBody: "يتم تجهيز مزودي واتساب والرسائل والخدمات الخارجية لإعداد الإنتاج.",
    whatsappBusiness: "واتساب للأعمال",
    smsGateway: "بوابة الرسائل",
    paymentGateway: "بوابة الدفع",
  },
} as const;

export default function IntegrationsPage() {
  const language = useDashboardLanguage();
  const t = integrationsCopy[language];
  const cardTitles = [t.whatsappBusiness, t.smsGateway, t.paymentGateway];

  return (
    <div className="relative min-h-[calc(100vh-120px)] animate-fade-in overflow-hidden rounded-xl">
      <div className="pointer-events-none select-none blur-[14px] opacity-45">
        <div className="space-y-6">
          <PageHeader
            title={t.title}
            description={t.description}
            breadcrumbs={[
              { label: t.dashboard, href: "/admin/dashboard" },
              { label: t.settings },
              { label: t.title },
            ]}
          />

          <section className="min-h-[calc(100vh-220px)] overflow-hidden rounded-xl border border-border/60 bg-card/60">
            <div className="grid gap-4 p-6 xl:grid-cols-3">
              {previewCards.map((item, index) => {
                const Icon = item.icon;
                return (
                  <Card key={item.title} className="border-border/50 bg-card">
                    <CardHeader className="flex flex-row items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className={`rounded-lg p-3 ${item.tone}`}>
                          <Icon className="h-6 w-6" />
                        </span>
                        <CardTitle className="text-base">{cardTitles[index]}</CardTitle>
                      </div>
                      <Badge variant="secondary">{t.off}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="h-12 rounded-lg border border-border/50 bg-muted/30" />
                      {item.fields.map((field) => (
                        <div key={field} className="space-y-2">
                          <div className="h-3 w-28 rounded bg-muted/60" />
                          <div className="h-10 rounded-lg border border-border/50 bg-background/60" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            <div className="grid gap-4 px-6 pb-6 md:grid-cols-2">
              <div className="h-44 rounded-xl border border-border/50 bg-muted/20" />
              <div className="h-44 rounded-xl border border-border/50 bg-muted/20" />
            </div>
          </section>
        </div>
      </div>

      <div className="absolute inset-0 bg-background/35 backdrop-blur-[8px]" />

      <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-lime-300/30 bg-card/90 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-lime-300/40 bg-lime-300/10 text-lime-300">
            <Lock className="h-7 w-7" />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-lime-300">
            {t.title}
          </p>
          <h2 className="mt-2 text-4xl font-black text-foreground">{t.comingSoon}</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t.comingSoonBody}
          </p>
        </div>
      </div>
    </div>
  );
}
