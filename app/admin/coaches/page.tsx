"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getInitials } from "@/lib/utils";
import { AlertTriangle, KeyRound, Loader2, Pencil, Plus, RefreshCw, ShieldCheck, Trash2, UserCheck, UserX } from "lucide-react";
import {
  useCreateCoachMutation,
  useGetCoachesQuery,
  useGetBranchesQuery,
  useHardDeleteCoachMutation,
  useRegenerateCoachMfaBackupCodesMutation,
  useRegisterUserMutation,
  useSetupCoachMfaMutation,
  useUpdateCoachMutation,
  useVerifyCoachMfaMutation,
  type Setup2FAResponse,
  type CoachRole,
  type CoachRow,
} from "@/lib/store/api/adminApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";

type CoachForm = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
  phone: string;
  branchId: string;
  role: CoachRole | "";
  bio: string;
};

type CoachEditForm = {
  email: string;
  phone: string;
  branchId: string;
  role: CoachRole | "";
  specialization: string;
  bio: string;
  isActive: "active" | "inactive";
};

const emptyCoachForm: CoachForm = {
  firstName: "",
  lastName: "",
  username: "",
  email: "",
  password: "",
  phone: "",
  branchId: "",
  role: "",
  bio: "",
};

const emptyCoachEditForm: CoachEditForm = {
  email: "",
  phone: "",
  branchId: "",
  role: "",
  specialization: "",
  bio: "",
  isActive: "active",
};

const coachRoles: { value: CoachRole }[] = [
  { value: "head_coach" },
  { value: "assistant_coach" },
  { value: "goalkeeping_coach" },
  { value: "fitness_coach" },
  { value: "technical_coach" },
  { value: "tactical_coach" },
  { value: "goalkeeping_assistant" },
  { value: "performance_analyst" },
  { value: "team_manager" },
  { value: "physiotherapist" },
  { value: "rehabilitation_coach" },
  { value: "scout" },
  { value: "academy_director" },
  { value: "youth_coach" },
  { value: "conditioning_coach" },
];

const copy = {
  en: {
    coach: "Coach",
    coaches: "Coaches",
    dashboard: "Dashboard",
    description: "Manage coach accounts, assignments, and performance.",
    noUsername: "No username",
    branch: "Branch",
    notAssigned: "Not assigned",
    specialization: "Specialization",
    none: "None",
    status: "Status",
    active: "Active",
    inactive: "Inactive",
    actions: "Actions",
    activate: "Activate",
    deactivate: "Deactivate",
    twoFactorOn: "2FA On",
    setupMfa: "Setup MFA",
    edit: "Edit",
    deleteForever: "Delete forever",
    assignCoach: "Assign Coach",
    addCoach: "Add Coach",
    searchCoaches: "Search coaches...",
    failedLoad: "Failed to load coaches.",
    retry: "Retry",
    createCoachDescription: "Create the coach login account and activate the profile.",
    firstName: "First name",
    lastName: "Last name",
    username: "Username",
    email: "Email",
    password: "Password",
    phone: "Phone",
    role: "Role",
    bio: "Bio",
    chooseBranch: "Choose branch...",
    chooseRole: "Choose role...",
    close: "Close",
    createCoach: "Create Coach",
    editCoach: "Edit Coach",
    editCoachDescription: "Update coach information. Name and join date are locked.",
    name: "Name",
    joined: "Joined",
    cancel: "Cancel",
    saveChanges: "Save Changes",
    coachMfa: "Coach MFA",
    coachMfaQrAlt: "Coach MFA QR code",
    coachMfaDescriptionPrefix: "Add an authenticator device for",
    coachMfaDescriptionFallback: "this coach",
    coachMfaDescriptionSuffix: "The code must come from the coach device, not the admin device.",
    deviceName: "Device name",
    coachPhone: "Coach phone",
    addDevice: "Add Device",
    startSetup: "Start Setup",
    resetMfa: "Reset MFA",
    authenticatorHint: "The authenticator entry will show as Goalix Academy Coach on the coach phone.",
    issuer: "Issuer",
    manualSecret: "Manual secret",
    sixDigitCode: "6-digit coach code",
    verifyCoachDevice: "Verify Coach Device",
    coachBackupCodes: "Coach backup codes",
    coachBackupCodesDescription: "Generate replacement backup codes for this coach. Old coach codes will stop working.",
    generateCodes: "Generate Codes",
    backupCodes: "Backup codes",
    deleteCoachForever: "Delete Coach Forever",
    deleteDescriptionPrefix: "This permanently removes the coach profile, assignments, access rules, and linked coach login account. Type",
    deleteDescriptionSuffix: "to confirm.",
    confirmation: "Confirmation",
    formRequired: "All fields are required except bio.",
    editRequired: "Email, phone, branch, and role are required.",
    passwordWeak: "Password must be at least 8 characters and include uppercase, number, and special character.",
    updateError: "Could not update coach.",
    deleteError: "Could not permanently delete coach.",
    statusError: "Could not update coach status.",
    createError: "Could not create coach account.",
    typeToConfirmPrefix: "Type",
    typeToConfirmSuffix: "to confirm permanent deletion.",
    deleteCommandPrefix: "delete coach forever",
    mfaResetMessage: "Coach MFA was reset. Scan the new QR code.",
    mfaScanMessage: "Scan this QR code with the coach authenticator app.",
    mfaStartError: "Could not start coach MFA setup.",
    mfaCodeError: "Enter the 6-digit code from the coach phone.",
    mfaActiveMessage: "Coach MFA is active now.",
    mfaInvalidCode: "Invalid MFA code.",
    mfaBackupMessage: "New coach backup codes generated. Old coach backup codes are no longer valid.",
    mfaBackupError: "Could not generate coach backup codes.",
    roles: {
      head_coach: "Head Coach",
      assistant_coach: "Assistant Coach",
      goalkeeping_coach: "Goalkeeping Coach",
      fitness_coach: "Fitness Coach",
      technical_coach: "Technical Coach",
      tactical_coach: "Tactical Coach",
      goalkeeping_assistant: "Goalkeeping Assistant",
      performance_analyst: "Performance Analyst",
      team_manager: "Team Manager",
      physiotherapist: "Physiotherapist",
      rehabilitation_coach: "Rehabilitation Coach",
      scout: "Scout",
      academy_director: "Academy Director",
      youth_coach: "Youth Coach",
      conditioning_coach: "Conditioning Coach",
    },
  },
  ar: {
    coach: "المدرب",
    coaches: "المدربون",
    dashboard: "لوحة التحكم",
    description: "إدارة حسابات المدربين والتكليفات والأداء.",
    noUsername: "لا يوجد اسم مستخدم",
    branch: "الفرع",
    notAssigned: "غير معين",
    specialization: "التخصص",
    none: "لا يوجد",
    status: "الحالة",
    active: "نشط",
    inactive: "غير نشط",
    actions: "الإجراءات",
    activate: "تفعيل",
    deactivate: "إيقاف",
    twoFactorOn: "التحقق مفعل",
    setupMfa: "إعداد التحقق",
    edit: "تعديل",
    deleteForever: "حذف نهائي",
    assignCoach: "تعيين مدرب",
    addCoach: "إضافة مدرب",
    searchCoaches: "ابحث عن المدربين...",
    failedLoad: "تعذر تحميل المدربين.",
    retry: "إعادة المحاولة",
    createCoachDescription: "أنشئ حساب دخول المدرب وفعّل ملفه.",
    firstName: "الاسم الأول",
    lastName: "اسم العائلة",
    username: "اسم المستخدم",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    phone: "الهاتف",
    role: "الدور",
    bio: "النبذة",
    chooseBranch: "اختر الفرع...",
    chooseRole: "اختر الدور...",
    close: "إغلاق",
    createCoach: "إنشاء المدرب",
    editCoach: "تعديل المدرب",
    editCoachDescription: "حدّث بيانات المدرب. الاسم وتاريخ الانضمام مقفلان.",
    name: "الاسم",
    joined: "تاريخ الانضمام",
    cancel: "إلغاء",
    saveChanges: "حفظ التغييرات",
    coachMfa: "التحقق المتعدد للمدرب",
    coachMfaQrAlt: "رمز QR للتحقق المتعدد للمدرب",
    coachMfaDescriptionPrefix: "أضف جهاز مصادقة لـ",
    coachMfaDescriptionFallback: "هذا المدرب",
    coachMfaDescriptionSuffix: "يجب أن يأتي الكود من جهاز المدرب، وليس جهاز المدير.",
    deviceName: "اسم الجهاز",
    coachPhone: "هاتف المدرب",
    addDevice: "إضافة جهاز",
    startSetup: "بدء الإعداد",
    resetMfa: "إعادة ضبط التحقق",
    authenticatorHint: "سيظهر إدخال المصادقة باسم Goalix Academy Coach على هاتف المدرب.",
    issuer: "جهة الإصدار",
    manualSecret: "المفتاح اليدوي",
    sixDigitCode: "كود المدرب المكون من 6 أرقام",
    verifyCoachDevice: "تأكيد جهاز المدرب",
    coachBackupCodes: "أكواد المدرب الاحتياطية",
    coachBackupCodesDescription: "أنشئ أكواد احتياطية بديلة لهذا المدرب. الأكواد القديمة ستتوقف عن العمل.",
    generateCodes: "إنشاء الأكواد",
    backupCodes: "الأكواد الاحتياطية",
    deleteCoachForever: "حذف المدرب نهائيًا",
    deleteDescriptionPrefix: "هذا يحذف ملف المدرب والتكليفات وقواعد الوصول وحساب الدخول المرتبط نهائيًا. اكتب",
    deleteDescriptionSuffix: "للتأكيد.",
    confirmation: "التأكيد",
    formRequired: "كل الحقول مطلوبة ما عدا النبذة.",
    editRequired: "البريد والهاتف والفرع والدور مطلوبة.",
    passwordWeak: "كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف كبير ورقم ورمز خاص.",
    updateError: "تعذر تحديث المدرب.",
    deleteError: "تعذر حذف المدرب نهائيًا.",
    statusError: "تعذر تحديث حالة المدرب.",
    createError: "تعذر إنشاء حساب المدرب.",
    typeToConfirmPrefix: "اكتب",
    typeToConfirmSuffix: "لتأكيد الحذف النهائي.",
    deleteCommandPrefix: "احذف المدرب نهائيًا",
    mfaResetMessage: "تمت إعادة ضبط تحقق المدرب. امسح رمز QR الجديد.",
    mfaScanMessage: "امسح رمز QR بتطبيق المصادقة على جهاز المدرب.",
    mfaStartError: "تعذر بدء إعداد تحقق المدرب.",
    mfaCodeError: "أدخل الكود المكون من 6 أرقام من هاتف المدرب.",
    mfaActiveMessage: "تم تفعيل تحقق المدرب الآن.",
    mfaInvalidCode: "كود التحقق غير صحيح.",
    mfaBackupMessage: "تم إنشاء أكواد احتياطية جديدة. أكواد المدرب القديمة لم تعد صالحة.",
    mfaBackupError: "تعذر إنشاء أكواد المدرب الاحتياطية.",
    roles: {
      head_coach: "مدرب رئيسي",
      assistant_coach: "مدرب مساعد",
      goalkeeping_coach: "مدرب حراس مرمى",
      fitness_coach: "مدرب لياقة",
      technical_coach: "مدرب فني",
      tactical_coach: "مدرب تكتيكي",
      goalkeeping_assistant: "مساعد مدرب حراس",
      performance_analyst: "محلل أداء",
      team_manager: "مدير فريق",
      physiotherapist: "أخصائي علاج طبيعي",
      rehabilitation_coach: "مدرب تأهيل",
      scout: "كشاف",
      academy_director: "مدير الأكاديمية",
      youth_coach: "مدرب ناشئين",
      conditioning_coach: "مدرب إعداد بدني",
    },
  },
} as const;

type CoachesCopy = (typeof copy)[keyof typeof copy];

type ApiErrorDetails = {
  data?: {
    error?: {
      message?: string;
      details?: { message?: string }[];
    };
  };
};

const strongPasswordPattern = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;
function getApiErrorMessage(err: unknown, fallback: string) {
  const apiError = err as ApiErrorDetails;
  const detailMessages = apiError.data?.error?.details
    ?.map((detail) => detail.message)
    .filter(Boolean);

  return detailMessages?.length
    ? detailMessages.join(". ")
    : apiError.data?.error?.message ?? fallback;
}

const createBaseColumns = (t: CoachesCopy): Column<CoachRow>[] => [
  {
    key: "name",
    header: t.coach,
    accessor: (row) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-accent/20 text-sm text-accent">
            {getInitials(row.full_name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium text-foreground">{row.full_name}</p>
          <p className="text-xs text-muted-foreground">{row.username ?? t.noUsername}</p>
        </div>
      </div>
    ),
    sortable: true,
    sortValue: (row) => row.full_name,
  },
  {
    key: "branch",
    header: t.branch,
    accessor: (row) => {
      if (row.branch_name) return row.branch_name;
      return <span className="text-muted-foreground">{t.notAssigned}</span>;
    },
    sortable: true,
    sortValue: (row) => row.branch_name ?? "",
  },
  {
    key: "specialization",
    header: t.specialization,
    accessor: (row) => {
      if (row.specialization) return row.specialization;
      return <span className="text-muted-foreground">{t.none}</span>;
    },
  },
  {
    key: "status",
    header: t.status,
    accessor: (row) => (
      <Badge variant={row.is_active === false ? "secondary" : "success"}>
        {row.is_active === false ? t.inactive : t.active}
      </Badge>
    ),
    sortable: true,
    sortValue: (row) => (row.is_active === false ? "inactive" : "active"),
  },
];

export default function CoachesPage() {
  const language = useDashboardLanguage();
  const t = copy[language];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CoachForm>(emptyCoachForm);
  const [editingCoach, setEditingCoach] = useState<CoachRow | null>(null);
  const [editForm, setEditForm] = useState<CoachEditForm>(emptyCoachEditForm);
  const [editError, setEditError] = useState("");
  const [deleteCoachRow, setDeleteCoachRow] = useState<CoachRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [mfaCoach, setMfaCoach] = useState<CoachRow | null>(null);
  const [mfaSetup, setMfaSetup] = useState<Setup2FAResponse | null>(null);
  const [mfaDeviceName, setMfaDeviceName] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[]>([]);
  const [mfaError, setMfaError] = useState("");
  const [mfaMessage, setMfaMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [actionError, setActionError] = useState("");
  const [registerUser, { isLoading: isRegistering }] = useRegisterUserMutation();
  const [createCoach, { isLoading: isCreatingCoach }] = useCreateCoachMutation();
  const [updateCoach, { isLoading: isUpdatingCoach }] = useUpdateCoachMutation();
  const [hardDeleteCoach, { isLoading: isDeletingCoach }] = useHardDeleteCoachMutation();
  const [setupCoachMfa, { isLoading: isSettingUpMfa }] = useSetupCoachMfaMutation();
  const [verifyCoachMfa, { isLoading: isVerifyingMfa }] = useVerifyCoachMfaMutation();
  const [regenerateCoachMfaBackupCodes, { isLoading: isRegeneratingCoachBackupCodes }] =
    useRegenerateCoachMfaBackupCodesMutation();
  const { data, isLoading, isError, refetch } = useGetCoachesQuery({ limit: 50 });
  const { data: branches } = useGetBranchesQuery();
  const isSaving = isRegistering || isCreatingCoach;

  const updateForm = (field: keyof CoachForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const openEditCoach = (coach: CoachRow) => {
    setEditError("");
    setEditingCoach(coach);
    setEditForm({
      email: coach.email ?? "",
      phone: coach.phone ?? "",
      branchId: coach.branch_id ?? "",
      role: coach.role ?? "",
      specialization: coach.specialization ?? "",
      bio: coach.bio ?? "",
      isActive: coach.is_active === false ? "inactive" : "active",
    });
  };

  const handleUpdateCoach = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingCoach) return;
    setEditError("");

    if (!editForm.email.trim() || !editForm.phone.trim() || !editForm.branchId || !editForm.role) {
      setEditError(t.editRequired);
      return;
    }

    try {
      await updateCoach({
        id: editingCoach.id,
        body: {
          email: editForm.email.trim(),
          phone: editForm.phone.trim(),
          branchId: editForm.branchId,
          role: editForm.role as CoachRole,
          specialization: editForm.specialization.trim() || (editForm.role as CoachRole),
          bio: editForm.bio.trim() || null,
          isActive: editForm.isActive === "active",
        },
      }).unwrap();
      setEditingCoach(null);
    } catch (err) {
      setEditError(getApiErrorMessage(err, t.updateError));
    }
  };

  const handleHardDeleteCoach = async () => {
    if (!deleteCoachRow) return;
    const expected = `${t.deleteCommandPrefix} ${deleteCoachRow.full_name}`;
    setDeleteError("");

    if (deleteConfirm.trim() !== expected) {
      setDeleteError(`${t.typeToConfirmPrefix} "${expected}" ${t.typeToConfirmSuffix}`);
      return;
    }

    try {
      await hardDeleteCoach(deleteCoachRow.id).unwrap();
      setDeleteCoachRow(null);
      setDeleteConfirm("");
    } catch (err) {
      setDeleteError(getApiErrorMessage(err, t.deleteError));
    }
  };

  const handleToggleCoachStatus = async (coach: CoachRow) => {
    setActionError("");
    try {
      await updateCoach({
        id: coach.id,
        body: { isActive: coach.is_active === false },
      }).unwrap();
    } catch (err) {
      setActionError(getApiErrorMessage(err, t.statusError));
    }
  };

  const openCoachMfa = (coach: CoachRow) => {
    setMfaCoach(coach);
    setMfaSetup(null);
    setMfaToken("");
    setMfaBackupCodes([]);
    setMfaError("");
    setMfaMessage("");
    setMfaDeviceName(`${coach.full_name} ${t.phone}`);
  };

  const handleSetupCoachMfa = async (resetExisting = false) => {
    if (!mfaCoach) return;
    setMfaError("");
    setMfaMessage("");
    setMfaBackupCodes([]);
    try {
      const result = await setupCoachMfa({
        coachId: mfaCoach.id,
        deviceName: mfaDeviceName.trim() || `${mfaCoach.full_name} ${t.phone}`,
        resetExisting,
      }).unwrap();
      setMfaSetup(result);
      setMfaMessage(resetExisting ? t.mfaResetMessage : t.mfaScanMessage);
    } catch (err) {
      setMfaError(getApiErrorMessage(err, t.mfaStartError));
    }
  };

  const handleVerifyCoachMfa = async () => {
    if (!mfaCoach || !mfaSetup?.deviceId) return;
    setMfaError("");
    setMfaMessage("");
    if (!/^\d{6}$/.test(mfaToken.trim())) {
      setMfaError(t.mfaCodeError);
      return;
    }
    try {
      const result = await verifyCoachMfa({
        coachId: mfaCoach.id,
        deviceId: mfaSetup.deviceId,
        token: mfaToken.trim(),
      }).unwrap();
      setMfaBackupCodes(result.backupCodes || []);
      setMfaMessage(t.mfaActiveMessage);
      setMfaToken("");
      void refetch();
    } catch (err) {
      setMfaError(getApiErrorMessage(err, t.mfaInvalidCode));
    }
  };

  const handleRegenerateCoachBackupCodes = async () => {
    if (!mfaCoach) return;
    setMfaError("");
    setMfaMessage("");
    try {
      const result = await regenerateCoachMfaBackupCodes({ coachId: mfaCoach.id }).unwrap();
      setMfaBackupCodes(result.backupCodes || []);
      setMfaMessage(t.mfaBackupMessage);
    } catch (err) {
      setMfaError(getApiErrorMessage(err, t.mfaBackupError));
    }
  };

  const handleCreateCoach = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    const required = [form.firstName, form.lastName, form.username, form.email, form.password, form.phone, form.branchId, form.role];
    if (required.some((value) => !String(value).trim())) {
      setFormError(t.formRequired);
      return;
    }

    if (!strongPasswordPattern.test(form.password)) {
      setFormError(t.passwordWeak);
      return;
    }

    try {
      const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`;
      const user = await registerUser({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        role: "coach",
        phone: form.phone.trim(),
        fullName,
      }).unwrap();

      await createCoach({
        userId: user.id,
        branchId: form.branchId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role as CoachRole,
        fullName,
        bio: form.bio.trim() || null,
      }).unwrap();

      setForm(emptyCoachForm);
      setOpen(false);
    } catch (err) {
      setFormError(getApiErrorMessage(err, t.createError));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">{t.failedLoad}</p>
        <Button variant="outline" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-4 w-4" />
          {t.retry}
        </Button>
      </div>
    );
  }

  const coaches = data?.data ?? [];
  const deleteExpected = `${t.deleteCommandPrefix} ${deleteCoachRow?.full_name ?? ""}`;
  const columns: Column<CoachRow>[] = [
    ...createBaseColumns(t),
    {
      key: "actions",
      header: t.actions,
      className: "w-[220px]",
      accessor: (row) => (
        <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
          <Button
            type="button"
            size="sm"
            variant={row.is_active === false ? "default" : "outline"}
            className="gap-1.5"
            disabled={isUpdatingCoach}
            onClick={() => handleToggleCoachStatus(row)}
          >
            {row.is_active === false ? (
              <UserCheck className="h-3.5 w-3.5" />
            ) : (
              <UserX className="h-3.5 w-3.5" />
            )}
            {row.is_active === false ? t.activate : t.deactivate}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => openCoachMfa(row)}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {row.totp_enabled ? t.twoFactorOn : t.setupMfa}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => openEditCoach(row)}
          >
            <Pencil className="h-3.5 w-3.5" />
            {t.edit}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="gap-1.5"
            onClick={() => {
              setDeleteError("");
              setDeleteConfirm("");
              setDeleteCoachRow(row);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t.deleteForever}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={`${t.coaches} (${data?.pagination?.total ?? coaches.length})`}
        description={t.description}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.coaches },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => router.push("/admin/coaches/assign")}>
              {t.assignCoach}
            </Button>
            <Button className="gap-1.5" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              {t.addCoach}
            </Button>
          </div>
        }
      />

      <DataTable
        data={coaches}
        columns={columns}
        searchable
        searchPlaceholder={t.searchCoaches}
        searchKey={(row) => `${row.full_name} ${row.username ?? ""} ${row.specialization ?? ""}`}
        onRowClick={(row) => router.push(`/admin/coaches/${row.id}`)}
      />
      {actionError && <p className="text-sm text-red-400">{actionError}</p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.addCoach}</DialogTitle>
            <DialogDescription>{t.createCoachDescription}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCoach} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="coach-first-name">{t.firstName}</Label>
                <Input
                  id="coach-first-name"
                  value={form.firstName}
                  onChange={(event) => updateForm("firstName", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coach-last-name">{t.lastName}</Label>
                <Input
                  id="coach-last-name"
                  value={form.lastName}
                  onChange={(event) => updateForm("lastName", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coach-username">{t.username}</Label>
                <Input
                  id="coach-username"
                  value={form.username}
                  onChange={(event) => updateForm("username", event.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coach-email">{t.email}</Label>
                <Input
                  id="coach-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm("email", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coach-password">{t.password}</Label>
                <Input
                  id="coach-password"
                  type="password"
                  minLength={8}
                  value={form.password}
                  onChange={(event) => updateForm("password", event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coach-phone">{t.phone}</Label>
                <Input
                  id="coach-phone"
                  value={form.phone}
                  onChange={(event) => updateForm("phone", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.branch}</Label>
                <Select value={form.branchId} onValueChange={(value) => updateForm("branchId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t.chooseBranch} />
                  </SelectTrigger>
                  <SelectContent>
                    {(branches ?? []).map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.role}</Label>
                <Select value={form.role} onValueChange={(value) => updateForm("role", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t.chooseRole} />
                  </SelectTrigger>
                  <SelectContent>
                    {coachRoles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {t.roles[role.value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="coach-bio">{t.bio}</Label>
                <Input
                  id="coach-bio"
                  value={form.bio}
                  onChange={(event) => updateForm("bio", event.target.value)}
                />
              </div>
            </div>

            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t.close}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.createCoach}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingCoach)} onOpenChange={(nextOpen) => !nextOpen && setEditingCoach(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.editCoach}</DialogTitle>
            <DialogDescription>{t.editCoachDescription}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateCoach} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-coach-name">{t.name}</Label>
                <Input id="edit-coach-name" value={editingCoach?.full_name ?? ""} readOnly />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-coach-joined">{t.joined}</Label>
                <Input
                  id="edit-coach-joined"
                  value={editingCoach?.created_at ? new Date(editingCoach.created_at).toLocaleDateString() : ""}
                  readOnly
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-coach-email">{t.email}</Label>
                <Input
                  id="edit-coach-email"
                  type="email"
                  value={editForm.email}
                  onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-coach-phone">{t.phone}</Label>
                <Input
                  id="edit-coach-phone"
                  value={editForm.phone}
                  onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.branch}</Label>
                <Select value={editForm.branchId} onValueChange={(value) => setEditForm((current) => ({ ...current, branchId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={t.chooseBranch} />
                  </SelectTrigger>
                  <SelectContent>
                    {(branches ?? []).map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.role}</Label>
                <Select value={editForm.role} onValueChange={(value) => setEditForm((current) => ({ ...current, role: value as CoachRole }))}>
                  <SelectTrigger>
                    <SelectValue placeholder={t.chooseRole} />
                  </SelectTrigger>
                  <SelectContent>
                    {coachRoles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {t.roles[role.value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.status}</Label>
                <Select value={editForm.isActive} onValueChange={(value) => setEditForm((current) => ({ ...current, isActive: value as CoachEditForm["isActive"] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t.active}</SelectItem>
                    <SelectItem value="inactive">{t.inactive}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-coach-specialization">{t.specialization}</Label>
                <Input
                  id="edit-coach-specialization"
                  value={editForm.specialization}
                  onChange={(event) => setEditForm((current) => ({ ...current, specialization: event.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit-coach-bio">{t.bio}</Label>
                <Input
                  id="edit-coach-bio"
                  value={editForm.bio}
                  onChange={(event) => setEditForm((current) => ({ ...current, bio: event.target.value }))}
                />
              </div>
            </div>

            {editError && <p className="text-sm text-red-400">{editError}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingCoach(null)}>
                {t.cancel}
              </Button>
              <Button type="submit" disabled={isUpdatingCoach} className="gap-2">
                {isUpdatingCoach && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.saveChanges}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(mfaCoach)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setMfaCoach(null);
            setMfaSetup(null);
            setMfaToken("");
            setMfaBackupCodes([]);
            setMfaError("");
            setMfaMessage("");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.coachMfa}</DialogTitle>
            <DialogDescription>
              {t.coachMfaDescriptionPrefix} {mfaCoach?.full_name ?? t.coachMfaDescriptionFallback}. {t.coachMfaDescriptionSuffix}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-lg border border-border/70 bg-card/50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="coach-mfa-device-name">{t.deviceName}</Label>
                  <Input
                    id="coach-mfa-device-name"
                    value={mfaDeviceName}
                    onChange={(event) => setMfaDeviceName(event.target.value)}
                    placeholder={t.coachPhone}
                  />
                </div>
                <Button
                  type="button"
                  className="gap-2"
                  disabled={isSettingUpMfa}
                  onClick={() => handleSetupCoachMfa(false)}
                >
                  {isSettingUpMfa ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  {mfaCoach?.totp_enabled ? t.addDevice : t.startSetup}
                </Button>
                {mfaCoach?.totp_enabled && (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isSettingUpMfa}
                    onClick={() => handleSetupCoachMfa(true)}
                  >
                    {t.resetMfa}
                  </Button>
                )}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {t.authenticatorHint}
              </p>
            </div>

            {mfaSetup && (
              <div className="grid gap-5 rounded-lg border border-border/70 bg-card/40 p-4 sm:grid-cols-[220px_1fr]">
                <div className="flex justify-center rounded-lg bg-white p-3">
                  <Image
                    src={mfaSetup.qrCode}
                    alt={t.coachMfaQrAlt}
                    width={192}
                    height={192}
                    unoptimized
                  />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t.issuer}</Label>
                    <Input value={mfaSetup.issuer ?? "Goalix Academy Coach"} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.manualSecret}</Label>
                    <Input value={mfaSetup.secret} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coach-mfa-token">{t.sixDigitCode}</Label>
                    <Input
                      id="coach-mfa-token"
                      value={mfaToken}
                      onChange={(event) => setMfaToken(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                    />
                  </div>
                  <Button
                    type="button"
                    className="gap-2"
                    disabled={isVerifyingMfa || mfaToken.length !== 6}
                    onClick={handleVerifyCoachMfa}
                  >
                    {isVerifyingMfa && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t.verifyCoachDevice}
                  </Button>
                </div>
              </div>
            )}

            {mfaCoach?.totp_enabled && (
              <div className="rounded-lg border border-border/70 bg-card/40 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{t.coachBackupCodes}</p>
                    <p className="text-sm text-muted-foreground">
                      {t.coachBackupCodesDescription}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={isRegeneratingCoachBackupCodes}
                    onClick={handleRegenerateCoachBackupCodes}
                  >
                    {isRegeneratingCoachBackupCodes ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                    {t.generateCodes}
                  </Button>
                </div>
              </div>
            )}

            {mfaBackupCodes.length > 0 && (
              <div className="rounded-lg border border-lime-400/30 bg-lime-400/10 p-4">
                <p className="font-medium text-lime-200">{t.backupCodes}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {mfaBackupCodes.map((code) => (
                    <code key={code} className="rounded-md bg-background/70 px-3 py-2 text-sm text-foreground">
                      {code}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {mfaMessage && <p className="text-sm text-lime-300">{mfaMessage}</p>}
            {mfaError && <p className="text-sm text-red-400">{mfaError}</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteCoachRow)} onOpenChange={(nextOpen) => !nextOpen && setDeleteCoachRow(null)}>
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-red-500/15 text-red-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>{t.deleteCoachForever}</DialogTitle>
            <DialogDescription>
              {t.deleteDescriptionPrefix} <span className="font-semibold text-foreground">{deleteExpected}</span> {t.deleteDescriptionSuffix}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-coach-confirm">{t.confirmation}</Label>
            <Input
              id="delete-coach-confirm"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder={deleteExpected}
            />
          </div>
          {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteCoachRow(null)}>
              {t.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeletingCoach || deleteConfirm.trim() !== deleteExpected}
              onClick={handleHardDeleteCoach}
              className="gap-2"
            >
              {isDeletingCoach && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.deleteForever}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
