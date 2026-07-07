"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  HeartPulse,
  Pencil,
  Shield,
  ShieldAlert,
  Star,
  Target,
  Trophy,
  User,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useGetBranchesQuery,
  useUpdatePlayerMutation,
} from "@/lib/store/api/adminApi";
import {
  type ParentManagementRole,
  useGetManagedPlayerDetailQuery,
} from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { formatDate, formatDateTime, getInitials } from "@/lib/utils";

type AnyRecord = Record<string, unknown>;

const hasMeasurementValue = (value: unknown) =>
  value !== null && value !== undefined && value !== "";

const numberValue = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const calculateBmi = (heightCm: unknown, weightKg: unknown) => {
  const height = numberValue(heightCm);
  const weight = numberValue(weightKg);
  if (!height || !weight) return null;
  const heightM = height / 100;
  return Number((weight / (heightM * heightM)).toFixed(2));
};

const copy = {
  en: {
    empty: "--",
    yes: "Yes",
    no: "No",
    years: "years",
    dashboard: "Dashboard",
    players: "Players",
    loadingProfile: "Loading player profile...",
    playerNotFound: "Player not found.",
    backToPlayers: "Back to players",
    editPlayer: "Edit Player",
    completeProfile: "Complete profile",
    back: "Back",
    completeProfileBadge: "Complete profile",
    incompleteProfileBadge: "Incomplete profile",
    age: "Age",
    preferredFoot: "Preferred foot",
    phone: "Phone",
    guardian: "Guardian",
    playerQrCode: "Player QR Code",
    matches: "Matches",
    minutes: "Minutes",
    goals: "Goals",
    assists: "Assists",
    trainingAttendance: "Training attendance",
    total: "Total",
    present: "Present",
    late: "Late",
    absent: "Absent",
    injured: "Injured",
    overview: "Overview",
    training: "Training",
    medical: "Medical",
    development: "Development",
    payments: "Payments",
    identity: "Identity",
    footballProfile: "Football Profile",
    contactGuardian: "Contact and Guardian",
    accountStatus: "Account and Status",
    physicalBaseline: "Physical Baseline",
    groupAssignments: "Group Assignments",
    playerAssignments: "Player Assignments",
    customProfile: "Custom Profile",
    healthProfile: "Health Profile",
    noCustomProfile: "No custom profile data.",
    noGroupHistory: "No group assignment history.",
    noPlayerAssignments: "No player assignments found.",
    noMatchStats: "No match stats yet.",
    noMatchAttendance: "No match attendance yet.",
    noGoalsAssists: "No goals or assists recorded.",
    noMatchSummaries: "No match summaries yet.",
    noSubstitutions: "No substitutions recorded for this player.",
    noCardsInjuries: "No cards or injuries in matches.",
    noTrainingSummaries: "No training summaries yet.",
    noTrainingAttendance: "No training attendance yet.",
    noTrainingEvaluations: "No training evaluations yet.",
    noMeasurements: "No measurements yet.",
    noInjuries: "No injury history.",
    noSkillAssessments: "No skill assessments yet.",
    noRankingHistory: "No ranking history yet.",
    noCoachRatings: "No coach ratings yet.",
    noSubscriptions: "No payment subscriptions.",
    noInvoices: "No invoices.",
    noTransactions: "No payment transactions.",
    approved: "Approved",
    rejected: "Rejected",
    submitted: "Submitted",
    notSubmitted: "Not submitted",
    fullNameRequired: "Full name is required.",
    updateError: "Could not update player.",
    usernameCannotChange: "Username cannot be changed.",
    passwordKeepCurrent: "Leave empty to keep current password",
    chooseFoot: "Choose foot",
    chooseGender: "Choose gender",
    chooseLevel: "Choose level",
    chooseRelation: "Choose relation",
    chooseBranch: "Choose branch",
    close: "Close",
    saveChanges: "Save Changes",
    goal: "Goal",
    assist: "Assist",
    subbedIn: "Subbed in",
    subbedOff: "Subbed off",
    labels: {
      fullName: "Full name",
      playerCode: "Player code",
      dateOfBirth: "Date of birth",
      gender: "Gender",
      nationality: "Nationality",
      branch: "Branch",
      currentGroup: "Current group",
      dateJoined: "Date joined",
      profileCompleted: "Profile completed",
      profileStatus: "Profile status",
      active: "Active",
      notes: "Notes",
      mainPosition: "Main position",
      secondaryPositions: "Secondary positions",
      preferredFoot: "Preferred foot",
      currentTeam: "Current team",
      shirtNumber: "Shirt number",
      playingStyle: "Playing style",
      yearsExperience: "Years experience",
      previousClub: "Previous club / academy",
      playerPhone: "Player phone",
      accountPhone: "Account phone",
      address: "Address",
      guardianName: "Guardian name",
      guardianPhone: "Guardian phone",
      guardianRelation: "Guardian relation",
      linkedParentAccount: "Linked parent account",
      parentUsername: "Parent username",
      parentPhone: "Parent phone",
      parentAddress: "Parent address",
      username: "Username",
      loginPhone: "Login phone",
      accountActive: "Account active",
      accountVerified: "Account verified",
      createdAt: "Created at",
      updatedAt: "Updated at",
      height: "Height",
      weight: "Weight",
      bmi: "BMI",
      sprintSpeed: "Sprint speed",
      acceleration: "Acceleration",
      stamina: "Stamina",
      strength: "Strength",
      agility: "Agility",
      balance: "Balance",
      jumpHeight: "Jump height",
      flexibility: "Flexibility",
      group: "Group",
      joined: "Joined",
      left: "Left",
      assignment: "Assignment",
      target: "Target",
      coach: "Coach",
      opened: "Opened",
      due: "Due",
      playerStatus: "Player status",
      files: "Files",
      date: "Date",
      opponent: "Opponent",
      overall: "Overall",
      status: "Status",
      minute: "Minute",
      contribution: "Contribution",
      rating: "Rating",
      direction: "Direction",
      reason: "Reason",
      type: "Type",
      sessions: "Sessions",
      attendance: "Attendance",
      absence: "Absence",
      rate: "Rate",
      focus: "Focus",
      arrival: "Arrival",
      sessionStatus: "Session status",
      technical: "Technical",
      tactical: "Tactical",
      physical: "Physical",
      mental: "Mental",
      endurance: "Endurance",
      strengths: "Strengths",
      improvements: "Improvements",
      injuryDate: "Injury date",
      recovery: "Recovery",
      ballControl: "Ball control",
      firstTouch: "First touch",
      passing: "Passing",
      shooting: "Shooting",
      dribbling: "Dribbling",
      crossing: "Crossing",
      heading: "Heading",
      tackling: "Tackling",
      positioning: "Positioning",
      decisionMaking: "Decision making",
      teamwork: "Teamwork",
      gameReading: "Game reading",
      period: "Period",
      rank: "Rank",
      score: "Score",
      trend: "Trend",
      potential: "Potential",
      recommendedPosition: "Recommended position",
      weaknesses: "Weaknesses",
      developmentPlan: "Development plan",
      plan: "Plan",
      amount: "Amount",
      currency: "Currency",
      starts: "Starts",
      ends: "Ends",
      paidAt: "Paid at",
      provider: "Provider",
      reference: "Reference",
      birthDate: "Birth date",
      heightCm: "Height (cm)",
      weightKg: "Weight (kg)",
      dateJoinedAcademy: "Date Joined Academy",
      phone: "Phone",
      position: "Position",
      password: "Password",
      level: "Level",
    },
    foot: { right: "Right", left: "Left", both: "Both" },
    genderOptions: { male: "Male", female: "Female", other: "Other" },
    guardianRelations: {
      father: "Father",
      mother: "Mother",
      paternal_uncle: "Paternal Uncle",
      maternal_uncle: "Maternal Uncle",
      paternal_aunt: "Paternal Aunt",
      maternal_aunt: "Maternal Aunt",
      grandfather: "Grandfather",
      grandmother: "Grandmother",
      older_brother: "Older Brother",
      older_sister: "Older Sister",
      legal_guardian: "Legal Guardian",
      other: "Other",
    },
  },
  ar: {
    empty: "--",
    yes: "نعم",
    no: "لا",
    years: "سنة",
    dashboard: "لوحة التحكم",
    players: "اللاعبون",
    loadingProfile: "جاري تحميل ملف اللاعب...",
    playerNotFound: "اللاعب غير موجود.",
    backToPlayers: "العودة للاعبين",
    editPlayer: "تعديل اللاعب",
    completeProfile: "إكمال الملف",
    back: "رجوع",
    completeProfileBadge: "الملف مكتمل",
    incompleteProfileBadge: "الملف غير مكتمل",
    age: "العمر",
    preferredFoot: "القدم المفضلة",
    phone: "الهاتف",
    guardian: "ولي الأمر",
    playerQrCode: "رمز QR للاعب",
    matches: "المباريات",
    minutes: "الدقائق",
    goals: "الأهداف",
    assists: "التمريرات الحاسمة",
    trainingAttendance: "حضور التدريب",
    total: "الإجمالي",
    present: "حاضر",
    late: "متأخر",
    absent: "غائب",
    injured: "مصاب",
    overview: "نظرة عامة",
    training: "التدريب",
    medical: "الطبي",
    development: "التطوير",
    payments: "المدفوعات",
    identity: "الهوية",
    footballProfile: "الملف الكروي",
    contactGuardian: "التواصل وولي الأمر",
    accountStatus: "الحساب والحالة",
    physicalBaseline: "القياسات البدنية الأساسية",
    groupAssignments: "تعيينات المجموعات",
    playerAssignments: "تكليفات اللاعب",
    customProfile: "الملف المخصص",
    healthProfile: "الملف الصحي",
    noCustomProfile: "لا توجد بيانات مخصصة في الملف.",
    noGroupHistory: "لا يوجد سجل تعيينات مجموعات.",
    noPlayerAssignments: "لا توجد تكليفات لهذا اللاعب.",
    noMatchStats: "لا توجد إحصائيات مباريات بعد.",
    noMatchAttendance: "لا يوجد حضور مباريات بعد.",
    noGoalsAssists: "لا توجد أهداف أو تمريرات حاسمة مسجلة.",
    noMatchSummaries: "لا توجد ملخصات مباريات بعد.",
    noSubstitutions: "لا توجد تبديلات مسجلة لهذا اللاعب.",
    noCardsInjuries: "لا توجد بطاقات أو إصابات في المباريات.",
    noTrainingSummaries: "لا توجد ملخصات تدريب بعد.",
    noTrainingAttendance: "لا يوجد حضور تدريب بعد.",
    noTrainingEvaluations: "لا توجد تقييمات تدريب بعد.",
    noMeasurements: "لا توجد قياسات بعد.",
    noInjuries: "لا يوجد سجل إصابات.",
    noSkillAssessments: "لا توجد تقييمات مهارية بعد.",
    noRankingHistory: "لا يوجد سجل ترتيب بعد.",
    noCoachRatings: "لا توجد تقييمات مدرب بعد.",
    noSubscriptions: "لا توجد اشتراكات دفع.",
    noInvoices: "لا توجد فواتير.",
    noTransactions: "لا توجد معاملات دفع.",
    approved: "مقبول",
    rejected: "مرفوض",
    submitted: "تم التسليم",
    notSubmitted: "لم يتم التسليم",
    fullNameRequired: "الاسم الكامل مطلوب.",
    updateError: "تعذر تحديث اللاعب.",
    usernameCannotChange: "لا يمكن تغيير اسم المستخدم.",
    passwordKeepCurrent: "اتركه فارغًا للإبقاء على كلمة المرور الحالية",
    chooseFoot: "اختر القدم",
    chooseGender: "اختر النوع",
    chooseLevel: "اختر المستوى",
    chooseRelation: "اختر صلة القرابة",
    chooseBranch: "اختر الفرع",
    close: "إغلاق",
    saveChanges: "حفظ التغييرات",
    goal: "هدف",
    assist: "تمريرة حاسمة",
    subbedIn: "دخل بديلًا",
    subbedOff: "خرج بديلًا",
    labels: {
      fullName: "الاسم الكامل",
      playerCode: "كود اللاعب",
      dateOfBirth: "تاريخ الميلاد",
      gender: "النوع",
      nationality: "الجنسية",
      branch: "الفرع",
      currentGroup: "المجموعة الحالية",
      dateJoined: "تاريخ الانضمام",
      profileCompleted: "اكتمل الملف في",
      profileStatus: "حالة الملف",
      active: "نشط",
      notes: "الملاحظات",
      mainPosition: "المركز الأساسي",
      secondaryPositions: "المراكز الثانوية",
      preferredFoot: "القدم المفضلة",
      currentTeam: "الفريق الحالي",
      shirtNumber: "رقم القميص",
      playingStyle: "أسلوب اللعب",
      yearsExperience: "سنوات الخبرة",
      previousClub: "النادي / الأكاديمية السابقة",
      playerPhone: "هاتف اللاعب",
      accountPhone: "هاتف الحساب",
      address: "العنوان",
      guardianName: "اسم ولي الأمر",
      guardianPhone: "هاتف ولي الأمر",
      guardianRelation: "صلة ولي الأمر",
      linkedParentAccount: "حساب ولي الأمر المرتبط",
      parentUsername: "اسم مستخدم ولي الأمر",
      parentPhone: "هاتف ولي الأمر",
      parentAddress: "عنوان ولي الأمر",
      username: "اسم المستخدم",
      loginPhone: "هاتف تسجيل الدخول",
      accountActive: "الحساب نشط",
      accountVerified: "الحساب موثق",
      createdAt: "تاريخ الإنشاء",
      updatedAt: "تاريخ التحديث",
      height: "الطول",
      weight: "الوزن",
      bmi: "مؤشر كتلة الجسم",
      sprintSpeed: "سرعة العدو",
      acceleration: "التسارع",
      stamina: "التحمل",
      strength: "القوة",
      agility: "الرشاقة",
      balance: "التوازن",
      jumpHeight: "ارتفاع القفز",
      flexibility: "المرونة",
      group: "المجموعة",
      joined: "انضم في",
      left: "غادر في",
      assignment: "التكليف",
      target: "الهدف",
      coach: "المدرب",
      opened: "تم الفتح",
      due: "الاستحقاق",
      playerStatus: "حالة اللاعب",
      files: "الملفات",
      date: "التاريخ",
      opponent: "المنافس",
      overall: "الإجمالي",
      status: "الحالة",
      minute: "الدقيقة",
      contribution: "المساهمة",
      rating: "التقييم",
      direction: "الاتجاه",
      reason: "السبب",
      type: "النوع",
      sessions: "الحصص",
      attendance: "الحضور",
      absence: "الغياب",
      rate: "النسبة",
      focus: "التركيز",
      arrival: "الوصول",
      sessionStatus: "حالة الحصة",
      technical: "فني",
      tactical: "تكتيكي",
      physical: "بدني",
      mental: "ذهني",
      endurance: "التحمل",
      strengths: "نقاط القوة",
      improvements: "نقاط التحسين",
      injuryDate: "تاريخ الإصابة",
      recovery: "التعافي",
      ballControl: "التحكم بالكرة",
      firstTouch: "اللمسة الأولى",
      passing: "التمرير",
      shooting: "التسديد",
      dribbling: "المراوغة",
      crossing: "العرضيات",
      heading: "الرأسيات",
      tackling: "الافتكاك",
      positioning: "التمركز",
      decisionMaking: "اتخاذ القرار",
      teamwork: "العمل الجماعي",
      gameReading: "قراءة اللعب",
      period: "الفترة",
      rank: "الترتيب",
      score: "النتيجة",
      trend: "الاتجاه",
      potential: "الإمكانيات",
      recommendedPosition: "المركز المقترح",
      weaknesses: "نقاط الضعف",
      developmentPlan: "خطة التطوير",
      plan: "الخطة",
      amount: "المبلغ",
      currency: "العملة",
      starts: "البداية",
      ends: "النهاية",
      paidAt: "تم الدفع في",
      provider: "المزود",
      reference: "المرجع",
      birthDate: "تاريخ الميلاد",
      heightCm: "الطول (سم)",
      weightKg: "الوزن (كجم)",
      dateJoinedAcademy: "تاريخ الانضمام للأكاديمية",
      phone: "الهاتف",
      position: "المركز",
      password: "كلمة المرور",
      level: "المستوى",
    },
    foot: { right: "اليمنى", left: "اليسرى", both: "كلتاهما" },
    genderOptions: { male: "ذكر", female: "أنثى", other: "آخر" },
    guardianRelations: {
      father: "الأب",
      mother: "الأم",
      paternal_uncle: "العم",
      maternal_uncle: "الخال",
      paternal_aunt: "العمة",
      maternal_aunt: "الخالة",
      grandfather: "الجد",
      grandmother: "الجدة",
      older_brother: "الأخ الأكبر",
      older_sister: "الأخت الكبرى",
      legal_guardian: "ولي قانوني",
      other: "آخر",
    },
  },
} as const;

type PlayerDetailCopy = (typeof copy)[keyof typeof copy];

const compact = (value: unknown, t: PlayerDetailCopy) =>
  value === null || value === undefined || value === ""
    ? t.empty
    : String(value);

const formatValue = (value: unknown, t: PlayerDetailCopy): string => {
  if (value === null || value === undefined || value === "") return t.empty;
  if (typeof value === "boolean") return value ? t.yes : t.no;
  if (Array.isArray(value)) {
    if (!value.length) return t.empty;
    return value.map((item: unknown) => formatValue(item, t)).join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return formatDate(text);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return formatDateTime(text);
  return text;
};

const formatListValue = (value: unknown, t: PlayerDetailCopy): string => {
  if (Array.isArray(value))
    return value.length
      ? value.map((item) => formatValue(item, t)).join(", ")
      : t.empty;
  if (typeof value !== "string") return formatValue(value, t);
  try {
    const parsed = JSON.parse(value);
    return formatListValue(parsed, t);
  } catch {
    return formatValue(value, t);
  }
};

const ageFrom = (date: string | null | undefined, t: PlayerDetailCopy) => {
  if (!date) return t.empty;
  const birth = new Date(date);
  if (Number.isNaN(birth.getTime())) return t.empty;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate()))
    age -= 1;
  return age >= 0 ? `${age}` : t.empty;
};

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
}) {
  return (
    <Card className="border-border/50 bg-card">
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <p className="text-xs uppercase text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className="rounded-md bg-primary/10 p-2 text-primary">{icon}</div>
      </CardContent>
    </Card>
  );
}

function DetailGrid({
  rows,
  t,
}: {
  rows: Array<[string, unknown]>;
  t: PlayerDetailCopy;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-md border border-border/60 p-3">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 break-words text-sm font-medium">
            {formatValue(value, t)}
          </p>
        </div>
      ))}
    </div>
  );
}

function RecordsTable({
  rows,
  columns,
  empty,
  t,
}: {
  rows: AnyRecord[];
  columns: Array<{
    key: string;
    label: string;
    render?: (row: AnyRecord) => ReactNode;
  }>;
  empty: string;
  t: PlayerDetailCopy;
}) {
  if (!rows.length) {
    return (
      <p className="rounded-md border border-border/60 p-4 text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-2 font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={String(row.id ?? `${row.player_id ?? "row"}-${index}`)}
              className="border-t border-border/60"
            >
              {columns.map((column) => (
                <td key={column.key} className="px-3 py-2 align-top">
                  {column.render
                    ? column.render(row)
                    : formatValue(row[column.key], t)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const assignmentStatusMeta = (status: unknown, t: PlayerDetailCopy) => {
  switch (status) {
    case "approved":
      return { label: t.approved, variant: "success" as const };
    case "rejected":
      return { label: t.rejected, variant: "destructive" as const };
    case "submitted":
      return { label: t.submitted, variant: "info" as const };
    default:
      return { label: t.notSubmitted, variant: "warning" as const };
  }
};

const injuryRiskVariant = (level: unknown) => {
  if (level === "High") return "destructive" as const;
  if (level === "Medium") return "warning" as const;
  if (level === "Low") return "success" as const;
  return "secondary" as const;
};

const emptyEditForm = {
  fullName: "",
  birthDate: "",
  heightCm: "",
  weightKg: "",
  preferredFoot: "",
  dateJoined: "",
  gender: "",
  nationality: "",
  branchId: "",
  position: "",
  level: "",
  phone: "",
  address: "",
  guardianName: "",
  guardianPhone: "",
  guardianRelation: "",
  password: "",
  notes: "",
};

const editFormFromPlayer = (
  player: Record<string, unknown>,
  latestMeasurement?: Record<string, unknown> | null,
) => ({
  fullName: String(player.full_name ?? ""),
  birthDate: String(player.date_of_birth ?? "").slice(0, 10),
  heightCm:
    latestMeasurement?.height_cm === null ||
    latestMeasurement?.height_cm === undefined
      ? ""
      : String(latestMeasurement.height_cm),
  weightKg:
    latestMeasurement?.weight_kg === null ||
    latestMeasurement?.weight_kg === undefined
      ? ""
      : String(latestMeasurement.weight_kg),
  preferredFoot: String(player.preferred_foot ?? ""),
  dateJoined: String(player.date_joined ?? "").slice(0, 10),
  gender: String(player.gender ?? ""),
  nationality: String(player.nationality ?? ""),
  branchId: String(player.branch_id ?? ""),
  position: String(player.position ?? ""),
  level: String(player.level ?? ""),
  phone: String(player.phone ?? ""),
  address: String(player.address ?? ""),
  guardianName: String(player.guardian_name ?? ""),
  guardianPhone: String(player.guardian_phone ?? ""),
  guardianRelation: String(player.guardian_relation ?? ""),
  password: "",
  notes: String(player.notes ?? ""),
});

export function ManagedPlayerDetailPage({
  role = "coach",
  playerId: explicitPlayerId,
}: {
  role?: ParentManagementRole;
  playerId?: string;
}) {
  const params = useParams<{ playerId: string }>();
  const router = useRouter();
  const language = useDashboardLanguage();
  const t = copy[language];
  const playerId = explicitPlayerId ?? String(params.playerId || "");
  const { data, isLoading, error } = useGetManagedPlayerDetailQuery(
    { role, id: playerId },
    { skip: !playerId },
  );
  const { data: branches = [] } = useGetBranchesQuery(undefined, {
    skip: role !== "admin",
  });
  const [updatePlayer, updateState] = useUpdatePlayerMutation();
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editError, setEditError] = useState("");

  const player = data?.player;
  const matchTotals = data?.summary.matchTotals;
  const attendanceTotals = data?.summary.attendanceTotals;
  const attendanceRate = useMemo(() => {
    const total = Number(attendanceTotals?.total || 0);
    if (!total) return 0;
    const attended =
      Number(attendanceTotals?.present || 0) +
      Number(attendanceTotals?.late || 0);
    return Math.round((attended / total) * 100);
  }, [attendanceTotals]);
  const latestMeasurement =
    data?.summary.latestMeasurement ?? data?.measurements?.[0] ?? null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          {t.loadingProfile}
        </CardContent>
      </Card>
    );
  }

  if (error || !data || !player) {
    return (
      <div className="space-y-4">
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => router.push("/coach/players")}
        >
          <ArrowLeft className="h-4 w-4" />
          {t.backToPlayers}
        </Button>
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {t.playerNotFound}
          </CardContent>
        </Card>
      </div>
    );
  }

  const latestMeasurementValue = (key: string) => {
    for (const measurement of data.measurements) {
      const value = measurement[key];
      if (hasMeasurementValue(value)) return value;
    }
    return null;
  };
  const latestValue = (key: string) =>
    player[key] ?? latestMeasurement?.[key] ?? latestMeasurementValue(key);
  const baselineHeight = latestMeasurementValue("height_cm");
  const baselineWeight = latestMeasurementValue("weight_kg");
  const baselineBmi =
    latestMeasurementValue("bmi") ??
    calculateBmi(baselineHeight, baselineWeight);
  const linkedParent = player.linked_parent ?? null;
  const matchInjuries = (data.incidents as unknown as AnyRecord[]).filter(
    (incident) => incident.incident_type === "injury",
  );
  const injuryRisk = data.injuryRisk;
  const injuryPrediction = injuryRisk?.prediction ?? null;
  const injuryInput = injuryRisk?.input ?? null;
  const currentInjuryStatus =
    String(data.healthProfile?.current_injury_status ?? "none") || "none";
  const hasInjuryHistory =
    currentInjuryStatus === "injured" ||
    data.injuries.length > 0 ||
    matchInjuries.length > 0;
  const handleSaveEdit = async () => {
    setEditError("");
    if (!editForm.fullName.trim()) {
      setEditError(t.fullNameRequired);
      return;
    }
    const level = ["A", "B", "C", "D", "F"].includes(editForm.level)
      ? (editForm.level as "A" | "B" | "C" | "D" | "F")
      : undefined;
    const preferredFoot = ["left", "right", "both"].includes(
      editForm.preferredFoot,
    )
      ? (editForm.preferredFoot as "left" | "right" | "both")
      : undefined;
    const gender = ["male", "female", "other"].includes(editForm.gender)
      ? (editForm.gender as "male" | "female" | "other")
      : undefined;
    try {
      await updatePlayer({
        id: player.id,
        body: {
          fullName: editForm.fullName.trim(),
          birthDate: editForm.birthDate || undefined,
          heightCm: editForm.heightCm ? Number(editForm.heightCm) : undefined,
          weightKg: editForm.weightKg ? Number(editForm.weightKg) : undefined,
          preferredFoot,
          dateJoined: editForm.dateJoined || undefined,
          gender,
          nationality: editForm.nationality.trim() || undefined,
          branchId: editForm.branchId || undefined,
          position: editForm.position.trim() || undefined,
          level,
          phone: editForm.phone.trim() || undefined,
          address: editForm.address.trim() || undefined,
          guardianName: editForm.guardianName.trim() || undefined,
          guardianPhone: editForm.guardianPhone.trim() || undefined,
          guardianRelation: editForm.guardianRelation.trim() || undefined,
          password: editForm.password || undefined,
          notes: editForm.notes.trim() || undefined,
        },
      }).unwrap();
      setEditOpen(false);
    } catch (err) {
      const apiError = err as { data?: { error?: { message?: string } } };
      setEditError(apiError.data?.error?.message || t.updateError);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={player.full_name}
        description={`${compact(player.position, t)} - ${compact(player.group_name, t)} - ${compact(player.branch_name, t)}`}
        breadcrumbs={[
          {
            label: t.dashboard,
            href: role === "admin" ? "/admin/dashboard" : "/coach/home",
          },
          {
            label: t.players,
            href: role === "admin" ? "/admin/players" : "/coach/players",
          },
          { label: player.full_name },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            {role === "admin" && (
              <Button
                className="gap-2"
                onClick={() => {
                  setEditForm(editFormFromPlayer(player, latestMeasurement));
                  setEditError("");
                  setEditOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
                {t.editPlayer}
              </Button>
            )}
            {role === "coach" && player.profile_status !== "complete" && (
              <Button
                className="gap-2"
                onClick={() =>
                  router.push(`/coach/players?complete=${player.id}`)
                }
              >
                <ShieldAlert className="h-4 w-4" />
                {t.completeProfile}
              </Button>
            )}
            <Button
              variant="outline"
              className="gap-2"
              onClick={() =>
                router.push(
                  role === "admin" ? "/admin/players" : "/coach/players",
                )
              }
            >
              <ArrowLeft className="h-4 w-4" />
              {t.back}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="border-border/50 bg-card">
          <CardContent className="p-5">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="bg-primary/20 text-2xl font-semibold text-primary">
                  {getInitials(player.full_name)}
                </AvatarFallback>
              </Avatar>
              <h2 className="mt-4 text-xl font-semibold">{player.full_name}</h2>
              <p className="text-sm text-muted-foreground">
                {compact(player.player_code, t)}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Badge
                  variant={
                    player.profile_status === "complete" ? "success" : "warning"
                  }
                >
                  {player.profile_status === "complete"
                    ? t.completeProfileBadge
                    : t.incompleteProfileBadge}
                </Badge>
                <Badge variant="outline">{compact(player.level, t)}</Badge>
              </div>
            </div>
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t.age}</span>
                <span className="font-medium">
                  {ageFrom(player.date_of_birth, t)} {t.years}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t.preferredFoot}</span>
                <span className="font-medium capitalize">
                  {compact(player.preferred_foot, t)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t.phone}</span>
                <span className="font-medium">
                  {compact(player.phone ?? player.account_phone, t)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t.guardian}</span>
                <span className="font-medium">
                  {compact(player.guardian_name, t)}
                </span>
              </div>
            </div>
            {data.attendanceQr?.qrCodeDataUrl && (
              <div className="mt-6 rounded-md border border-border/60 bg-background/40 p-3 text-center">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {t.playerQrCode}
                </p>
                <Image
                  src={data.attendanceQr.qrCodeDataUrl}
                  alt={`${player.full_name} QR code`}
                  width={176}
                  height={176}
                  unoptimized
                  className="mx-auto mt-3 h-44 w-44 rounded-md bg-white p-2"
                />
                <p className="mt-2 break-all text-xs text-muted-foreground">
                  {data.attendanceQr.playerCode ||
                    data.attendanceQr.username ||
                    player.id}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t.matches}
            value={matchTotals?.matches_played ?? 0}
            icon={<Trophy className="h-5 w-5" />}
          />
          <StatCard
            label={t.minutes}
            value={matchTotals?.minutes_played ?? 0}
            icon={<Activity className="h-5 w-5" />}
          />
          <StatCard
            label={t.goals}
            value={matchTotals?.goals ?? 0}
            icon={<Target className="h-5 w-5" />}
          />
          <StatCard
            label={t.assists}
            value={matchTotals?.assists ?? 0}
            icon={<Star className="h-5 w-5" />}
          />
          <Card className="border-border/50 bg-card sm:col-span-2 xl:col-span-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{t.trainingAttendance}</p>
                <p className="text-sm text-muted-foreground">
                  {attendanceRate}%
                </p>
              </div>
              <Progress value={attendanceRate} className="mt-3 h-2" />
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-5">
                <span>
                  {t.total} {attendanceTotals?.total ?? 0}
                </span>
                <span>
                  {t.present} {attendanceTotals?.present ?? 0}
                </span>
                <span>
                  {t.late} {attendanceTotals?.late ?? 0}
                </span>
                <span>
                  {t.absent} {attendanceTotals?.absent ?? 0}
                </span>
                <span>
                  {t.injured} {attendanceTotals?.injured ?? 0}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">{t.overview}</TabsTrigger>
          <TabsTrigger value="matches">{t.matches}</TabsTrigger>
          <TabsTrigger value="training">{t.training}</TabsTrigger>
          <TabsTrigger value="medical">{t.medical}</TabsTrigger>
          <TabsTrigger value="development">{t.development}</TabsTrigger>
          <TabsTrigger value="payments">{t.payments}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" /> {t.identity}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid
                t={t}
                rows={[
                  [t.labels.fullName, player.full_name],
                  [t.labels.playerCode, player.player_code],
                  [t.labels.dateOfBirth, player.date_of_birth],
                  [t.labels.gender, player.gender],
                  [t.labels.nationality, player.nationality],
                  [t.labels.branch, player.branch_name],
                  [t.labels.currentGroup, player.group_name],
                  [t.labels.dateJoined, player.date_joined],
                  [t.labels.profileCompleted, player.profile_completed_at],
                  [t.labels.profileStatus, player.profile_status],
                  [t.labels.active, player.is_active],
                  [t.labels.notes, player.notes],
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.footballProfile}</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid
                t={t}
                rows={[
                  [t.labels.mainPosition, player.position],
                  [
                    t.labels.secondaryPositions,
                    formatListValue(player.secondary_positions, t),
                  ],
                  [t.labels.preferredFoot, player.preferred_foot],
                  [t.labels.currentTeam, player.current_team],
                  [t.labels.shirtNumber, player.shirt_number],
                  [t.labels.playingStyle, player.playing_style],
                  [t.labels.yearsExperience, player.years_experience],
                  [t.labels.previousClub, player.previous_club_academy],
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4" /> {t.contactGuardian}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid
                t={t}
                rows={[
                  [t.labels.playerPhone, player.phone],
                  ...(player.account_phone &&
                  player.account_phone !== player.phone
                    ? [
                        [t.labels.accountPhone, player.account_phone] as [
                          string,
                          unknown,
                        ],
                      ]
                    : []),
                  [t.labels.address, player.address],
                  [t.labels.guardianName, player.guardian_name],
                  [t.labels.guardianPhone, player.guardian_phone],
                  [
                    t.labels.guardianRelation,
                    t.guardianRelations[
                      String(
                        player.guardian_relation ?? "",
                      ) as keyof typeof t.guardianRelations
                    ] ?? player.guardian_relation,
                  ],
                  [t.labels.linkedParentAccount, linkedParent?.name],
                  [t.labels.parentUsername, linkedParent?.username],
                  [t.labels.parentPhone, linkedParent?.phone],
                  [t.labels.parentAddress, linkedParent?.address],
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.accountStatus}</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid
                t={t}
                rows={[
                  [t.labels.username, player.username],
                  [t.labels.loginPhone, player.account_phone],
                  [t.labels.accountActive, player.account_is_active],
                  [t.labels.accountVerified, player.account_is_verified],
                  [t.labels.createdAt, player.created_at],
                  [t.labels.updatedAt, player.updated_at],
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.physicalBaseline}</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid
                t={t}
                rows={[
                  [t.labels.height, latestValue("height_cm")],
                  [t.labels.weight, latestValue("weight_kg")],
                  [t.labels.bmi, latestValue("bmi")],
                  [t.labels.sprintSpeed, latestValue("sprint_speed")],
                  [t.labels.acceleration, latestValue("acceleration")],
                  [t.labels.stamina, latestValue("stamina")],
                  [t.labels.strength, latestValue("strength")],
                  [t.labels.agility, latestValue("agility")],
                  [t.labels.balance, latestValue("balance")],
                  [t.labels.jumpHeight, latestValue("jump_height_cm")],
                  [t.labels.flexibility, latestValue("flexibility")],
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.groupAssignments}</CardTitle>
            </CardHeader>
            <CardContent>
              <RecordsTable
                rows={data.groups}
                empty={t.noGroupHistory}
                t={t}
                columns={[
                  { key: "group_name", label: t.labels.group },
                  { key: "branch_name", label: t.labels.branch },
                  { key: "joined_at", label: t.labels.joined },
                  { key: "left_at", label: t.labels.left },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.playerAssignments}</CardTitle>
            </CardHeader>
            <CardContent>
              <RecordsTable
                rows={(data.playerAssignments || []) as unknown as AnyRecord[]}
                empty={t.noPlayerAssignments}
                t={t}
                columns={[
                  { key: "title", label: t.labels.assignment },
                  {
                    key: "groups",
                    label: t.labels.target,
                    render: (row) => {
                      const groups = Array.isArray(row.groups)
                        ? row.groups
                        : [];
                      return groups.length
                        ? groups
                            .map(
                              (group) =>
                                `${formatValue((group as AnyRecord).name, t)}${
                                  (group as AnyRecord).branchName
                                    ? ` - ${formatValue((group as AnyRecord).branchName, t)}`
                                    : ""
                                }`,
                            )
                            .join(", ")
                        : t.empty;
                    },
                  },
                  { key: "coachName", label: t.labels.coach },
                  { key: "openAt", label: t.labels.opened },
                  { key: "dueAt", label: t.labels.due },
                  {
                    key: "playerStatus",
                    label: t.labels.playerStatus,
                    render: (row) => {
                      const meta = assignmentStatusMeta(row.playerStatus, t);
                      return <Badge variant={meta.variant}>{meta.label}</Badge>;
                    },
                  },
                  { key: "submittedAt", label: t.submitted },
                  { key: "filesCount", label: t.labels.files },
                ]}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.customProfile}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.customProfile.length ? (
                <DetailGrid
                  t={t}
                  rows={data.customProfile.map((row) => [
                    `${compact(row.category_name, t)} - ${row.label}`,
                    row.value,
                  ])}
                />
              ) : (
                <p className="rounded-md border border-border/60 p-4 text-sm text-muted-foreground">
                  {t.noCustomProfile}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matches" className="space-y-4">
          <RecordsTable
            rows={data.matchStats}
            empty={t.noMatchStats}
            t={t}
            columns={[
              { key: "match_date", label: t.labels.date },
              { key: "opponent_name", label: t.labels.opponent },
              { key: "minutes_played", label: t.minutes },
              { key: "goals", label: t.goals },
              { key: "assists", label: t.assists },
              { key: "performance_rating", label: t.labels.overall },
              { key: "match_status", label: t.labels.status },
            ]}
          />
          <RecordsTable
            rows={data.matchAttendance}
            empty={t.noMatchAttendance}
            t={t}
            columns={[
              { key: "match_date", label: t.labels.date },
              { key: "opponent_name", label: t.labels.opponent },
              { key: "status", label: t.labels.status },
              { key: "notes", label: t.labels.notes },
            ]}
          />
          <RecordsTable
            rows={data.goals as unknown as AnyRecord[]}
            empty={t.noGoalsAssists}
            t={t}
            columns={[
              { key: "match_date", label: t.labels.date },
              { key: "opponent_name", label: t.labels.opponent },
              { key: "minute", label: t.labels.minute },
              {
                key: "goal_role",
                label: t.labels.contribution,
                render: (row) =>
                  row.scorer_player_id === player.id ? t.goal : t.assist,
              },
              { key: "notes", label: t.labels.notes },
            ]}
          />
          <RecordsTable
            rows={data.matchSummaries}
            empty={t.noMatchSummaries}
            t={t}
            columns={[
              { key: "recorded_at", label: t.labels.date },
              { key: "group_name", label: t.labels.group },
              { key: "matches_played", label: t.matches },
              { key: "minutes_played", label: t.minutes },
              { key: "goals", label: t.goals },
              { key: "assists", label: t.assists },
              { key: "match_rating", label: t.labels.rating },
            ]}
          />
          <RecordsTable
            rows={data.substitutions as unknown as AnyRecord[]}
            empty={t.noSubstitutions}
            t={t}
            columns={[
              { key: "match_date", label: t.labels.date },
              { key: "opponent_name", label: t.labels.opponent },
              { key: "minute", label: t.labels.minute },
              {
                key: "direction",
                label: t.labels.direction,
                render: (row) =>
                  row.in_player_id === player.id ? t.subbedIn : t.subbedOff,
              },
              { key: "reason", label: t.labels.reason },
            ]}
          />
          <RecordsTable
            rows={data.incidents as unknown as AnyRecord[]}
            empty={t.noCardsInjuries}
            t={t}
            columns={[
              { key: "match_date", label: t.labels.date },
              { key: "opponent_name", label: t.labels.opponent },
              { key: "incident_type", label: t.labels.type },
              { key: "minute", label: t.labels.minute },
              { key: "notes", label: t.labels.notes },
            ]}
          />
        </TabsContent>

        <TabsContent value="training" className="space-y-4">
          <RecordsTable
            rows={data.trainingSummaries}
            empty={t.noTrainingSummaries}
            t={t}
            columns={[
              { key: "recorded_at", label: t.labels.date },
              { key: "group_name", label: t.labels.group },
              { key: "training_sessions_count", label: t.labels.sessions },
              { key: "attendance_count", label: t.labels.attendance },
              { key: "absence_count", label: t.labels.absence },
              { key: "attendance_rate", label: t.labels.rate },
              { key: "training_performance_rating", label: t.labels.rating },
            ]}
          />
          <RecordsTable
            rows={data.trainingAttendance}
            empty={t.noTrainingAttendance}
            t={t}
            columns={[
              { key: "start_datetime", label: t.labels.date },
              { key: "title", label: t.training },
              { key: "training_focus", label: t.labels.focus },
              { key: "status", label: t.labels.attendance },
              { key: "arrival_time", label: t.labels.arrival },
              { key: "event_status", label: t.labels.sessionStatus },
            ]}
          />
          <RecordsTable
            rows={data.trainingEvaluations}
            empty={t.noTrainingEvaluations}
            t={t}
            columns={[
              { key: "start_datetime", label: t.labels.date },
              { key: "title", label: t.training },
              { key: "overall_rating", label: t.labels.overall },
              { key: "technical_rating", label: t.labels.technical },
              { key: "tactical_rating", label: t.labels.tactical },
              { key: "physical_rating", label: t.labels.physical },
              { key: "mental_rating", label: t.labels.mental },
              { key: "endurance_rating", label: t.labels.endurance },
              { key: "strength_rating", label: t.labels.strength },
              { key: "agility_rating", label: t.labels.agility },
              { key: "coach_name", label: t.labels.coach },
              { key: "strengths", label: t.labels.strengths },
              { key: "improvement_areas", label: t.labels.improvements },
            ]}
          />
        </TabsContent>

        <TabsContent value="medical" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HeartPulse className="h-4 w-4" /> {t.healthProfile}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DetailGrid
                t={t}
                rows={Object.entries(data.healthProfile ?? {})}
              />
            </CardContent>
          </Card>

          <RecordsTable
            rows={data.measurements}
            empty={t.noMeasurements}
            t={t}
            columns={[
              { key: "measured_at", label: t.labels.date },
              { key: "height_cm", label: t.labels.height },
              { key: "weight_kg", label: t.labels.weight },
              { key: "bmi", label: t.labels.bmi },
              { key: "sprint_speed", label: t.labels.sprintSpeed },
              { key: "notes", label: t.labels.notes },
            ]}
          />

          <RecordsTable
            rows={data.injuries}
            empty={t.noInjuries}
            t={t}
            columns={[
              { key: "injury_date", label: t.labels.injuryDate },
              { key: "injury_type", label: t.labels.type },
              { key: "recovery_date", label: t.labels.recovery },
              { key: "notes", label: t.labels.notes },
            ]}
          />
        </TabsContent>

        <TabsContent value="development" className="space-y-4">
          <RecordsTable
            rows={data.skillAssessments}
            empty={t.noSkillAssessments}
            t={t}
            columns={[
              { key: "assessed_at", label: t.labels.date },
              { key: "group_name", label: t.labels.group },
              { key: "ball_control", label: t.labels.ballControl },
              { key: "first_touch", label: t.labels.firstTouch },
              { key: "passing", label: t.labels.passing },
              { key: "shooting", label: t.labels.shooting },
              { key: "dribbling", label: t.labels.dribbling },
              { key: "crossing", label: t.labels.crossing },
              { key: "heading", label: t.labels.heading },
              { key: "tackling", label: t.labels.tackling },
              { key: "positioning", label: t.labels.positioning },
              { key: "decision_making", label: t.labels.decisionMaking },
              { key: "teamwork", label: t.labels.teamwork },
              { key: "game_reading", label: t.labels.gameReading },
            ]}
          />
          <RecordsTable
            rows={data.rankings}
            empty={t.noRankingHistory}
            t={t}
            columns={[
              { key: "period", label: t.labels.period },
              { key: "group_name", label: t.labels.group },
              { key: "rank", label: t.labels.rank },
              { key: "total_score", label: t.labels.score },
              { key: "trend", label: t.labels.trend },
            ]}
          />
          <RecordsTable
            rows={data.coachRatings}
            empty={t.noCoachRatings}
            t={t}
            columns={[
              { key: "eval_date", label: t.labels.date },
              { key: "coach_name", label: t.labels.coach },
              { key: "group_name", label: t.labels.group },
              { key: "score", label: t.labels.score },
              { key: "potential_rating", label: t.labels.potential },
              {
                key: "recommended_position",
                label: t.labels.recommendedPosition,
              },
              { key: "strengths", label: t.labels.strengths },
              { key: "weaknesses", label: t.labels.weaknesses },
              { key: "development_plan", label: t.labels.developmentPlan },
              { key: "notes", label: t.labels.notes },
            ]}
          />
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <RecordsTable
            rows={data.payments.subscriptions}
            empty={t.noSubscriptions}
            t={t}
            columns={[
              { key: "plan", label: t.labels.plan },
              { key: "amount", label: t.labels.amount },
              { key: "currency", label: t.labels.currency },
              { key: "starts_at", label: t.labels.starts },
              { key: "ends_at", label: t.labels.ends },
              { key: "status", label: t.labels.status },
            ]}
          />
          <RecordsTable
            rows={data.payments.invoices}
            empty={t.noInvoices}
            t={t}
            columns={[
              { key: "due_date", label: t.labels.due },
              { key: "amount", label: t.labels.amount },
              { key: "status", label: t.labels.status },
              { key: "paid_at", label: t.labels.paidAt },
            ]}
          />
          <RecordsTable
            rows={data.payments.transactions}
            empty={t.noTransactions}
            t={t}
            columns={[
              { key: "created_at", label: t.labels.date },
              { key: "amount", label: t.labels.amount },
              { key: "currency", label: t.labels.currency },
              { key: "status", label: t.labels.status },
              { key: "provider", label: t.labels.provider },
              { key: "reference", label: t.labels.reference },
            ]}
          />
        </TabsContent>
      </Tabs>
      {role === "admin" && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t.editPlayer}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-username">{t.labels.username}</Label>
                <Input
                  id="edit-username"
                  value={String(player.username ?? "")}
                  readOnly
                />
                <p className="text-xs text-muted-foreground">
                  {t.usernameCannotChange}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">{t.labels.password}</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editForm.password}
                  placeholder={t.passwordKeepCurrent}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                />
              </div>
              {[
                ["fullName", t.labels.fullName, "text"],
                ["birthDate", t.labels.birthDate, "date"],
                ["heightCm", t.labels.heightCm, "number"],
                ["weightKg", t.labels.weightKg, "number"],
                ["dateJoined", t.labels.dateJoinedAcademy, "date"],
                ["nationality", t.labels.nationality, "text"],
                ["phone", t.labels.phone, "text"],
                ["position", t.labels.position, "text"],
                ["address", t.labels.address, "text"],
                ["guardianName", t.labels.guardianName, "text"],
                ["guardianPhone", t.labels.guardianPhone, "text"],
              ].map(([key, label, type]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`edit-${key}`}>{label}</Label>
                  <Input
                    id={`edit-${key}`}
                    type={type}
                    value={editForm[key as keyof typeof editForm]}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                  />
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="edit-preferredFoot">
                  {t.labels.preferredFoot}
                </Label>
                <Select
                  value={editForm.preferredFoot}
                  onValueChange={(value) =>
                    setEditForm((current) => ({
                      ...current,
                      preferredFoot: value,
                    }))
                  }
                >
                  <SelectTrigger id="edit-preferredFoot">
                    <SelectValue placeholder={t.chooseFoot} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="right">{t.foot.right}</SelectItem>
                    <SelectItem value="left">{t.foot.left}</SelectItem>
                    <SelectItem value="both">{t.foot.both}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-gender">{t.labels.gender}</Label>
                <Select
                  value={editForm.gender}
                  onValueChange={(value) =>
                    setEditForm((current) => ({ ...current, gender: value }))
                  }
                >
                  <SelectTrigger id="edit-gender">
                    <SelectValue placeholder={t.chooseGender} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t.genderOptions.male}</SelectItem>
                    <SelectItem value="female">
                      {t.genderOptions.female}
                    </SelectItem>
                    <SelectItem value="other">
                      {t.genderOptions.other}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-level">{t.labels.level}</Label>
                <Select
                  value={editForm.level}
                  onValueChange={(value) =>
                    setEditForm((current) => ({ ...current, level: value }))
                  }
                >
                  <SelectTrigger id="edit-level">
                    <SelectValue placeholder={t.chooseLevel} />
                  </SelectTrigger>
                  <SelectContent>
                    {["A", "B", "C", "D", "F"].map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-guardianRelation">
                  {t.labels.guardianRelation}
                </Label>
                <Select
                  value={editForm.guardianRelation}
                  onValueChange={(value) =>
                    setEditForm((current) => ({
                      ...current,
                      guardianRelation: value,
                    }))
                  }
                >
                  <SelectTrigger id="edit-guardianRelation">
                    <SelectValue placeholder={t.chooseRelation} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(t.guardianRelations).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-branchId">{t.labels.branch}</Label>
                <Select
                  value={editForm.branchId}
                  onValueChange={(value) =>
                    setEditForm((current) => ({ ...current, branchId: value }))
                  }
                >
                  <SelectTrigger id="edit-branchId">
                    <SelectValue placeholder={t.chooseBranch} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-notes">{t.labels.notes}</Label>
                <Input
                  id="edit-notes"
                  value={editForm.notes}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
            {editError && <p className="text-sm text-red-400">{editError}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                {t.close}
              </Button>
              <Button
                type="button"
                disabled={updateState.isLoading}
                onClick={handleSaveEdit}
              >
                {updateState.isLoading ? (
                  <Activity className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {t.saveChanges}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function CoachPlayerDetailPage() {
  return <ManagedPlayerDetailPage role="coach" />;
}
