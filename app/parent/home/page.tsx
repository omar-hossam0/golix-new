"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import {
  Activity,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  Goal,
  Loader2,
  MessageSquare,
  Send,
  ShieldCheck,
  Star,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";
import {
  type CalendarEvent,
  type Match,
  type ParentChild,
  type PlayerAttendanceRecord,
  type PlayerEvaluationRecord,
  useCreateParentChildNoteMutation,
  useGetParentDashboardQuery,
} from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { useParentSelectedChild } from "@/lib/hooks/useParentSelectedChild";
import { cn } from "@/lib/utils";

type DashboardLanguage = "en" | "ar";

const copy = {
  en: {
    eyebrow: "Family performance hub",
    title: "Welcome back, guardian",
    subtitle: "Monitor every linked player, message coaches, and follow the weekly journey from one place.",
    children: "Linked players",
    noChildren: "No linked players yet. Ask the academy admin to link your parent account to a player.",
    attendance: "Attendance",
    training: "Training",
    matches: "Matches",
    rating: "Avg rating",
    goals: "Goals",
    assists: "Assists",
    minutes: "Weekly minutes",
    discipline: "Discipline",
    season: "This season",
    coaches: "Assigned coaches",
    messageCoach: "Message coach",
    upcoming: "Upcoming schedule",
    recentMatches: "Recent matches",
    evaluations: "Coach evaluations",
    attendanceLog: "Attendance log",
    parentNotes: "Parent notes",
    addNote: "Send a note",
    titlePlaceholder: "Short title",
    bodyPlaceholder: "What should the coach know?",
    allCoaches: "All assigned coaches",
    send: "Send note",
    loading: "Loading family dashboard...",
    empty: "No data yet.",
    reviewed: "Reviewed",
    resolved: "Resolved",
    new: "New",
    coachReply: "Coach reply",
    viewCalendar: "Open calendar",
    viewMatches: "Open matches",
    paymentAccess: "Payment access",
    progressAccess: "Progress access",
    weeklyReport: "Weekly parent report",
    aiInsights: "AI health and evaluation",
    injuryRisk: "Injury risk",
    aiEvaluation: "AI evaluation",
    riskLevel: "Risk level",
    riskScore: "Risk score",
    recommendation: "Recommendation",
    noAiInsights: "No AI result has been published for this player yet.",
    ranking: "Ranking",
    overallScore: "Overall score",
    aiBreakdown: "AI breakdown",
    trend: "Trend",
    model: "Model",
    highlights: "Highlights",
    actionItems: "Action items",
    payments: "Payments",
    totalDue: "Total due",
    paid: "Paid",
    latestInvoice: "Latest invoice",
    age: "Age",
    group: "Group",
    branch: "Branch",
    relation: "Relation",
    code: "Code",
    coach: "Coach",
    trainingEvaluation: "Training evaluation",
    goalixVs: "GOALIX vs",
    noProgressAccess: "Progress access is not enabled",
    noProgressAccessBody: "The coach or academy admin controls whether performance reports are visible to this parent account.",
    parentObservation: "Parent observation",
    present: "Present",
    late: "Late",
    absent: "Absent",
    excused: "Excused",
    trainingType: "Training",
    matchType: "Match",
    scheduled: "Scheduled",
    completed: "Completed",
    finished: "Finished",
    cancelled: "Cancelled",
    postponed: "Postponed",
    messageAccessDisabled: "Coach messaging is not enabled for this player.",
    messageAccessDisabledBody: "The academy controls whether this parent account can contact the assigned coaches.",
    noteSent: "Your note was sent to the coaching team.",
    noteFailed: "The note could not be sent. Please try again.",
    loadFailed: "The family dashboard could not be loaded.",
    retry: "Retry",
    otherEvent: "Other event",
    unknownStatus: "Unknown status",
    otherNote: "Family note",
    father: "Father",
    mother: "Mother",
    guardian: "Guardian",
    otherRelation: "Family",
  },
  ar: {
    eyebrow: "مركز متابعة الأسرة",
    title: "أهلا بعودتك، ولي الأمر",
    subtitle: "تابع كل لاعب مرتبط بحسابك، تواصل مع المدربين، وراقب الرحلة الأسبوعية من مكان واحد.",
    children: "اللاعبون المرتبطون",
    noChildren: "لا يوجد لاعبون مرتبطون بعد. اطلب من إدارة الأكاديمية ربط حساب ولي الأمر بلاعب.",
    attendance: "الحضور",
    training: "التدريب",
    matches: "المباريات",
    rating: "متوسط التقييم",
    goals: "الأهداف",
    assists: "التمريرات الحاسمة",
    minutes: "دقائق الأسبوع",
    discipline: "الانضباط",
    season: "هذا الموسم",
    coaches: "المدربون المسؤولون",
    messageCoach: "راسل المدرب",
    upcoming: "الجدول القادم",
    recentMatches: "آخر المباريات",
    evaluations: "تقييمات المدرب",
    attendanceLog: "سجل الحضور",
    parentNotes: "ملاحظات ولي الأمر",
    addNote: "إرسال ملاحظة",
    titlePlaceholder: "عنوان مختصر",
    bodyPlaceholder: "ماذا تريد أن يعرف المدرب؟",
    allCoaches: "كل المدربين المسؤولين",
    send: "إرسال الملاحظة",
    loading: "جاري تحميل لوحة الأسرة...",
    empty: "لا توجد بيانات بعد.",
    reviewed: "تمت المراجعة",
    resolved: "تم الحل",
    new: "جديدة",
    coachReply: "رد المدرب",
    viewCalendar: "فتح التقويم",
    viewMatches: "فتح المباريات",
    paymentAccess: "صلاحية المدفوعات",
    progressAccess: "صلاحية التقدم",
    weeklyReport: "التقرير الأسبوعي لولي الأمر",
    aiInsights: "نتائج الذكاء والتحليل",
    injuryRisk: "مخاطر الإصابة",
    aiEvaluation: "التقييم بالذكاء الاصطناعي",
    riskLevel: "مستوى الخطورة",
    riskScore: "درجة الخطورة",
    recommendation: "التوصية",
    noAiInsights: "لا توجد نتيجة ذكاء اصطناعي منشورة لهذا اللاعب حتى الآن.",
    ranking: "الترتيب",
    overallScore: "التقييم العام",
    aiBreakdown: "تفاصيل الذكاء",
    trend: "الاتجاه",
    model: "النموذج",
    highlights: "أبرز النقاط",
    actionItems: "خطوات مقترحة",
    payments: "المدفوعات",
    totalDue: "المستحق",
    paid: "المدفوع",
    latestInvoice: "آخر فاتورة",
    age: "العمر",
    group: "المجموعة",
    branch: "الفرع",
    relation: "صلة القرابة",
    code: "الكود",
    coach: "المدرب",
    trainingEvaluation: "تقييم التدريب",
    goalixVs: "جوليكس ضد",
    noProgressAccess: "صلاحية عرض التقدم غير مفعلة",
    noProgressAccessBody: "المدرب أو إدارة الأكاديمية هم من يحددون ظهور تقارير الأداء لحساب ولي الأمر.",
    parentObservation: "ملاحظة ولي الأمر",
    present: "حاضر",
    late: "متأخر",
    absent: "غائب",
    excused: "بعذر",
    trainingType: "تدريب",
    matchType: "مباراة",
    scheduled: "مجدول",
    completed: "مكتمل",
    finished: "منتهي",
    cancelled: "ملغي",
    postponed: "مؤجل",
    messageAccessDisabled: "التواصل مع المدرب غير مفعّل لهذا اللاعب.",
    messageAccessDisabledBody: "إدارة الأكاديمية هي التي تحدد إمكانية تواصل حساب ولي الأمر مع المدربين المسؤولين.",
    noteSent: "تم إرسال ملاحظتك إلى فريق التدريب.",
    noteFailed: "تعذر إرسال الملاحظة. حاول مرة أخرى.",
    loadFailed: "تعذر تحميل لوحة الأسرة.",
    retry: "إعادة المحاولة",
    otherEvent: "حدث آخر",
    unknownStatus: "حالة غير محددة",
    otherNote: "ملاحظة أسرية",
    father: "الأب",
    mother: "الأم",
    guardian: "ولي الأمر",
    otherRelation: "الأسرة",
  },
} as const;

type HomeCopy = Record<keyof typeof copy.en, string>;

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "goalix-dashboard-panel rounded-[20px] border border-[#2a4460]/80 bg-[#07172a]/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_44px_rgba(0,0,0,0.18)] md:p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}

function formatDate(value?: string | null, language: DashboardLanguage = "en") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-US", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function metricValue(value: number | null | undefined, suffix = "") {
  const number = Number(value || 0);
  return `${Number.isInteger(number) ? number : number.toFixed(1)}${suffix}`;
}

function childAge(dateOfBirth?: string | null) {
  if (!dateOfBirth) return "-";
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return "-";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return String(age);
}

function eventTypeLabel(type: string | null | undefined, t: HomeCopy) {
  if (type === "training") return t.trainingType;
  if (type === "match") return t.matchType;
  return type ? t.otherEvent : "-";
}

function statusLabel(status: string | null | undefined, t: HomeCopy) {
  if (!status) return "-";
  return t[status as "present" | "late" | "absent" | "excused" | "scheduled" | "completed" | "finished" | "cancelled" | "postponed"] || t.unknownStatus;
}

function noteCategoryLabel(category: string | null | undefined, t: HomeCopy) {
  if (category === "parent_observation") return t.parentObservation;
  return category ? t.otherNote : t.parentNotes;
}

function relationLabel(relation: string | null | undefined, t: HomeCopy) {
  if (!relation) return "-";
  return t[relation.toLowerCase() as "father" | "mother" | "guardian"] || t.otherRelation;
}

function formatScore(value: unknown, fallback = "-") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function resultNumber(result: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!result) return null;
  for (const key of keys) {
    const numeric = Number(result[key]);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function riskTone(level: unknown) {
  const normalized = String(level || "").toLowerCase();
  if (normalized === "high") {
    return {
      ring: "border-rose-400/35 bg-rose-400/10 text-rose-200",
      text: "text-rose-300",
    };
  }
  if (normalized === "medium") {
    return {
      ring: "border-amber-400/35 bg-amber-400/10 text-amber-100",
      text: "text-amber-300",
    };
  }
  return {
    ring: "border-lime-300/35 bg-lime-300/10 text-lime-100",
    text: "text-lime-300",
  };
}

function LockedProgressPanel({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#2a4460] bg-white/[0.035] p-6 text-center">
      <ShieldCheck className="h-10 w-10 text-lime-300" />
      <h3 className="mt-3 text-lg font-black text-white">{title}</h3>
      <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-slate-400">{body}</p>
    </div>
  );
}

export default function ParentHomePage() {
  const language = useDashboardLanguage();
  const t = copy[language];
  const { selectedChildId, setSelectedChildId } = useParentSelectedChild();
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [coachUserId, setCoachUserId] = useState("");
  const [noteNotice, setNoteNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { data, isLoading, isFetching, isError, refetch } = useGetParentDashboardQuery(
    selectedChildId ? { childId: selectedChildId } : undefined,
  );
  const [createNote, createNoteState] = useCreateParentChildNoteMutation();

  const child = data?.selectedChild ?? null;
  const progress = data?.progress ?? null;
  const aiInsights = data?.aiInsights ?? null;
  const injuryRisk = aiInsights?.injuryRisk?.prediction ?? null;
  const aiEvaluation = aiInsights?.aiEvaluation ?? null;
  const coachEvaluation = aiInsights?.coachEvaluation ?? null;
  const aiEvaluationScore = resultNumber(aiEvaluation?.result, [
    "score",
    "overall_score",
    "performance_score",
    "weekly_score",
  ]);
  const ranking = aiInsights?.ranking ?? null;
  const displayedEvaluationScore =
    aiEvaluationScore ??
    ranking?.breakdown?.ai_score ??
    ranking?.total_score ??
    coachEvaluation?.overall_rating ??
    null;
  const riskStyle = riskTone(injuryRisk?.risk_level);
  const canViewProgress = child?.can_view_progress !== false;
  const canMessageCoach = child?.can_message_coach !== false;
  const coaches = data?.coaches ?? child?.coaches ?? [];
  const childPhoto = "/Player.png";

  const metrics = useMemo(() => {
    const p = progress;
    return [
      {
        label: t.attendance,
        value: metricValue(p?.attendancePercentage, "%"),
        Icon: CalendarDays,
        tone: "lime" as const,
      },
      {
        label: t.training,
        value: metricValue(p?.trainingAttendancePercentage, "%"),
        Icon: ClipboardList,
        tone: "teal" as const,
      },
      {
        label: t.matches,
        value: metricValue(p?.matchAttendancePercentage, "%"),
        Icon: Trophy,
        tone: "cyan" as const,
      },
      {
        label: t.rating,
        value: metricValue(Math.max(Number(p?.averageTrainingRating || 0), Number(p?.averageMatchRating || 0))),
        Icon: Star,
        tone: "lime" as const,
      },
      { label: t.goals, value: metricValue(p?.goals), Icon: Goal, tone: "teal" as const },
      { label: t.assists, value: metricValue(p?.assists), Icon: Users, tone: "cyan" as const },
      { label: t.minutes, value: metricValue(p?.weeklyMinutesPlayed), Icon: CheckCircle2, tone: "lime" as const },
      {
        label: t.discipline,
        value: `${Number(p?.disciplineRecord?.yellowCards || 0)}/${Number(p?.disciplineRecord?.redCards || 0)}`,
        Icon: ShieldCheck,
        tone: "teal" as const,
      },
    ];
  }, [progress, t]);

  const weeklyHighlights = useMemo(() => {
    if (language !== "ar") return data?.weeklyReport?.highlights ?? [];
    const report = data?.weeklyReport;
    if (!report) return [];
    return [
      `نسبة الحضور الأخيرة ${report.attendanceRate || 0}%`,
      report.latestEvaluation
        ? `آخر تقييم منشور من المدرب ${metricValue(Number(report.latestEvaluation.overall_rating || 0))}`
        : "لا يوجد تقييم جديد منشور من المدرب حتى الآن",
      `يوجد ${report.recentMatches?.length || 0} مباراة ظاهرة في التقرير`,
    ];
  }, [data?.weeklyReport, language]);

  const weeklyActionItems = useMemo(() => {
    if (language !== "ar") return data?.weeklyReport?.actionItems ?? [];
    const report = data?.weeklyReport;
    if (!report) return [];
    const items: string[] = [];
    if ((report.attendanceRate || 0) < 85) items.push("راجع انتظام الحضور مع المدرب");
    if (!report.latestEvaluation) items.push("اسأل المدرب عن موعد نشر التقييم القادم");
    if (report.recentNotes?.some((note) => note.status === "new")) items.push("تابع الملاحظات المفتوحة مع المدرب");
    return items.length ? items : ["استمر على نفس الروتين وراقب تغيرات الأسبوع القادم"];
  }, [data?.weeklyReport, language]);

  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!child?.id || !canMessageCoach || !noteBody.trim()) return;
    setNoteNotice(null);
    try {
      await createNote({
        childId: child.id,
        body: {
          coachUserId: coachUserId || undefined,
          category: "parent_observation",
          title: noteTitle.trim() || undefined,
          body: noteBody.trim(),
        },
      }).unwrap();
      setNoteTitle("");
      setNoteBody("");
      setCoachUserId("");
      setNoteNotice({ type: "success", text: t.noteSent });
    } catch {
      setNoteNotice({ type: "error", text: t.noteFailed });
    }
  }

  if (isLoading) {
    return (
      <Panel className="grid min-h-[420px] place-items-center text-center">
        <div>
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-lime-300" />
          <p className="mt-4 font-black text-slate-300">{t.loading}</p>
        </div>
      </Panel>
    );
  }

  if (isError) {
    return (
      <Panel className="grid min-h-[420px] place-items-center text-center">
        <div>
          <ShieldCheck className="mx-auto h-11 w-11 text-rose-400" />
          <p className="mt-4 font-black text-slate-300">{t.loadFailed}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-5 min-h-11 rounded-2xl bg-gradient-to-r from-[#51b848] to-[#2d9ad5] px-5 font-black text-[#06111f]"
          >
            {t.retry}
          </button>
        </div>
      </Panel>
    );
  }

  if (!child) {
    return (
      <Panel className="grid min-h-[420px] place-items-center text-center">
        <div className="max-w-xl">
          <UserRound className="mx-auto h-12 w-12 text-lime-300" />
          <h1 className="mt-4 font-display text-4xl font-black text-white">{t.children}</h1>
          <p className="mt-3 text-base font-semibold text-slate-400">{t.noChildren}</p>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-lime-300">{t.eyebrow}</p>
          <h1 className="mt-2 font-display text-5xl font-black leading-none text-white md:text-6xl">
            {t.title}
          </h1>
          <p className="mt-3 max-w-3xl text-base font-semibold leading-7 text-slate-300">
            {t.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {data?.children?.map((item: ParentChild) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedChildId(item.id)}
              className={cn(
                "min-h-12 rounded-2xl border px-4 text-sm font-black transition",
                item.id === child.id
                  ? "border-lime-300/40 bg-lime-300 text-[#06111f] shadow-[0_14px_26px_rgba(178,210,59,0.24)]"
                  : "border-[#2a4460] bg-white/[0.035] text-slate-200",
              )}
            >
              {item.full_name}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.86fr_1.5fr_0.84fr]">
        <Panel className="goalix-dashboard-photo-card overflow-hidden p-0 xl:row-span-2">
          <div className="relative min-h-[390px] p-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_20%,rgba(178,210,59,0.28),transparent_28%),linear-gradient(180deg,rgba(6,17,31,0),#07172a_92%)]" />
            <Image
              src={childPhoto}
              alt={child.full_name}
              fill
              sizes="(max-width: 768px) 100vw, 380px"
              className="object-cover object-center opacity-82 mix-blend-screen"
              priority
            />
            <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#07172a] to-transparent" />
            <div className="absolute bottom-5 left-5 right-5">
              <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-lime-300/35 bg-[#07111f]/85 text-center">
                <span className="text-xs font-black text-slate-300">{t.age}</span>
                <strong className="font-display text-3xl text-lime-300">{childAge(child.date_of_birth)}</strong>
              </div>
              <h2 className="text-3xl font-black text-white">{child.full_name}</h2>
              <p className="mt-1 font-semibold text-slate-300">
                <span className="text-lime-300">{child.level || "GOALIX"}</span>
                {" - "}
                {child.position || child.group_name || "-"}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#2a4460] pt-4 text-sm sm:grid-cols-4">
                <div><p className="text-slate-400">{t.group}</p><strong>{child.group_name || "-"}</strong></div>
                <div><p className="text-slate-400">{t.branch}</p><strong>{child.branch_name || "-"}</strong></div>
                <div><p className="text-slate-400">{t.relation}</p><strong>{relationLabel(child.relation, t)}</strong></div>
                <div><p className="text-slate-400">{t.code}</p><strong>{child.player_code || "-"}</strong></div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel className={canViewProgress ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-4" : ""}>
          {canViewProgress ? (
            metrics.map(({ label, value, Icon, tone }) => (
              <div key={label} className="rounded-2xl border border-[#2a4460] bg-white/[0.035] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-400">{label}</p>
                    <strong className="mt-2 block font-display text-4xl text-white">{value}</strong>
                  </div>
                  <span
                    className={cn(
                      "grid h-11 w-11 place-items-center rounded-2xl",
                      tone === "cyan"
                        ? "bg-cyan-300/15 text-cyan-300"
                        : tone === "teal"
                          ? "bg-teal-300/15 text-teal-300"
                          : "bg-lime-300/15 text-lime-300",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-3 text-xs font-black text-slate-500">{t.season}</p>
              </div>
            ))
          ) : (
            <LockedProgressPanel title={t.noProgressAccess} body={t.noProgressAccessBody} />
          )}
        </Panel>

        <Panel>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-black text-white">{t.coaches}</h2>
              <p className="text-sm font-semibold text-slate-400">{child.full_name}</p>
            </div>
            {canMessageCoach && (
              <Link
                href="/parent/chat"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#51b848] to-[#2d9ad5] px-4 text-sm font-black text-[#06111f]"
              >
                <MessageSquare className="h-4 w-4" />
                {t.messageCoach}
              </Link>
            )}
          </div>
          <div className="mt-4 grid gap-3">
            {coaches.map((coach) => (
              <div key={coach.user_id} className="flex items-center gap-3 rounded-2xl border border-[#2a4460] bg-white/[0.035] p-3">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-lime-300 text-[#06111f] font-black">
                  {coach.full_name?.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-white">{coach.full_name}</p>
                  <p className="truncate text-sm font-semibold text-slate-400">{coach.specialization || t.coach}</p>
                </div>
              </div>
            ))}
            {!coaches.length && <p className="rounded-2xl border border-dashed border-[#2a4460] p-4 text-sm font-bold text-slate-400">{t.empty}</p>}
            {!canMessageCoach && (
              <div className="rounded-2xl border border-dashed border-amber-400/30 bg-amber-400/10 p-4">
                <p className="font-black text-amber-300">{t.messageAccessDisabled}</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-400">
                  {t.messageAccessDisabledBody}
                </p>
              </div>
            )}
          </div>
        </Panel>

        <Panel className="xl:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-black text-white">{t.upcoming}</h2>
            <Link href="/parent/calendar" className="text-sm font-black text-lime-300">{t.viewCalendar}</Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(data?.calendarEvents?.data ?? []).slice(0, 6).map((event: CalendarEvent) => (
              <div key={event.id} className="rounded-2xl border border-[#2a4460] bg-white/[0.035] p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-lime-300">{eventTypeLabel(event.event_type, t)}</p>
                <h3 className="mt-2 font-black text-white">{event.title}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-400">{formatDate(event.start_datetime, language)}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">{event.location || "-"}</p>
              </div>
            ))}
            {!(data?.calendarEvents?.data ?? []).length && <p className="rounded-2xl border border-dashed border-[#2a4460] p-5 text-sm font-bold text-slate-400">{t.empty}</p>}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-lime-300">
                {t.aiInsights}
              </p>
              <h2 className="mt-1 font-display text-2xl font-black text-white">
                {t.injuryRisk}
              </h2>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-lime-300/15 text-lime-300">
              <Activity className="h-6 w-6" />
            </span>
          </div>
          {!canViewProgress ? (
            <LockedProgressPanel title={t.noProgressAccess} body={t.noProgressAccessBody} />
          ) : injuryRisk ? (
            <div className={cn("rounded-2xl border p-5", riskStyle.ring)}>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-slate-300">{t.riskLevel}</p>
                  <strong className={cn("mt-1 block font-display text-4xl", riskStyle.text)}>
                    {injuryRisk.risk_level || "-"}
                  </strong>
                </div>
                <div className="text-end">
                  <p className="text-sm font-black text-slate-300">{t.riskScore}</p>
                  <strong className="mt-1 block font-display text-4xl text-white">
                    {formatScore(injuryRisk.risk_percentage)}%
                  </strong>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-[#2a4460] bg-[#06111f]/70 p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-300">
                  {t.recommendation}
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">
                  {injuryRisk.recommendation || t.empty}
                </p>
              </div>
              <p className="mt-3 text-xs font-black text-slate-500">
                {aiInsights?.injuryRisk?.model_version || t.aiEvaluation}
                {" - "}
                {formatDate(aiInsights?.injuryRisk?.created_at, language)}
              </p>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-[#2a4460] p-5 text-sm font-bold text-slate-400">
              {t.noAiInsights}
            </p>
          )}
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-300">
                {t.ranking}
              </p>
              <h2 className="mt-1 font-display text-2xl font-black text-white">
                {t.aiEvaluation}
              </h2>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300/15 text-cyan-300">
              <BrainCircuit className="h-6 w-6" />
            </span>
          </div>
          {!canViewProgress ? (
            <LockedProgressPanel title={t.noProgressAccess} body={t.noProgressAccessBody} />
          ) : aiEvaluation || ranking || coachEvaluation ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#2a4460] bg-white/[0.035] p-4">
                <p className="text-xs font-black text-slate-400">{t.overallScore}</p>
                <strong className="mt-2 block font-display text-4xl text-white">
                  {formatScore(displayedEvaluationScore)}
                </strong>
              </div>
              <div className="rounded-2xl border border-[#2a4460] bg-white/[0.035] p-4">
                <p className="text-xs font-black text-slate-400">{t.ranking}</p>
                <strong className="mt-2 block font-display text-4xl text-lime-300">
                  {ranking?.rank ? `#${ranking.rank}` : "-"}
                </strong>
              </div>
              <div className="rounded-2xl border border-[#2a4460] bg-white/[0.035] p-4">
                <p className="text-xs font-black text-slate-400">{t.aiBreakdown}</p>
                <strong className="mt-2 block font-display text-4xl text-cyan-300">
                  {formatScore(ranking?.breakdown?.ai_score)}
                </strong>
              </div>
              <div className="rounded-2xl border border-[#2a4460] bg-[#06111f]/70 p-4 sm:col-span-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-black text-slate-500">{t.season}</p>
                    <p className="mt-1 font-black text-slate-200">
                      {ranking?.period || formatDate(coachEvaluation?.start_datetime, language)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-500">{t.trend}</p>
                    <p className="mt-1 font-black text-slate-200">
                      {ranking?.trend || coachEvaluation?.event_title || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-500">{t.model}</p>
                    <p className="mt-1 font-black text-slate-200">
                      {aiEvaluation?.model_version || coachEvaluation?.coach_name || t.coach}
                    </p>
                  </div>
                </div>
                {(coachEvaluation?.coach_notes || coachEvaluation?.improvement_plan) && (
                  <div className="mt-4 rounded-2xl border border-[#2a4460] bg-white/[0.035] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-lime-300">
                      {t.coachReply}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-200">
                      {coachEvaluation.coach_notes || coachEvaluation.improvement_plan}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-[#2a4460] p-5 text-sm font-bold text-slate-400">
              {t.noAiInsights}
            </p>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
        <Panel>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-black text-white">{t.recentMatches}</h2>
            <Link href="/parent/matches" className="text-sm font-black text-lime-300">{t.viewMatches}</Link>
          </div>
          <div className="grid gap-3">
            {(data?.matches?.data ?? []).slice(0, 4).map((match: Match) => (
              <div key={match.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#2a4460] bg-white/[0.035] p-4">
                <div>
                  <p className="font-black text-white">{t.goalixVs} {match.opponent_name}</p>
                  <p className="text-sm font-semibold text-slate-400">{match.match_date} - {match.location || "-"}</p>
                </div>
                <strong className="font-display text-3xl text-lime-300">
                  {match.our_score ?? "-"} - {match.opponent_score ?? "-"}
                </strong>
              </div>
            ))}
            {!(data?.matches?.data ?? []).length && <p className="rounded-2xl border border-dashed border-[#2a4460] p-5 text-sm font-bold text-slate-400">{t.empty}</p>}
          </div>
        </Panel>

        <Panel>
          <h2 className="font-display text-2xl font-black text-white">{t.evaluations}</h2>
          {!canViewProgress ? (
            <div className="mt-4">
              <LockedProgressPanel title={t.noProgressAccess} body={t.noProgressAccessBody} />
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {(data?.evaluations?.data ?? []).slice(0, 4).map((evaluation: PlayerEvaluationRecord) => (
                <div key={evaluation.id} className="rounded-2xl border border-[#2a4460] bg-white/[0.035] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-white">{evaluation.title || t.trainingEvaluation}</p>
                    <span className="rounded-full bg-lime-300/15 px-3 py-1 text-xs font-black text-lime-300">
                      {metricValue(Number(evaluation.overall_rating || 0))}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-400">{formatDate(evaluation.start_datetime, language)}</p>
                  <p className="mt-3 line-clamp-3 text-sm font-semibold leading-6 text-slate-300">
                    {evaluation.coach_notes || evaluation.improvement_plan || t.empty}
                  </p>
                </div>
              ))}
              {!(data?.evaluations?.data ?? []).length && <p className="rounded-2xl border border-dashed border-[#2a4460] p-5 text-sm font-bold text-slate-400">{t.empty}</p>}
            </div>
          )}
        </Panel>

        <Panel>
          <h2 className="font-display text-2xl font-black text-white">{t.attendanceLog}</h2>
          <div className="mt-4 grid gap-3">
            {(data?.attendance?.data ?? []).slice(0, 6).map((record: PlayerAttendanceRecord) => (
              <div key={record.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#2a4460] bg-white/[0.035] p-3">
                <div>
                  <p className="font-black text-white">{record.title || record.opponent_name || eventTypeLabel(record.record_type, t)}</p>
                  <p className="text-xs font-semibold text-slate-400">{formatDate(record.start_datetime || record.match_date, language)}</p>
                </div>
                <span className="rounded-full border border-lime-300/25 px-3 py-1 text-xs font-black text-lime-300">
                  {statusLabel(record.status, t)}
                </span>
              </div>
            ))}
            {!(data?.attendance?.data ?? []).length && <p className="rounded-2xl border border-dashed border-[#2a4460] p-5 text-sm font-bold text-slate-400">{t.empty}</p>}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-lime-300/15 text-lime-300">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-2xl font-black text-white">{t.weeklyReport}</h2>
              <p className="text-sm font-semibold text-slate-400">
                {canViewProgress && data?.weeklyReport?.generatedAt
                  ? formatDate(data.weeklyReport.generatedAt, language)
                  : t.empty}
              </p>
            </div>
          </div>
          {!canViewProgress ? (
            <LockedProgressPanel title={t.noProgressAccess} body={t.noProgressAccessBody} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[#2a4460] bg-white/[0.035] p-4">
                <p className="mb-3 text-sm font-black text-lime-300">{t.highlights}</p>
                <ul className="grid gap-2 text-sm font-semibold leading-6 text-slate-300">
                  {weeklyHighlights.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-[#2a4460] bg-white/[0.035] p-4">
                <p className="mb-3 text-sm font-black text-cyan-300">{t.actionItems}</p>
                <ul className="grid gap-2 text-sm font-semibold leading-6 text-slate-300">
                  {weeklyActionItems.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-cyan-300/15 text-cyan-300">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-2xl font-black text-white">{t.payments}</h2>
              <p className="text-sm font-semibold text-slate-400">
                {data?.payments?.currentSubscription?.plan || t.empty}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#2a4460] bg-white/[0.035] p-4">
              <p className="text-xs font-black text-slate-400">{t.totalDue}</p>
              <strong className="mt-2 block font-display text-3xl text-lime-300">
                {Math.round(data?.payments?.totals?.due ?? 0)}
              </strong>
            </div>
            <div className="rounded-2xl border border-[#2a4460] bg-white/[0.035] p-4">
              <p className="text-xs font-black text-slate-400">{t.paid}</p>
              <strong className="mt-2 block font-display text-3xl text-cyan-300">
                {Math.round(data?.payments?.totals?.paid ?? 0)}
              </strong>
            </div>
            <div className="rounded-2xl border border-[#2a4460] bg-white/[0.035] p-4">
              <p className="text-xs font-black text-slate-400">{t.latestInvoice}</p>
              <strong className="mt-2 block font-display text-2xl text-white">
                {data?.payments?.invoices?.[0]?.status || "-"}
              </strong>
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <h2 className="font-display text-2xl font-black text-white">{t.addNote}</h2>
          {!canMessageCoach ? (
            <div className="mt-4">
              <LockedProgressPanel
                title={t.messageAccessDisabled}
                body={t.messageAccessDisabledBody}
              />
            </div>
          ) : (
          <form onSubmit={submitNote} className="mt-4 grid gap-3">
            <label className="sr-only" htmlFor="parent-note-coach">{t.coach}</label>
            <select
              id="parent-note-coach"
              value={coachUserId}
              onChange={(event) => setCoachUserId(event.target.value)}
              className="h-12 rounded-2xl border border-[#2a4460] bg-[#06111f]/86 px-4 text-sm font-black text-slate-100 outline-none"
            >
              <option value="">{t.allCoaches}</option>
              {coaches.map((coach) => (
                <option key={coach.user_id} value={coach.user_id}>{coach.full_name}</option>
              ))}
            </select>
            <label className="sr-only" htmlFor="parent-note-title">{t.titlePlaceholder}</label>
            <input
              id="parent-note-title"
              value={noteTitle}
              onChange={(event) => setNoteTitle(event.target.value)}
              maxLength={160}
              placeholder={t.titlePlaceholder}
              className="h-12 rounded-2xl border border-[#2a4460] bg-[#06111f]/86 px-4 text-sm font-black text-slate-100 outline-none placeholder:text-slate-500"
            />
            <label className="sr-only" htmlFor="parent-note-body">{t.bodyPlaceholder}</label>
            <textarea
              id="parent-note-body"
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              rows={4}
              maxLength={3000}
              placeholder={t.bodyPlaceholder}
              className="min-h-32 resize-none rounded-2xl border border-[#2a4460] bg-[#06111f]/86 px-4 py-3 text-sm font-semibold leading-7 text-slate-100 outline-none placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={!noteBody.trim() || createNoteState.isLoading}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#51b848] to-[#2d9ad5] px-5 font-black text-[#06111f] disabled:opacity-60"
            >
              {createNoteState.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t.send}
            </button>
            {noteNotice && (
              <p
                role="status"
                aria-live="polite"
                className={cn(
                  "rounded-2xl border px-4 py-3 text-sm font-black",
                  noteNotice.type === "success"
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                    : "border-rose-400/30 bg-rose-400/10 text-rose-300",
                )}
              >
                {noteNotice.text}
              </p>
            )}
          </form>
          )}
        </Panel>

        <Panel>
          <h2 className="font-display text-2xl font-black text-white">{t.parentNotes}</h2>
          <div className="mt-4 grid gap-3">
            {(data?.notes?.data ?? []).map((note) => (
              <article key={note.id} className="rounded-2xl border border-[#2a4460] bg-white/[0.035] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-lime-300">{noteCategoryLabel(note.category, t)}</p>
                    <h3 className="mt-1 font-black text-white">{note.title || t.parentNotes}</h3>
                  </div>
                  <span className="rounded-full border border-lime-300/25 px-3 py-1 text-xs font-black text-lime-300">
                    {t[note.status as "new" | "reviewed" | "resolved"]}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-300">{note.body}</p>
                {note.coach_response && (
                  <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3 text-sm font-semibold text-cyan-100">
                    <strong className="mb-1 block text-cyan-300">{t.coachReply}</strong>
                    {note.coach_response}
                  </div>
                )}
              </article>
            ))}
            {!(data?.notes?.data ?? []).length && <p className="rounded-2xl border border-dashed border-[#2a4460] p-5 text-sm font-bold text-slate-400">{t.empty}</p>}
          </div>
        </Panel>
      </section>

      {isFetching && (
        <div className="fixed bottom-5 right-5 z-50 rounded-full border border-lime-300/30 bg-[#06111f]/90 px-4 py-2 text-sm font-black text-lime-300 shadow-xl">
          {t.loading}
        </div>
      )}
    </div>
  );
}
