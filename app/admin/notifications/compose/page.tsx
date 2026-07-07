"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, Users } from "lucide-react";
import { useSendNotificationMutation } from "@/lib/store/api/adminApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";

const composeCopy = {
  en: {
    pageTitle: "Compose Notification",
    pageDescription:
      "Send a custom notification to specific users or segments.",
    dashboard: "Dashboard",
    notifications: "Notifications",
    compose: "Compose",
    messageDetails: "Message Details",
    title: "Title",
    titlePlaceholder: "Notification title...",
    message: "Message",
    messagePlaceholder: "Write your message...",
    targetAudience: "Target Audience",
    selectRole: "Select role...",
    roles: {
      all: "All Users",
      coach: "Coaches",
      player: "Players",
      parent: "Parents",
    },
    type: "Type",
    selectType: "Select type...",
    types: {
      info: "Info",
      warning: "Warning",
      alert: "Alert",
      success: "Success",
    },
    sendError: "Failed to send notification. Please try again.",
    sending: "Sending...",
    sendNotification: "Send Notification",
    preview: "Preview",
    untitled: "Untitled",
    noMessage: "No message",
    previewEmpty: "Start composing to see preview.",
  },
  ar: {
    pageTitle: "إنشاء إشعار",
    pageDescription: "أرسل إشعارًا مخصصًا لمستخدمين محددين أو شرائح معينة.",
    dashboard: "لوحة التحكم",
    notifications: "الإشعارات",
    compose: "إنشاء",
    messageDetails: "تفاصيل الرسالة",
    title: "العنوان",
    titlePlaceholder: "عنوان الإشعار...",
    message: "الرسالة",
    messagePlaceholder: "اكتب رسالتك...",
    targetAudience: "الجمهور المستهدف",
    selectRole: "اختر الدور...",
    roles: {
      all: "كل المستخدمين",
      coach: "المدربون",
      player: "اللاعبون",
      parent: "أولياء الأمور",
    },
    type: "النوع",
    selectType: "اختر النوع...",
    types: {
      info: "معلومة",
      warning: "تنبيه",
      alert: "تحذير",
      success: "نجاح",
    },
    sendError: "فشل إرسال الإشعار. حاول مرة أخرى.",
    sending: "جاري الإرسال...",
    sendNotification: "إرسال الإشعار",
    preview: "المعاينة",
    untitled: "بدون عنوان",
    noMessage: "لا توجد رسالة",
    previewEmpty: "ابدأ كتابة الإشعار لرؤية المعاينة.",
  },
} as const;

export default function ComposeNotificationPage() {
  const router = useRouter();
  const language = useDashboardLanguage();
  const t = composeCopy[language];
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetRole, setTargetRole] = useState("all");
  const [type, setType] = useState("info");
  const [sendError, setSendError] = useState("");
  const [sendNotification, { isLoading }] = useSendNotificationMutation();

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) return;
    setSendError("");
    try {
      await sendNotification({
        title: title.trim(),
        body: message.trim(),
        type,
        ...(targetRole !== "all" ? { targetRole } : {}),
      }).unwrap();
      router.push("/admin/notifications");
    } catch {
      setSendError(t.sendError);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t.pageTitle}
        description={t.pageDescription}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.notifications, href: "/admin/notifications" },
          { label: t.compose },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="border-border/50 bg-card">
            <CardHeader>
              <CardTitle className="text-base">{t.messageDetails}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notification-title">{t.title}</Label>
                <Input
                  id="notification-title"
                  placeholder={t.titlePlaceholder}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notification-message">{t.message}</Label>
                <Textarea
                  id="notification-message"
                  placeholder={t.messagePlaceholder}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.targetAudience}</Label>
                  <Select value={targetRole} onValueChange={setTargetRole}>
                    <SelectTrigger>
                      <SelectValue placeholder={t.selectRole} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t.roles.all}</SelectItem>
                      <SelectItem value="coach">{t.roles.coach}</SelectItem>
                      <SelectItem value="player">{t.roles.player}</SelectItem>
                      <SelectItem value="parent">{t.roles.parent}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.type}</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue placeholder={t.selectType} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">{t.types.info}</SelectItem>
                      <SelectItem value="warning">{t.types.warning}</SelectItem>
                      <SelectItem value="alert">{t.types.alert}</SelectItem>
                      <SelectItem value="success">{t.types.success}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {sendError && <p className="text-sm text-red-400">{sendError}</p>}
              <Button
                className="w-full gap-1.5"
                disabled={!title.trim() || !message.trim() || isLoading}
                onClick={handleSend}
              >
                <Send className="h-4 w-4" />
                {isLoading ? t.sending : t.sendNotification}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit border-border/50 bg-card">
          <CardHeader>
            <CardTitle className="text-base">{t.preview}</CardTitle>
          </CardHeader>
          <CardContent>
            {title || message ? (
              <div className="space-y-2 rounded-lg border border-border/50 p-4">
                <h4 className="text-sm font-semibold">{title || t.untitled}</h4>
                <p className="text-xs text-muted-foreground">
                  {message || t.noMessage}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {targetRole !== "all" && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] capitalize"
                    >
                      <Users className="mr-1 h-3 w-3" />
                      {t.roles[targetRole as keyof typeof t.roles]}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {t.types[type as keyof typeof t.types]}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t.previewEmpty}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
