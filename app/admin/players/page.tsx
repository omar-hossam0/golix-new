"use client";

import { useCallback, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { PlayerImportDialog } from "@/components/players/PlayerImportDialog";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getInitials, formatDate } from "@/lib/utils";
import {
  AlertTriangle,
  Loader2,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  useCreatePlayerMutation,
  useGetBranchesQuery,
  useHardDeletePlayerMutation,
  useGetPlayersQuery,
  useUpdatePlayerMutation,
  type PlayerRow,
} from "@/lib/store/api/adminApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";

type ApiErrorDetails = {
  data?: {
    error?: {
      message?: string;
      details?: { message?: string }[];
    };
  };
};

function getApiErrorMessage(err: unknown, fallback: string) {
  const apiError = err as ApiErrorDetails;
  const details = apiError.data?.error?.details
    ?.map((item) => item.message)
    .filter(Boolean);
  return details?.length
    ? details.join(". ")
    : (apiError.data?.error?.message ?? fallback);
}

function calculateAge(birthDate: string) {
  if (!birthDate) return "";
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate()))
    age -= 1;
  return age >= 0 ? String(age) : "";
}

const GUARDIAN_RELATIONS = [
  { value: "father", label: { en: "Father", ar: "الأب" } },
  { value: "mother", label: { en: "Mother", ar: "الأم" } },
  { value: "paternal_uncle", label: { en: "Paternal Uncle", ar: "العم" } },
  { value: "maternal_uncle", label: { en: "Maternal Uncle", ar: "الخال" } },
  { value: "paternal_aunt", label: { en: "Paternal Aunt", ar: "العمة" } },
  { value: "maternal_aunt", label: { en: "Maternal Aunt", ar: "الخالة" } },
  { value: "grandfather", label: { en: "Grandfather", ar: "الجد" } },
  { value: "grandmother", label: { en: "Grandmother", ar: "الجدة" } },
  { value: "older_brother", label: { en: "Older Brother", ar: "الأخ الأكبر" } },
  { value: "older_sister", label: { en: "Older Sister", ar: "الأخت الكبرى" } },
  { value: "legal_guardian", label: { en: "Legal Guardian", ar: "ولي الأمر القانوني" } },
  { value: "other", label: { en: "Other", ar: "أخرى" } },
] as const;

const playersCopy = {
  en: {
    player: "Player",
    completeProfile: "Complete profile",
    completeProfileRequired: "Complete profile required",
    born: "Born",
    noDob: "No DOB",
    joined: "Joined",
    level: "Level",
    notAvailable: "N/A",
    trend: "Trend",
    improving: "Improving",
    declining: "Declining",
    stable: "Stable",
    status: "Status",
    inactive: "Inactive",
    active: "Active",
    actions: "Actions",
    edit: "Edit",
    activate: "Activate",
    setInactive: "Set inactive",
    deleteForever: "Delete forever",
    requiredBasicsError: "Fill all required player basics.",
    positiveNumbersError: "Height and weight must be valid positive numbers.",
    createError: "Could not create player. Please check the entered data.",
    deleteConfirmPrefix: "delete forever",
    deleteConfirmError: "Type \"{expected}\" to confirm deletion.",
    deleteError: "Could not permanently delete player.",
    loadError: "Failed to load players.",
    retry: "Retry",
    playersTitle: "Players",
    pageDescription: "View and manage all registered players.",
    dashboard: "Dashboard",
    addPlayer: "Add Player",
    searchPlaceholder: "Search players...",
    addPlayerDescription:
      "Create the required player basics. Matching groups are assigned automatically from birth year.",
    name: "Name",
    birthDate: "Birth date",
    age: "Age",
    autoCalculated: "Auto calculated",
    gender: "Gender",
    chooseGender: "Choose gender...",
    male: "Male",
    female: "Female",
    other: "Other",
    height: "Height (cm)",
    weight: "Weight (kg)",
    preferredFoot: "Preferred Foot",
    chooseFoot: "Choose foot...",
    right: "Right",
    left: "Left",
    dateJoinedAcademy: "Date Joined Academy",
    nationality: "Nationality",
    phoneNumber: "Phone Number",
    guardianName: "Guardian Name",
    guardianNamePlaceholder: "Parent or guardian name",
    guardianPhone: "Guardian Phone",
    guardianPhonePlaceholder: "Parent or guardian phone",
    guardianRelation: "Guardian Relation",
    chooseRelation: "Choose relation",
    username: "Username",
    password: "Password",
    branch: "Branch",
    chooseBranch: "Choose branch...",
    address: "Address",
    close: "Close",
    createPlayer: "Create Player",
    deleteTitle: "Delete Player Forever",
    deleteDescription:
      "This permanently removes the player profile and linked player login account. Type",
    toConfirm: "to confirm.",
    confirmation: "Confirmation",
    cancel: "Cancel",
  },
  ar: {
    player: "اللاعب",
    completeProfile: "الملف مكتمل",
    completeProfileRequired: "يلزم استكمال الملف",
    born: "تاريخ الميلاد",
    noDob: "لا يوجد تاريخ ميلاد",
    joined: "انضم",
    level: "المستوى",
    notAvailable: "غير متاح",
    trend: "الاتجاه",
    improving: "يتحسن",
    declining: "يتراجع",
    stable: "مستقر",
    status: "الحالة",
    inactive: "غير نشط",
    active: "نشط",
    actions: "الإجراءات",
    edit: "تعديل",
    activate: "تفعيل",
    setInactive: "تعطيل",
    deleteForever: "حذف نهائي",
    requiredBasicsError: "املأ كل بيانات اللاعب الأساسية المطلوبة.",
    positiveNumbersError: "يجب أن يكون الطول والوزن أرقامًا صحيحة موجبة.",
    createError: "تعذر إنشاء اللاعب. راجع البيانات المدخلة.",
    deleteConfirmPrefix: "احذف نهائيًا",
    deleteConfirmError: "اكتب \"{expected}\" لتأكيد الحذف.",
    deleteError: "تعذر حذف اللاعب نهائيًا.",
    loadError: "فشل تحميل اللاعبين.",
    retry: "إعادة المحاولة",
    playersTitle: "اللاعبون",
    pageDescription: "عرض وإدارة كل اللاعبين المسجلين.",
    dashboard: "لوحة التحكم",
    addPlayer: "إضافة لاعب",
    searchPlaceholder: "ابحث في اللاعبين...",
    addPlayerDescription:
      "أنشئ بيانات اللاعب الأساسية المطلوبة. يتم تعيين المجموعات تلقائيًا حسب سنة الميلاد.",
    name: "الاسم",
    birthDate: "تاريخ الميلاد",
    age: "العمر",
    autoCalculated: "يحسب تلقائيًا",
    gender: "النوع",
    chooseGender: "اختر النوع...",
    male: "ذكر",
    female: "أنثى",
    other: "أخرى",
    height: "الطول (سم)",
    weight: "الوزن (كجم)",
    preferredFoot: "القدم المفضلة",
    chooseFoot: "اختر القدم...",
    right: "اليمنى",
    left: "اليسرى",
    dateJoinedAcademy: "تاريخ الانضمام للأكاديمية",
    nationality: "الجنسية",
    phoneNumber: "رقم الهاتف",
    guardianName: "اسم ولي الأمر",
    guardianNamePlaceholder: "اسم ولي الأمر",
    guardianPhone: "هاتف ولي الأمر",
    guardianPhonePlaceholder: "رقم هاتف ولي الأمر",
    guardianRelation: "صلة ولي الأمر",
    chooseRelation: "اختر الصلة",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    branch: "الفرع",
    chooseBranch: "اختر الفرع...",
    address: "العنوان",
    close: "إغلاق",
    createPlayer: "إنشاء لاعب",
    deleteTitle: "حذف اللاعب نهائيًا",
    deleteDescription:
      "سيتم حذف ملف اللاعب وحساب تسجيل الدخول المرتبط به نهائيًا. اكتب",
    toConfirm: "للتأكيد.",
    confirmation: "التأكيد",
    cancel: "إلغاء",
  },
} as const;

export default function PlayersPage() {
  const router = useRouter();
  const language = useDashboardLanguage();
  const t = playersCopy[language];
  const [open, setOpen] = useState(false);
  const emptyCreateForm = () => ({
    fullName: "",
    birthDate: "",
    heightCm: "",
    weightKg: "",
    preferredFoot: "",
    dateJoined: new Date().toISOString().slice(0, 10),
    username: "",
    password: "",
    gender: "",
    nationality: "",
    phone: "",
    guardianName: "",
    guardianPhone: "",
    guardianRelation: "",
    address: "",
    branchId: "",
  });
  const [form, setForm] = useState(emptyCreateForm);
  const [formError, setFormError] = useState("");
  const [deletePlayerRow, setDeletePlayerRow] = useState<PlayerRow | null>(
    null,
  );
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const { data, isLoading, isError, refetch } = useGetPlayersQuery({
    limit: 50,
  });
  const { data: branches = [] } = useGetBranchesQuery();
  const [createPlayer, { isLoading: isCreating }] = useCreatePlayerMutation();
  const [updatePlayer, { isLoading: isUpdating }] = useUpdatePlayerMutation();
  const [hardDeletePlayer, { isLoading: isHardDeleting }] =
    useHardDeletePlayerMutation();

  const openDelete = useCallback((player: PlayerRow) => {
    setDeletePlayerRow(player);
    setDeleteConfirm("");
    setDeleteError("");
  }, []);

  const columns = useMemo<Column<PlayerRow>[]>(
    () => [
      {
        key: "name",
        header: t.player,
        accessor: (row) => (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/20 text-sm text-primary">
                {getInitials(row.full_name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">{row.full_name}</p>
                <Badge variant={row.profile_status === "complete" ? "success" : "warning"}>
                  {row.profile_status === "complete" ? t.completeProfile : t.completeProfileRequired}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {row.position ?? "-"} -{" "}
                {row.date_of_birth
                  ? `${t.born} ${formatDate(row.date_of_birth)}`
                  : t.noDob}{" "}
                - {t.joined} {formatDate(row.date_joined ?? row.created_at)}
              </p>
            </div>
          </div>
        ),
        sortable: true,
        sortValue: (row) => row.full_name,
      },
      {
        key: "level",
        header: t.level,
        accessor: (row) => (
          <Badge
            variant={
              row.level === "A"
                ? "success"
                : row.level === "B" || row.level === "C"
                  ? "warning"
                  : "destructive"
            }
          >
            {row.level ? `${t.level} ${row.level}` : t.notAvailable}
          </Badge>
        ),
        sortable: true,
        sortValue: (row) => row.level ?? "",
      },
      {
        key: "trend",
        header: t.trend,
        accessor: (row) => (
          <div className="flex items-center gap-1.5">
            {row.level === "A" ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            ) : row.level === "D" || row.level === "F" ? (
              <TrendingDown className="h-3.5 w-3.5 text-red-400" />
            ) : (
              <Minus className="h-3.5 w-3.5 text-amber-400" />
            )}
            <span className="text-xs font-medium text-muted-foreground">
              {row.level === "A"
                ? t.improving
                : row.level === "D" || row.level === "F"
                  ? t.declining
                  : t.stable}
            </span>
          </div>
        ),
        sortable: true,
        sortValue: (row) => row.level ?? "",
      },
      {
        key: "joined",
        header: t.joined,
        accessor: (row) => (
          <span className="text-xs text-muted-foreground">
            {formatDate(row.date_joined ?? row.created_at)}
          </span>
        ),
        sortable: true,
        sortValue: (row) => row.date_joined ?? row.created_at,
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
      {
        key: "actions",
        header: t.actions,
        className: "text-right",
        accessor: (row) => (
          <div
            className="flex flex-wrap justify-end gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => router.push(`/admin/players/${row.id}`)}
            >
              <Pencil className="h-3.5 w-3.5" />
              {t.edit}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={isUpdating}
              onClick={() =>
                updatePlayer({
                  id: row.id,
                  body: { isActive: row.is_active === false },
                })
              }
            >
              {row.is_active === false ? (
                <UserCheck className="h-3.5 w-3.5" />
              ) : (
                <UserX className="h-3.5 w-3.5" />
              )}
              {row.is_active === false ? t.activate : t.setInactive}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              onClick={() => openDelete(row)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t.deleteForever}
            </Button>
          </div>
        ),
      },
    ],
    [isUpdating, openDelete, router, t, updatePlayer],
  );

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleCreatePlayer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    const requiredValues = [
      form.fullName.trim(),
      form.birthDate,
      form.heightCm,
      form.weightKg,
      form.preferredFoot,
      form.dateJoined,
      form.username.trim(),
      form.password,
      form.gender,
      form.nationality.trim(),
      form.phone.trim(),
      form.address.trim(),
      form.branchId,
      form.guardianName.trim(),
      form.guardianPhone.trim(),
      form.guardianRelation,
    ];
    if (requiredValues.some((value) => !value)) {
      setFormError(t.requiredBasicsError);
      return;
    }
    if (Number(form.heightCm) <= 0 || Number(form.weightKg) <= 0) {
      setFormError(t.positiveNumbersError);
      return;
    }

    try {
      await createPlayer({
        fullName: form.fullName.trim(),
        birthDate: form.birthDate,
        heightCm: Number(form.heightCm),
        weightKg: Number(form.weightKg),
        preferredFoot: form.preferredFoot as "left" | "right",
        dateJoined: form.dateJoined,
        username: form.username.trim(),
        password: form.password,
        gender: form.gender as "male" | "female" | "other",
        nationality: form.nationality.trim(),
        phone: form.phone.trim(),
        guardianName: form.guardianName.trim() || undefined,
        guardianPhone: form.guardianPhone.trim() || undefined,
        guardianRelation: form.guardianRelation.trim() || undefined,
        address: form.address.trim(),
        branchId: form.branchId,
      }).unwrap();
      setForm(emptyCreateForm());
      setOpen(false);
    } catch (err) {
      setFormError(
        getApiErrorMessage(
          err,
          t.createError,
        ),
      );
    }
  };

  const handleDeletePlayer = async () => {
    if (!deletePlayerRow) return;
    const expected = `${t.deleteConfirmPrefix} ${deletePlayerRow.full_name}`;
    setDeleteError("");
    if (deleteConfirm.trim() !== expected) {
      setDeleteError(t.deleteConfirmError.replace("{expected}", expected));
      return;
    }

    try {
      await hardDeletePlayer(deletePlayerRow.id).unwrap();
      setDeletePlayerRow(null);
      setDeleteConfirm("");
    } catch (err) {
      setDeleteError(
        getApiErrorMessage(err, t.deleteError),
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">{t.loadError}</p>
        <Button variant="outline" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-4 w-4" />
          {t.retry}
        </Button>
      </div>
    );
  }

  const players = data?.data ?? [];
  const deleteExpected = `${t.deleteConfirmPrefix} ${deletePlayerRow?.full_name ?? ""}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={`${t.playersTitle} (${data?.pagination?.total ?? players.length})`}
        description={t.pageDescription}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.playersTitle },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PlayerImportDialog role="admin" />
            <Button className="gap-1.5" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              {t.addPlayer}
            </Button>
          </div>
        }
      />

      <DataTable
        data={players}
        columns={columns}
        searchable
        searchPlaceholder={t.searchPlaceholder}
        searchKey={(row) => `${row.full_name} ${row.position ?? ""}`}
        onRowClick={(row) => router.push(`/admin/players/${row.id}`)}
      />

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t.addPlayer}</DialogTitle>
            <DialogDescription>
              {t.addPlayerDescription}
            </DialogDescription>
          </DialogHeader>
          <form
            className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
            onSubmit={handleCreatePlayer}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="player-full-name">{t.name}</Label>
                <Input
                  id="player-full-name"
                  value={form.fullName}
                  onChange={(event) =>
                    updateForm("fullName", event.target.value)
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-birth-date">{t.birthDate}</Label>
                <Input
                  id="player-birth-date"
                  type="date"
                  value={form.birthDate}
                  onChange={(event) =>
                    updateForm("birthDate", event.target.value)
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-age">{t.age}</Label>
                <Input
                  id="player-age"
                  value={calculateAge(form.birthDate)}
                  readOnly
                  placeholder={t.autoCalculated}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.gender}</Label>
                <Select
                  value={form.gender}
                  onValueChange={(value) => updateForm("gender", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.chooseGender} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t.male}</SelectItem>
                    <SelectItem value="female">{t.female}</SelectItem>
                    <SelectItem value="other">{t.other}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-height">{t.height}</Label>
                <Input
                  id="player-height"
                  type="number"
                  min={1}
                  max={250}
                  value={form.heightCm}
                  onChange={(event) =>
                    updateForm("heightCm", event.target.value)
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-weight">{t.weight}</Label>
                <Input
                  id="player-weight"
                  type="number"
                  min={1}
                  max={200}
                  value={form.weightKg}
                  onChange={(event) =>
                    updateForm("weightKg", event.target.value)
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.preferredFoot}</Label>
                <Select
                  value={form.preferredFoot}
                  onValueChange={(value) => updateForm("preferredFoot", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.chooseFoot} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="right">{t.right}</SelectItem>
                    <SelectItem value="left">{t.left}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-date-joined">{t.dateJoinedAcademy}</Label>
                <Input
                  id="player-date-joined"
                  type="date"
                  value={form.dateJoined}
                  onChange={(event) =>
                    updateForm("dateJoined", event.target.value)
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-nationality">{t.nationality}</Label>
                <Input
                  id="player-nationality"
                  value={form.nationality}
                  onChange={(event) =>
                    updateForm("nationality", event.target.value)
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-phone">{t.phoneNumber}</Label>
                <Input
                  id="player-phone"
                  value={form.phone}
                  onChange={(event) => updateForm("phone", event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-guardian-name">{t.guardianName}</Label>
                <Input
                  id="player-guardian-name"
                  value={form.guardianName}
                  onChange={(event) =>
                    updateForm("guardianName", event.target.value)
                  }
                  placeholder={t.guardianNamePlaceholder}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-guardian-phone">{t.guardianPhone}</Label>
                <Input
                  id="player-guardian-phone"
                  value={form.guardianPhone}
                  onChange={(event) =>
                    updateForm("guardianPhone", event.target.value)
                  }
                  placeholder={t.guardianPhonePlaceholder}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-guardian-relation">
                  {t.guardianRelation}
                </Label>
                <Select
                  value={form.guardianRelation}
                  onValueChange={(value) =>
                    updateForm("guardianRelation", value)
                  }
                >
                  <SelectTrigger id="player-guardian-relation">
                    <SelectValue placeholder={t.chooseRelation} />
                  </SelectTrigger>
                  <SelectContent>
                    {GUARDIAN_RELATIONS.map((relation) => (
                      <SelectItem key={relation.value} value={relation.value}>
                        {relation.label[language]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-username">{t.username}</Label>
                <Input
                  id="player-username"
                  value={form.username}
                  onChange={(event) =>
                    updateForm("username", event.target.value)
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player-password">{t.password}</Label>
                <Input
                  id="player-password"
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    updateForm("password", event.target.value)
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.branch}</Label>
                <Select
                  value={form.branchId}
                  onValueChange={(value) => updateForm("branchId", value)}
                >
                  <SelectTrigger>
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
                <Label htmlFor="player-address">{t.address}</Label>
                <Input
                  id="player-address"
                  value={form.address}
                  onChange={(event) =>
                    updateForm("address", event.target.value)
                  }
                  required
                />
              </div>
            </div>
            {formError && <p className="text-sm text-red-400">{formError}</p>}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                {t.close}
              </Button>
              <Button
                type="submit"
                disabled={
                  isCreating ||
                  !form.fullName.trim() ||
                  !form.birthDate ||
                  !form.branchId
                }
                className="gap-2"
              >
                {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.createPlayer}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deletePlayerRow)}
        onOpenChange={(nextOpen) => !nextOpen && setDeletePlayerRow(null)}
      >
        <DialogContent>
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-red-500/15 text-red-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>{t.deleteTitle}</DialogTitle>
            <DialogDescription>
              {t.deleteDescription}{" "}
              <span className="font-semibold text-foreground">
                {deleteExpected}
              </span>{" "}
              {t.toConfirm}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-player-confirm">{t.confirmation}</Label>
            <Input
              id="delete-player-confirm"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder={deleteExpected}
            />
          </div>
          {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeletePlayerRow(null)}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                isHardDeleting || deleteConfirm.trim() !== deleteExpected
              }
              onClick={handleDeletePlayer}
              className="gap-2"
            >
              {isHardDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.deleteForever}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
