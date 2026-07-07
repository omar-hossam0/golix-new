import { ROLE_ROUTES } from "@/lib/constants";
import type { UserRole } from "@/lib/types";

type NotificationLanguage = "en" | "ar";

interface LocalizableNotification {
  title: string;
  body: string;
  type: string;
  data?: Record<string, unknown> | null;
}

function textValue(data: Record<string, unknown> | null | undefined, key: string) {
  const value = data?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function objectValue(
  data: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = data?.[key];
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

export function localizeNotification(
  notification: LocalizableNotification,
  language: NotificationLanguage,
) {
  if (language === "en") {
    return { title: notification.title, body: notification.body };
  }

  const playerName = textValue(notification.data, "playerName") || "اللاعب";
  const parentName = textValue(notification.data, "parentName") || "ولي الأمر";
  const coachName = textValue(notification.data, "coachName") || "المدرب";
  const source = textValue(notification.data, "source");
  const match = objectValue(notification.data, "match");
  const opponentName =
    textValue(notification.data, "opponentName") ||
    textValue(match, "opponentName") ||
    "الفريق المنافس";
  const eventTitle = textValue(notification.data, "eventTitle") || "الحصة التدريبية";

  if (notification.type === "parent_note_created") {
    return {
      title: "ملاحظة جديدة من ولي الأمر",
      body: `أرسل ${parentName} ملاحظة بخصوص ${playerName}.`,
    };
  }

  if (notification.type === "parent_note_replied") {
    return {
      title: "رد المدرب على ملاحظتك",
      body: `رد ${coachName} على ملاحظتك بخصوص ${playerName}.`,
    };
  }

  if (notification.type === "player_family_note") {
    return {
      title: "ملاحظة تدريبية جديدة للأسرة",
      body: `شارك ${coachName} ملاحظة أسرية جديدة معك.`,
    };
  }

  if (source === "ranking_system_weekly") {
    const topPlayerName = textValue(notification.data, "topPlayerName");
    return {
      title: "التصنيف الأسبوعي جاهز",
      body: topPlayerName
        ? `تم نشر التصنيف الجديد. صاحب المركز الأول: ${topPlayerName}.`
        : "تم نشر التصنيف الأسبوعي الجديد.",
    };
  }

  if (source === "attendance_qr_match_reminder") {
    return {
      title: "رمز حضور المباراة جاهز",
      body: `تبدأ مباراة ${opponentName} قريبًا. افتح صفحة المباريات لتسجيل الحضور بسرعة.`,
    };
  }

  if (source === "attendance_qr_training_reminder") {
    return {
      title: "رمز حضور التدريب جاهز",
      body: `تبدأ ${eventTitle} قريبًا. افتح صفحة التدريب لتسجيل الحضور بسرعة.`,
    };
  }

  if (source === "attendance_qr_checked_in") {
    const isMatch = notification.title === "Match attendance recorded";
    return {
      title: isMatch ? "تم تسجيل حضور المباراة" : "تم تسجيل حضور التدريب",
      body: isMatch
        ? `تم تسجيل حضور ${playerName} لمباراة ${opponentName}.`
        : `تم تسجيل حضور ${playerName} في ${eventTitle}.`,
    };
  }

  if (
    notification.title === "Match configuration saved" ||
    notification.title === "Match configuration updated"
  ) {
    return {
      title:
        notification.title === "Match configuration saved"
          ? "تم حفظ إعدادات المباراة"
          : "تم تحديث إعدادات المباراة",
      body: `تم نشر إعدادات مباراة ${opponentName}.`,
    };
  }

  if (notification.title === "Match starts soon") {
    return {
      title: "المباراة ستبدأ قريبًا",
      body: `مباراة ${opponentName} ستبدأ قريبًا، وتم فتح عمليات يوم المباراة.`,
    };
  }

  if (notification.title === "Match postponed") {
    return {
      title: "تم تأجيل المباراة",
      body: `تم تحديث موعد مباراة ${opponentName}. افتح صفحة المباريات لمعرفة الموعد الجديد.`,
    };
  }

  const translatedTitles: Record<string, string> = {
    "Weekly rankings are ready": "التصنيف الأسبوعي جاهز",
    "Match attendance QR is ready": "رمز حضور المباراة جاهز",
    "Training attendance QR is ready": "رمز حضور التدريب جاهز",
    "Monthly measurements due": "موعد القياسات الشهرية",
    "New match scheduled": "تمت جدولة مباراة جديدة",
    "New match assigned": "تم تعيين مباراة جديدة",
    "Match target required": "يلزم تحديد فئة المباراة",
    "Match postponed": "تم تأجيل المباراة",
    "Evaluation edit approved": "تمت الموافقة على تعديل التقييم",
    "Evaluation edit rejected": "تم رفض تعديل التقييم",
    "Friendly request approved": "تمت الموافقة على طلب المباراة الودية",
    "Friendly request rejected": "تم رفض طلب المباراة الودية",
    "Match configuration saved": "تم حفظ إعدادات المباراة",
    "Match configuration updated": "تم تحديث إعدادات المباراة",
    "Match starts soon": "المباراة ستبدأ قريبًا",
    "Training attendance recorded": "تم تسجيل حضور التدريب",
    "Match attendance recorded": "تم تسجيل حضور المباراة",
  };

  return {
    title: translatedTitles[notification.title] || notification.title,
    body: notification.body,
  };
}

export function getNotificationTypeLabel(type: string, language: NotificationLanguage) {
  if (language === "en") return type.replaceAll("_", " ");

  const labels: Record<string, string> = {
    payment: "دفعة",
    session: "حصة",
    training: "تدريب",
    match: "مباراة",
    attendance: "حضور",
    evaluation: "تقييم",
    ranking: "تصنيف",
    measurement: "قياسات",
    alert: "تنبيه",
    error: "خطأ",
    warning: "تحذير",
    info: "معلومة",
    system: "النظام",
    chat: "محادثة",
    message: "رسالة",
    parent_note_created: "ملاحظة ولي أمر",
    parent_note_replied: "رد المدرب",
    player_family_note: "ملاحظة أسرية",
  };

  return labels[type] || type.replaceAll("_", " ");
}

export function getNotificationHref(
  role: UserRole,
  type: string,
  data?: Record<string, unknown> | null,
) {
  const explicitHref = data?.href;
  if (
    typeof explicitHref === "string" &&
    explicitHref.startsWith("/") &&
    !explicitHref.startsWith("//")
  ) {
    const removedHrefs: Record<string, string> = {
      "/coach/parent-notes": "/coach/home",
      "/player/family-notes": "/player/home",
      "/parent/calendar": "/parent/schedule",
    };
    return removedHrefs[explicitHref] || explicitHref;
  }

  const matchData = data?.match as { id?: string } | undefined;
  const matchId = (data?.matchId as string | undefined) ?? matchData?.id;
  const eventId = data?.eventId as string | undefined;

  if (type === "match" || matchId) {
    if (role === "admin") return "/admin/matches";
    if (role === "coach") return matchId ? `/coach/matches/evaluation/${matchId}` : "/coach/matches";
    if (role === "parent") return "/parent/matches";
    return "/player/matches";
  }

  if (type === "training" || type === "session" || eventId) {
    if (role === "admin") return "/admin/calendar";
    if (role === "coach") return eventId ? `/coach/training/${eventId}` : "/coach/training";
    if (role === "parent") return "/parent/schedule";
    return "/player/training";
  }

  if (type === "payment") {
    if (role === "admin") return "/admin/payments";
    if (role === "parent") return "/parent/payments";
  }

  if (type === "parent_note_created" || type === "parent_note_replied") {
    if (role === "coach") return "/coach/home";
    if (role === "parent") return "/parent/home";
  }

  if (type === "player_family_note" && role === "player") {
    return "/player/home";
  }

  if (type === "chat" || type === "message") {
    if (role === "admin") return "/admin/chat";
    if (role === "coach") return "/coach/chat";
    if (role === "player") return "/player/chat";
  }

  if (type === "ranking") {
    if (role === "coach") return "/coach/rankings";
    if (role === "player") return "/player/performance/ranking";
    if (role === "admin") return "/admin/rankings/weekly";
  }

  return ROLE_ROUTES[role];
}
