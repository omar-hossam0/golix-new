"use client";

import type { ComponentType } from "react";
import Image from "next/image";
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Footprints,
  Heart,
  IdCard,
  Loader2,
  MapPin,
  Phone,
  QrCode,
  ShieldCheck,
  Trophy,
  User,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  useGetPlayerAttendanceQrQuery,
  useGetPlayerProfileQuery,
  useGetPlayerProgressQuery,
} from "@/lib/store/api/calendarApi";
import type { PlayerProfile } from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { cn, formatDate, formatDateTime } from "@/lib/utils";

type IconType = ComponentType<{ className?: string }>;

interface InfoItem {
  label: string;
  value: string | null;
  icon: IconType;
}

const normalizeKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const compactKey = (value: string) => normalizeKey(value).replace(/_/g, "");

const titleCase = (value: string | null | undefined) =>
  (value || "Not set")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const textValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return formatDateTime(value);
  if (Array.isArray(value)) {
    const values = value.map(textValue).filter(Boolean);
    return values.length ? values.join(", ") : null;
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
  }
  return null;
};

const numberValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const safeDate = (value: unknown) => {
  const text = textValue(value);
  if (!text) return "Not set";
  const timestamp = Date.parse(text);
  return Number.isNaN(timestamp) ? text : formatDate(text);
};

const safeDateTime = (value: unknown) => {
  const text = textValue(value);
  if (!text) return "Not set";
  const timestamp = Date.parse(text);
  return Number.isNaN(timestamp) ? text : formatDateTime(text);
};

const ageFromBirthDate = (value: unknown) => {
  const text = textValue(value);
  if (!text) return null;
  const birthDate = new Date(text);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }
  return age >= 0 ? String(age) : null;
};

const profileValue = (
  profile: PlayerProfile | undefined,
  keys: string[],
): string | null => {
  if (!profile) return null;
  const normalizedKeys = new Set(keys.map(normalizeKey));
  const compactKeys = new Set(keys.map(compactKey));

  for (const [key, value] of Object.entries(profile as Record<string, unknown>)) {
    if (
      normalizedKeys.has(normalizeKey(key)) ||
      compactKeys.has(compactKey(key))
    ) {
      const text = textValue(value);
      if (text) return text;
    }
  }

  for (const field of profile.customProfile ?? []) {
    if (
      normalizedKeys.has(normalizeKey(field.key)) ||
      normalizedKeys.has(normalizeKey(field.label)) ||
      compactKeys.has(compactKey(field.key)) ||
      compactKeys.has(compactKey(field.label))
    ) {
      const text = textValue(field.value);
      if (text) return text;
    }
  }

  return null;
};

const percentText = (value: unknown) => {
  const numeric = numberValue(value);
  return numeric === null ? "0%" : `${Math.round(numeric)}%`;
};

const numberText = (value: unknown) => {
  const numeric = numberValue(value);
  return numeric === null ? "0" : String(Math.round(numeric));
};

const ratingText = (value: unknown) => {
  const numeric = numberValue(value);
  if (numeric === null) return "N/A";
  return `${Number.isInteger(numeric) ? numeric : numeric.toFixed(1)}/10`;
};

const progressValue = (value: unknown, multiplier = 1) => {
  const numeric = numberValue(value);
  if (numeric === null) return 0;
  return Math.max(0, Math.min(100, numeric * multiplier));
};

const profileStatusVariant = (status: string | null | undefined) =>
  status === "complete" ? ("success" as const) : ("warning" as const);

const profileCopy = {
  en: {
    player: "Player",
    notSet: "Not set",
    title: "My Profile",
    description: "Your full live player profile from the academy database.",
    home: "Home",
    profile: "Profile",
    loadWarning:
      "Some profile data could not load from the backend. Anything shown here is still live data that was available.",
    loading: "Loading your full player profile...",
    noAssignment: "No academy assignment set",
    code: "Code",
    age: "Age",
    foot: "Foot",
    level: "Level",
    attendance: "Attendance",
    training: "Training",
    matches: "Matches",
    complete: "Complete",
    incomplete: "Incomplete",
    profileCompletion: "Profile Completion",
    trainingsAttended: "Trainings Attended",
    fromLiveAttendance: "From live attendance",
    matchesPlayed: "Matches Played",
    goals: "goals",
    assists: "assists",
    monthlyMinutes: "Monthly Minutes",
    personalData: "Personal Data",
    academyData: "Academy Data",
    attendanceQr: "Attendance QR",
    loadingQr: "Loading QR...",
    qrUnavailable: "Attendance QR is not available yet.",
    contactData: "Contact Data",
    completeFields: "Complete Profile Fields",
    noCompleteFields:
      "No complete profile fields have been filled for this player yet.",
    progressSummary: "Progress Summary",
    monthlySummary: "Monthly Progress Summary",
    noMonthlySummary: "No monthly progress summary has been generated yet.",
    coachNotes: "Coach Profile Notes",
    additionalDetails: "Additional Details",
    noAdditionalDetails: "No additional profile details are available yet.",
    labels: {
      fullName: "Full Name",
      playerCode: "Player Code",
      dateOfBirth: "Date of Birth",
      mainPosition: "Main Position",
      preferredFoot: "Preferred Foot",
      height: "Height",
      weight: "Weight",
      branch: "Branch",
      group: "Group",
      profileStatus: "Profile Status",
      completedAt: "Completed At",
      joined: "Joined",
      createdAt: "Created At",
      username: "Username",
      accountPhone: "Account Phone",
      playerPhone: "Player Phone",
      guardianName: "Guardian Name",
      guardianPhone: "Guardian Phone",
      address: "Address",
      gender: "Gender",
      nationality: "Nationality",
      guardianRelation: "Guardian Relation",
      latestMeasurement: "Latest Measurement",
      bmi: "BMI",
      strengths: "Strengths",
      weaknesses: "Weaknesses",
      coachNotes: "Coach Notes",
      improvementNotes: "Improvement Notes",
      developmentPlan: "Development Plan",
      recommendedPosition: "Recommended Position",
      finalNotes: "Final Notes",
      medicalNotes: "Medical Notes",
      injuryHistory: "Injury History",
      generalNotes: "General Notes",
      trainingAttendance: "Training Attendance",
      matchAttendance: "Match Attendance",
      averageTraining: "Average Training",
      averageMatch: "Average Match",
      yellowCards: "Yellow Cards",
      redCards: "Red Cards",
    },
  },
  ar: {
    player: "لاعب",
    notSet: "غير محدد",
    title: "ملفي الشخصي",
    description: "ملفك الكامل المباشر من قاعدة بيانات الأكاديمية.",
    home: "الرئيسية",
    profile: "الملف الشخصي",
    loadWarning:
      "تعذر تحميل بعض بيانات الملف الشخصي من الباك إند. أي بيانات ظاهرة هنا هي بيانات مباشرة كانت متاحة.",
    loading: "جاري تحميل ملف اللاعب الكامل...",
    noAssignment: "لا يوجد تعيين أكاديمي",
    code: "الكود",
    age: "العمر",
    foot: "القدم",
    level: "المستوى",
    attendance: "الحضور",
    training: "التدريب",
    matches: "المباريات",
    complete: "مكتمل",
    incomplete: "غير مكتمل",
    profileCompletion: "اكتمال الملف",
    trainingsAttended: "التدريبات التي حضرتها",
    fromLiveAttendance: "من الحضور المباشر",
    matchesPlayed: "المباريات الملعوبة",
    goals: "أهداف",
    assists: "تمريرات حاسمة",
    monthlyMinutes: "دقائق الشهر",
    personalData: "البيانات الشخصية",
    academyData: "بيانات الأكاديمية",
    attendanceQr: "QR الحضور",
    loadingQr: "جاري تحميل QR...",
    qrUnavailable: "QR الحضور غير متاح حتى الآن.",
    contactData: "بيانات التواصل",
    completeFields: "حقول الملف المكتملة",
    noCompleteFields: "لا توجد حقول ملف مكتملة لهذا اللاعب حتى الآن.",
    progressSummary: "ملخص التقدم",
    monthlySummary: "ملخص التقدم الشهري",
    noMonthlySummary: "لم يتم إنشاء ملخص تقدم شهري حتى الآن.",
    coachNotes: "ملاحظات المدرب في الملف",
    additionalDetails: "تفاصيل إضافية",
    noAdditionalDetails: "لا توجد تفاصيل إضافية متاحة حتى الآن.",
    labels: {
      fullName: "الاسم الكامل",
      playerCode: "كود اللاعب",
      dateOfBirth: "تاريخ الميلاد",
      mainPosition: "المركز الأساسي",
      preferredFoot: "القدم المفضلة",
      height: "الطول",
      weight: "الوزن",
      branch: "الفرع",
      group: "المجموعة",
      profileStatus: "حالة الملف",
      completedAt: "اكتمل في",
      joined: "تاريخ الانضمام",
      createdAt: "تاريخ الإنشاء",
      username: "اسم المستخدم",
      accountPhone: "هاتف الحساب",
      playerPhone: "هاتف اللاعب",
      guardianName: "اسم ولي الأمر",
      guardianPhone: "هاتف ولي الأمر",
      address: "العنوان",
      gender: "الجنس",
      nationality: "الجنسية",
      guardianRelation: "صلة ولي الأمر",
      latestMeasurement: "آخر قياس",
      bmi: "مؤشر كتلة الجسم",
      strengths: "نقاط القوة",
      weaknesses: "نقاط الضعف",
      coachNotes: "ملاحظات المدرب",
      improvementNotes: "ملاحظات التحسين",
      developmentPlan: "خطة التطوير",
      recommendedPosition: "المركز المقترح",
      finalNotes: "ملاحظات نهائية",
      medicalNotes: "ملاحظات طبية",
      injuryHistory: "تاريخ الإصابات",
      generalNotes: "ملاحظات عامة",
      trainingAttendance: "حضور التدريب",
      matchAttendance: "حضور المباريات",
      averageTraining: "متوسط التدريب",
      averageMatch: "متوسط المباراة",
      yellowCards: "بطاقات صفراء",
      redCards: "بطاقات حمراء",
    },
  },
} as const;

function InfoRow({ label, value, icon: Icon, fallback = "Not set" }: InfoItem & { fallback?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.035] px-3 py-2">
      <span className="flex min-w-0 items-center gap-2 text-sm text-slate-400">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <span className="max-w-[60%] break-words text-right text-sm font-medium text-slate-100">
        {value || fallback}
      </span>
    </div>
  );
}

function FieldTile({ label, value, fallback = "Not set" }: { label: string; value: string | null; fallback?: string }) {
  return (
    <div className="rounded-lg bg-white/[0.035] p-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-2 break-words text-sm leading-6 text-slate-100">
        {value || fallback}
      </p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}

export default function PlayerProfilePage() {
  const language = useDashboardLanguage();
  const copy = profileCopy[language];
  const profileQuery = useGetPlayerProfileQuery();
  const progressQuery = useGetPlayerProgressQuery();
  const attendanceQrQuery = useGetPlayerAttendanceQrQuery();

  const profile = profileQuery.data;
  const progress = progressQuery.data;
  const attendanceQr = attendanceQrQuery.data;
  const isLoading = profileQuery.isLoading || progressQuery.isLoading;
  const hasError = profileQuery.isError;

  const playerName = profile?.full_name || progress?.playerName || copy.player;
  const mainPosition =
    profileValue(profile, ["main_position", "main position"]) ||
    profile?.position ||
    null;
  const preferredFoot = profileValue(profile, ["preferred_foot", "preferred foot"]);
  const latestMeasurement = profile?.latestMeasurement as
    | Record<string, unknown>
    | null
    | undefined;
  const height =
    profileValue(profile, ["height", "height_cm", "height cm"]) ||
    textValue(latestMeasurement?.height_cm);
  const weight =
    profileValue(profile, ["weight", "weight_kg", "weight kg"]) ||
    textValue(latestMeasurement?.weight_kg);
  const age = ageFromBirthDate(profile?.date_of_birth);
  const photoSrc = "/Player.png";
  const customFields = (profile?.customProfile ?? []).filter((field) =>
    textValue(field.value),
  );

  const personalInfo: InfoItem[] = [
    { label: copy.labels.fullName, value: profile?.full_name || null, icon: User },
    { label: copy.labels.playerCode, value: textValue(profile?.player_code), icon: IdCard },
    { label: copy.labels.dateOfBirth, value: safeDate(profile?.date_of_birth), icon: Calendar },
    { label: copy.age, value: age, icon: Clock },
    { label: copy.labels.mainPosition, value: mainPosition, icon: ShieldCheck },
    { label: copy.labels.preferredFoot, value: preferredFoot, icon: Footprints },
    { label: copy.level, value: titleCase(profile?.level || copy.notSet), icon: Trophy },
    { label: copy.labels.height, value: height, icon: Activity },
    { label: copy.labels.weight, value: weight, icon: Heart },
  ];

  const academyInfo: InfoItem[] = [
    { label: copy.labels.branch, value: profile?.branch_name || null, icon: MapPin },
    { label: copy.labels.group, value: profile?.group_name || null, icon: User },
    { label: copy.labels.profileStatus, value: profile?.profile_status === "complete" ? copy.complete : copy.incomplete, icon: CheckCircle2 },
    {
      label: copy.labels.completedAt,
      value: safeDateTime(profile?.profile_completed_at),
      icon: Calendar,
    },
    { label: copy.labels.joined, value: safeDate(profile?.date_joined), icon: Calendar },
    { label: copy.labels.createdAt, value: safeDateTime(profile?.created_at), icon: Clock },
  ];

  const contactInfo: InfoItem[] = [
    { label: copy.labels.username, value: profile?.username || null, icon: User },
    { label: copy.labels.accountPhone, value: profile?.account_phone || null, icon: Phone },
    { label: copy.labels.playerPhone, value: profile?.phone || null, icon: Phone },
    { label: copy.labels.guardianName, value: profile?.guardian_name || null, icon: Heart },
    { label: copy.labels.guardianPhone, value: profile?.guardian_phone || null, icon: Phone },
  ];

  const additionalFields = [
    { label: copy.labels.address, value: textValue(profile?.address) },
    { label: copy.labels.gender, value: titleCase(textValue(profile?.gender) || copy.notSet) },
    { label: copy.labels.nationality, value: textValue(profile?.nationality) },
    {
      label: copy.labels.guardianRelation,
      value: titleCase(textValue(profile?.guardian_relation) || copy.notSet),
    },
    {
      label: copy.labels.latestMeasurement,
      value: safeDate(latestMeasurement?.measured_at),
    },
    { label: copy.labels.bmi, value: textValue(latestMeasurement?.bmi) },
  ].filter((field) => field.value && field.value !== "Not set" && field.value !== copy.notSet);

  const profileNotes = [
    { label: copy.labels.strengths, value: profileValue(profile, ["strengths"]) },
    { label: copy.labels.weaknesses, value: profileValue(profile, ["weaknesses"]) },
    {
      label: copy.labels.coachNotes,
      value: profileValue(profile, ["coach_notes", "coach notes", "coachNotes"]),
    },
    {
      label: copy.labels.improvementNotes,
      value: profileValue(profile, [
        "improvement_notes",
        "improvement notes",
        "improvementNotes",
      ]),
    },
    {
      label: copy.labels.developmentPlan,
      value: profileValue(profile, [
        "development_plan",
        "development plan",
        "developmentPlan",
      ]),
    },
    {
      label: copy.labels.recommendedPosition,
      value: profileValue(profile, [
        "recommended_position",
        "recommended position",
        "recommendedPosition",
      ]),
    },
    {
      label: copy.labels.finalNotes,
      value: profileValue(profile, ["final_notes", "final notes", "coachFinalNotes"]),
    },
    {
      label: copy.labels.medicalNotes,
      value: profileValue(profile, ["medical_notes", "medical notes", "medicalNotes"]),
    },
    {
      label: copy.labels.injuryHistory,
      value: profileValue(profile, ["injury_history", "injury history", "injuryHistory"]),
    },
    {
      label: copy.labels.generalNotes,
      value: profileValue(profile, ["notes", "general notes"]),
    },
  ].filter((field) => field.value);

  const profileCompletion =
    profile?.profile_status === "complete" ? 100 : customFields.length ? 65 : 20;

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.description}
        breadcrumbs={[
          { label: copy.home, href: "/player/home" },
          { label: copy.profile },
        ]}
      />

      {hasError && (
        <Card className="border-amber-400/30 bg-amber-500/10 shadow-none">
          <CardContent className="p-4 text-sm text-amber-100">
            {copy.loadWarning}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card className="border-white/10 bg-white/[0.045] shadow-none">
          <CardContent className="flex items-center gap-3 p-5 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            {copy.loading}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden border-white/10 bg-white/[0.045] shadow-none">
            <CardContent className="p-0">
              <div className="grid gap-5 p-5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
                <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-white/10 bg-slate-900">
                  <Image
                    src={photoSrc}
                    alt={playerName}
                    fill
                    sizes="96px"
                    className="object-cover"
                    priority
                  />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="break-words text-2xl font-semibold text-white">
                      {playerName}
                    </h2>
                    <Badge variant={profileStatusVariant(profile?.profile_status)}>
                      {profile?.profile_status === "complete" ? copy.complete : copy.incomplete}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {[mainPosition, profile?.group_name, profile?.branch_name]
                      .filter(Boolean)
                      .join(" | ") || copy.noAssignment}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile?.player_code && (
                      <Badge variant="outline">{copy.code} {profile.player_code}</Badge>
                    )}
                    {age && <Badge variant="secondary">{copy.age} {age}</Badge>}
                    {preferredFoot && (
                      <Badge variant="outline">{preferredFoot} {copy.foot}</Badge>
                    )}
                    {profile?.level && (
                      <Badge variant="info">{copy.level} {titleCase(profile.level)}</Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 text-center lg:min-w-80">
                  <div>
                    <p className="text-xl font-semibold text-cyan-200">
                      {percentText(progress?.attendancePercentage)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{copy.attendance}</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-lime-200">
                      {ratingText(progress?.averageTrainingRating)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{copy.training}</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-amber-200">
                      {ratingText(progress?.averageMatchRating)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{copy.matches}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {copy.profileCompletion}
                </p>
                <p className="mt-2 text-3xl font-semibold text-white">
                  {profile?.profile_status === "complete" ? copy.complete : copy.incomplete}
                </p>
                <Progress
                  value={profileCompletion}
                  className="mt-3 h-1.5 bg-slate-800"
                  indicatorClassName={cn(
                    profile?.profile_status === "complete"
                      ? "bg-emerald-400"
                      : "bg-amber-400",
                  )}
                />
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {copy.trainingsAttended}
                </p>
                <p className="mt-2 text-3xl font-semibold text-cyan-100">
                  {numberText(progress?.trainingsAttended)}
                </p>
                <p className="mt-2 text-sm text-slate-400">{copy.fromLiveAttendance}</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {copy.matchesPlayed}
                </p>
                <p className="mt-2 text-3xl font-semibold text-lime-100">
                  {numberText(progress?.matchesPlayed)}
                </p>
                <p className="mt-2 text-sm text-slate-400">
                  {numberText(progress?.goals)} {copy.goals} |{" "}
                  {numberText(progress?.assists)} {copy.assists}
                </p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {copy.monthlyMinutes}
                </p>
                <p className="mt-2 text-3xl font-semibold text-amber-100">
                  {numberText(progress?.monthlyMinutesPlayed)}
                </p>
                <Progress
                  value={progressValue(progress?.monthlyMinutesPlayed, 1 / 0.9)}
                  className="mt-3 h-1.5 bg-slate-800"
                />
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-4">
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4 text-cyan-300" />
                  {copy.personalData}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {personalInfo.map((item) => (
                  <InfoRow key={item.label} {...item} fallback={copy.notSet} />
                ))}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-lime-300" />
                  {copy.academyData}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {academyInfo.map((item) => (
                  <InfoRow key={item.label} {...item} fallback={copy.notSet} />
                ))}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <QrCode className="h-4 w-4 text-cyan-300" />
                  {copy.attendanceQr}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {attendanceQrQuery.isLoading ? (
                  <div className="flex items-center gap-2 rounded-lg bg-white/[0.035] p-4 text-sm text-slate-300">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {copy.loadingQr}
                  </div>
                ) : attendanceQr?.qrCodeDataUrl ? (
                  <>
                    <div className="mx-auto flex aspect-square max-w-56 items-center justify-center rounded-lg bg-white p-3">
                      <Image
                        src={attendanceQr.qrCodeDataUrl}
                        alt={copy.attendanceQr}
                        width={220}
                        height={220}
                        unoptimized
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <InfoRow
                      label="Player Code"
                      value={attendanceQr.playerCode || profile?.player_code || null}
                      icon={IdCard}
                      fallback={copy.notSet}
                    />
                  </>
                ) : (
                  <EmptyState text={copy.qrUnavailable} />
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Phone className="h-4 w-4 text-amber-300" />
                  {copy.contactData}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {contactInfo.map((item) => (
                  <InfoRow key={item.label} {...item} fallback={copy.notSet} />
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-cyan-300" />
                  {copy.completeFields}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {customFields.length ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {customFields.map((field) => (
                      <FieldTile
                        key={`${field.key}-${field.label}`}
                        label={field.label || titleCase(field.key)}
                        value={textValue(field.value)}
                        fallback={copy.notSet}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState text={copy.noCompleteFields} />
                )}
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-lime-300" />
                  {copy.progressSummary}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <FieldTile
                    label={copy.labels.trainingAttendance}
                    value={`${numberText(progress?.trainingsAttended)}/${numberText(progress?.trainingsRecorded)}`}
                    fallback={copy.notSet}
                  />
                  <FieldTile
                    label={copy.labels.matchAttendance}
                    value={`${numberText(progress?.matchesAttended)}/${numberText(progress?.matchesRecorded)}`}
                    fallback={copy.notSet}
                  />
                  <FieldTile
                    label={copy.labels.averageTraining}
                    value={ratingText(progress?.averageTrainingRating)}
                    fallback={copy.notSet}
                  />
                  <FieldTile
                    label={copy.labels.averageMatch}
                    value={ratingText(progress?.averageMatchRating)}
                    fallback={copy.notSet}
                  />
                  <FieldTile
                    label={copy.labels.yellowCards}
                    value={numberText(progress?.disciplineRecord?.yellowCards)}
                    fallback={copy.notSet}
                  />
                  <FieldTile
                    label={copy.labels.redCards}
                    value={numberText(progress?.disciplineRecord?.redCards)}
                    fallback={copy.notSet}
                  />
                </div>
                <div className="rounded-lg bg-white/[0.035] p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {copy.monthlySummary}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">
                    {progress?.monthlyProgressSummary ||
                      copy.noMonthlySummary}
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {profileNotes.length > 0 && (
            <Card className="border-white/10 bg-white/[0.045] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-cyan-300" />
                  {copy.coachNotes}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {profileNotes.map((field) => (
                    <FieldTile
                      key={field.label}
                      label={field.label}
                      value={field.value}
                      fallback={copy.notSet}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-white/10 bg-white/[0.045] shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <IdCard className="h-4 w-4 text-cyan-300" />
                {copy.additionalDetails}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {additionalFields.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {additionalFields.map((field) => (
                    <FieldTile
                      key={field.label}
                      label={field.label}
                      value={field.value}
                      fallback={copy.notSet}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState text={copy.noAdditionalDetails} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
