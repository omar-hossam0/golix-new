"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ChevronRight,
  Loader2,
  Plus,
  Search,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PlayerImportDialog } from "@/components/players/PlayerImportDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useCompleteCoachPlayerProfileMutation,
  useCreateCoachBasicPlayerMutation,
  type CustomField,
  useGetCoachPlayerCustomProfileQuery,
  useGetCoachPlayersScopedQuery,
  useGetCustomCategoriesQuery,
} from "@/lib/store/api/calendarApi";
import {
  useGetCoachAccessStatusQuery,
  useGetCoachBirthdaysQuery,
} from "@/lib/store/api/coachApi";
import { useCoachPermissions } from "@/lib/hooks/useCoachPermissions";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { getInitials } from "@/lib/utils";

const GUARDIAN_RELATIONS = [
  "father",
  "mother",
  "paternal_uncle",
  "maternal_uncle",
  "paternal_aunt",
  "maternal_aunt",
  "grandfather",
  "grandmother",
  "older_brother",
  "older_sister",
  "legal_guardian",
  "other",
] as const;

const copy = {
  en: {
    players: "Players",
    pageDescription: "Create a basic player first, then complete the profile before football operations.",
    home: "Home",
    addPlayer: "Add Player",
    search: "Search",
    searchPlaceholder: "Search name, position, guardian...",
    status: "Status",
    allPlayers: "All players",
    complete: "Complete",
    incomplete: "Incomplete",
    filterByCustomField: "Filter by custom field",
    chooseField: "Choose field",
    value: "Value",
    chooseOption: "Choose option",
    searchCustomValue: "Search custom value",
    chooseCustomFieldFirst: "Choose a custom field first",
    clear: "Clear",
    shown: "shown",
    filteringHint: "Filtering scans your assigned birthdays and groups only.",
    noOptionsThisField: "This field has no options yet.",
    selectOption: "Select option",
    noOptionsConfigured: "No options configured.",
    addBasicPlayerInfo: "Add Basic Player Info",
    addBasicDescription: "Create the required player basics before completing custom profile fields.",
    name: "Name",
    birthDate: "Birth Date",
    age: "Age",
    autoCalculated: "Auto calculated",
    branch: "Branch",
    selectBranch: "Select branch",
    branchHint: "The player will be matched automatically to an assigned birthday by birth date.",
    heightCm: "Height (cm)",
    weightKg: "Weight (kg)",
    preferredFoot: "Preferred Foot",
    chooseFoot: "Choose foot",
    right: "Right",
    left: "Left",
    dateJoinedAcademy: "Date Joined Academy",
    gender: "Gender",
    chooseGender: "Choose gender",
    male: "Male",
    female: "Female",
    other: "Other",
    nationality: "Nationality",
    phoneNumber: "Phone Number",
    username: "Username",
    password: "Password",
    guardianPhone: "Guardian Phone",
    guardianRelation: "Guardian Relation",
    chooseRelation: "Choose relation",
    guardianName: "Guardian Name",
    address: "Address",
    saveBasicInfo: "Save Basic Info",
    completePlayerCustomProfile: "Complete Player Custom Profile",
    completeDescription: "Fill required custom fields before this player becomes ready for football operations.",
    loadingCustomProfileFields: "Loading custom profile fields...",
    noCustomFields: "No custom fields configured yet. The player can be completed once the profile structure is added.",
    completeProfile: "Complete Profile",
    completeProfileAction: "Complete profile",
    loadingPlayers: "Loading players...",
    mainPositionNotSet: "Main position not set",
    noGuardianPhone: "No guardian phone",
    permissionRequired: "Profile completion requires player management permission",
    readyForOperations: "Ready for operations",
    noPlayersAssigned: "No players in your assigned birthdays.",
    noAssignmentsError: "Your coach account has not been assigned yet.",
    fillBasicsError: "Fill all required player basics.",
    invalidMeasurementError: "Height and weight must be valid positive numbers.",
    createError: "Could not create player.",
    completeError: "Could not complete player profile.",
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
    players: "اللاعبون",
    pageDescription: "أنشئ بيانات اللاعب الأساسية أولًا، ثم أكمل الملف قبل عمليات كرة القدم.",
    home: "الرئيسية",
    addPlayer: "إضافة لاعب",
    search: "البحث",
    searchPlaceholder: "ابحث بالاسم أو المركز أو ولي الأمر...",
    status: "الحالة",
    allPlayers: "كل اللاعبين",
    complete: "مكتمل",
    incomplete: "غير مكتمل",
    filterByCustomField: "فلترة بحقل مخصص",
    chooseField: "اختر الحقل",
    value: "القيمة",
    chooseOption: "اختر خيارًا",
    searchCustomValue: "ابحث عن قيمة مخصصة",
    chooseCustomFieldFirst: "اختر حقلًا مخصصًا أولًا",
    clear: "مسح",
    shown: "ظاهر",
    filteringHint: "الفلترة تبحث داخل سنوات الميلاد والمجموعات المعينة لك فقط.",
    noOptionsThisField: "هذا الحقل لا يحتوي على خيارات بعد.",
    selectOption: "اختر خيارًا",
    noOptionsConfigured: "لا توجد خيارات مهيأة.",
    addBasicPlayerInfo: "إضافة بيانات اللاعب الأساسية",
    addBasicDescription: "أنشئ البيانات الأساسية المطلوبة قبل إكمال حقول الملف المخصص.",
    name: "الاسم",
    birthDate: "تاريخ الميلاد",
    age: "العمر",
    autoCalculated: "يُحسب تلقائيًا",
    branch: "الفرع",
    selectBranch: "اختر الفرع",
    branchHint: "سيتم مطابقة اللاعب تلقائيًا مع سنة ميلاد معينة حسب تاريخ الميلاد.",
    heightCm: "الطول (سم)",
    weightKg: "الوزن (كجم)",
    preferredFoot: "القدم المفضلة",
    chooseFoot: "اختر القدم",
    right: "اليمنى",
    left: "اليسرى",
    dateJoinedAcademy: "تاريخ الانضمام للأكاديمية",
    gender: "النوع",
    chooseGender: "اختر النوع",
    male: "ذكر",
    female: "أنثى",
    other: "آخر",
    nationality: "الجنسية",
    phoneNumber: "رقم الهاتف",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    guardianPhone: "هاتف ولي الأمر",
    guardianRelation: "صلة ولي الأمر",
    chooseRelation: "اختر الصلة",
    guardianName: "اسم ولي الأمر",
    address: "العنوان",
    saveBasicInfo: "حفظ البيانات الأساسية",
    completePlayerCustomProfile: "إكمال ملف اللاعب المخصص",
    completeDescription: "املأ الحقول المخصصة المطلوبة قبل أن يصبح اللاعب جاهزًا لعمليات كرة القدم.",
    loadingCustomProfileFields: "جاري تحميل حقول الملف المخصص...",
    noCustomFields: "لا توجد حقول مخصصة مهيأة بعد. يمكن إكمال اللاعب بعد إضافة بنية الملف.",
    completeProfile: "إكمال الملف",
    completeProfileAction: "إكمال الملف",
    loadingPlayers: "جاري تحميل اللاعبين...",
    mainPositionNotSet: "المركز الأساسي غير محدد",
    noGuardianPhone: "لا يوجد هاتف ولي أمر",
    permissionRequired: "إكمال الملف يتطلب صلاحية إدارة اللاعبين",
    readyForOperations: "جاهز للعمليات",
    noPlayersAssigned: "لا يوجد لاعبون في سنوات الميلاد المعينة لك.",
    noAssignmentsError: "حساب المدرب الخاص بك لم يتم تعيينه بعد.",
    fillBasicsError: "املأ كل بيانات اللاعب الأساسية المطلوبة.",
    invalidMeasurementError: "الطول والوزن يجب أن يكونا أرقامًا موجبة صحيحة.",
    createError: "تعذر إنشاء اللاعب.",
    completeError: "تعذر إكمال ملف اللاعب.",
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
  const detailMessages = apiError.data?.error?.details
    ?.map((detail) => detail.message)
    .filter(Boolean);

  return detailMessages?.length
    ? detailMessages.join(". ")
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

const normalizeKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const textValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const joined = value.map(textValue).filter(Boolean).join(", ");
    return joined || null;
  }
  return null;
};

const customProfileValue = (
  player: { customProfile?: Array<{ key: string; label: string; value: unknown }> },
  keys: string[],
) => {
  const normalizedKeys = new Set(keys.map(normalizeKey));
  for (const field of player.customProfile ?? []) {
    if (
      normalizedKeys.has(normalizeKey(field.key)) ||
      normalizedKeys.has(normalizeKey(field.label))
    ) {
      const value = textValue(field.value);
      if (value) return value;
    }
  }
  return null;
};

const mainPositionForPlayer = (
  player: {
    position?: string | null;
    customProfile?: Array<{ key: string; label: string; value: unknown }>;
  },
) =>
  customProfileValue(player, ["main_position", "main position"]) ||
  player.position ||
  null;

function CoachPlayersFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

export default function CoachPlayersPage() {
  return (
    <Suspense fallback={<CoachPlayersFallback />}>
      <CoachPlayersContent />
    </Suspense>
  );
}

function CoachPlayersContent() {
  const language = useDashboardLanguage();
  const t = copy[language];
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can, isLoading: loadingPermissions } = useCoachPermissions();
  const canManagePlayers = can("can_manage_players");
  const [filter, setFilter] = useState({
    search: "",
    status: "all",
    customFieldId: "",
    customValue: "",
    customOptionId: "",
  });
  const { data: customCategories = [] } = useGetCustomCategoriesQuery({
    role: "coach",
    targetModule: "player_profile",
  });
  const { data: playersRes, isLoading } = useGetCoachPlayersScopedQuery({
    customFieldId: filter.customFieldId || undefined,
    customValue: filter.customValue || undefined,
    customOptionId: filter.customOptionId || undefined,
  });
  const { data: accessStatus } = useGetCoachAccessStatusQuery();
  const { data: birthdays = [] } = useGetCoachBirthdaysQuery();
  const [addOpen, setAddOpen] = useState(false);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const emptyBasicForm = () => ({
    fullName: "",
    birthDate: "",
    branchId: "",
    heightCm: "",
    weightKg: "",
    preferredFoot: "",
    dateJoined: new Date().toISOString().slice(0, 10),
    username: "",
    password: "",
    gender: "",
    nationality: "",
    phone: "",
    address: "",
    guardianName: "",
    guardianPhone: "",
    guardianRelation: "",
  });
  const [basic, setBasic] = useState(emptyBasicForm);
  const [createError, setCreateError] = useState("");
  const [customValues, setCustomValues] = useState<Record<string, unknown>>({});
  const [createPlayer, { isLoading: creating }] =
    useCreateCoachBasicPlayerMutation();
  const [completeProfile, { isLoading: completing }] =
    useCompleteCoachPlayerProfileMutation();
  const [completeError, setCompleteError] = useState("");
  const { data: customProfile, isLoading: loadingCustomProfile } =
    useGetCoachPlayerCustomProfileQuery(completeId ?? "", {
      skip: !completeId,
    });

  const initialCustomValues = useMemo(() => {
    const next: Record<string, unknown> = {};
    if (!customProfile) return next;
    for (const category of customProfile.categories) {
      for (const field of category.fields) {
        if (field.default_value !== null && field.default_value !== undefined)
          next[field.id] = field.default_value;
      }
    }
    for (const value of customProfile.values) {
      next[value.field_id] = value.value;
    }
    return next;
  }, [customProfile]);
  const effectiveCustomValues = useMemo(
    () => ({ ...initialCustomValues, ...customValues }),
    [customValues, initialCustomValues],
  );

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError("");
    if (!hasAssignments) {
      setCreateError(t.noAssignmentsError);
      return;
    }
    const requiredValues = [
      basic.fullName.trim(),
      basic.birthDate,
      basic.branchId,
      basic.heightCm,
      basic.weightKg,
      basic.preferredFoot,
      basic.dateJoined,
      basic.username.trim(),
      basic.password,
      basic.gender,
      basic.nationality.trim(),
      basic.phone.trim(),
      basic.address.trim(),
      basic.guardianName.trim(),
      basic.guardianPhone.trim(),
      basic.guardianRelation,
    ];
    if (requiredValues.some((value) => !value)) {
      setCreateError(t.fillBasicsError);
      return;
    }
    if (Number(basic.heightCm) <= 0 || Number(basic.weightKg) <= 0) {
      setCreateError(t.invalidMeasurementError);
      return;
    }

    try {
      await createPlayer({
        ...basic,
        heightCm: Number(basic.heightCm),
        weightKg: Number(basic.weightKg),
      }).unwrap();
      setAddOpen(false);
      setBasic(emptyBasicForm());
    } catch (err) {
      setCreateError(getApiErrorMessage(err, t.createError));
    }
  };

  const handleComplete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!completeId) return;
    setCompleteError("");
    try {
      await completeProfile({
        id: completeId,
        body: {
          customValues: Object.entries(effectiveCustomValues).map(
            ([fieldId, value]) => ({ fieldId, value }),
          ),
        },
      }).unwrap();
      setCompleteId(null);
      setCustomValues({});
      router.replace("/coach/players");
    } catch (err) {
      setCompleteError(
        getApiErrorMessage(err, t.completeError),
      );
    }
  };

  const serverPlayers = useMemo(
    () => playersRes?.data ?? [],
    [playersRes?.data],
  );

  useEffect(() => {
    const completePlayerId = searchParams.get("complete");
    if (
      completePlayerId &&
      completePlayerId !== completeId &&
      serverPlayers.some((player) => player.id === completePlayerId)
    ) {
      const timeoutId = window.setTimeout(() => {
        setCustomValues({});
        setCompleteError("");
        setCompleteId(completePlayerId);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [completeId, searchParams, serverPlayers]);
  const filterFields = customCategories.flatMap((category) => category.fields);
  const selectedFilterField = filterFields.find(
    (field) => field.id === filter.customFieldId,
  );
  const selectedFilterFieldUsesOptions =
    selectedFilterField?.field_type === "single_select" ||
    selectedFilterField?.field_type === "multi_select";
  const hasActiveFilters = Boolean(
    filter.search.trim() ||
    filter.customFieldId ||
    filter.customValue ||
    filter.customOptionId ||
    filter.status !== "all",
  );
  const players = useMemo(() => {
    const search = filter.search.trim().toLowerCase();
    return serverPlayers.filter((player) => {
      if (filter.status !== "all" && player.profile_status !== filter.status)
        return false;
      if (!search) return true;
      const mainPosition = mainPositionForPlayer(player);
      const haystack = [
        player.full_name,
        mainPosition,
        player.guardian_name,
        player.guardian_phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [filter.search, filter.status, serverPlayers]);
  const hasAssignments = accessStatus?.hasAssignments ?? birthdays.length > 0;
  const assignedBranches = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    birthdays.forEach((birthday) =>
      byId.set(birthday.branchId, {
        id: birthday.branchId,
        name: birthday.branchName,
      }),
    );
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [birthdays]);

  const setCustomValue = (fieldId: string, value: unknown) => {
    setCustomValues((current) => ({ ...current, [fieldId]: value }));
  };

  const toggleMultiValue = (
    fieldId: string,
    optionId: string,
    checked: boolean,
  ) => {
    const current = Array.isArray(customValues[fieldId])
      ? (customValues[fieldId] as string[])
      : [];
    const next = checked
      ? [...new Set([...current, optionId])]
      : current.filter((id) => id !== optionId);
    setCustomValue(fieldId, next);
  };

  const renderCustomField = (field: CustomField) => {
    const value = effectiveCustomValues[field.id];
    const label = (
      <Label>
        {field.label}
        {field.is_required ? " *" : ""}
        {field.unit ? ` (${field.unit})` : ""}
      </Label>
    );

    if (field.field_type === "long_text") {
      return (
        <div key={field.id} className="space-y-2">
          {label}
          <Textarea
            value={String(value ?? "")}
            onChange={(e) => setCustomValue(field.id, e.target.value)}
            placeholder={field.placeholder ?? undefined}
            required={field.is_required}
          />
        </div>
      );
    }

    if (field.field_type === "single_select") {
      return (
        <div key={field.id} className="space-y-2">
          {label}
          <Select
            value={String(value ?? "")}
            onValueChange={(next) => setCustomValue(field.id, next)}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder ?? t.selectOption} />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.field_type === "multi_select") {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div key={field.id} className="space-y-2">
          {label}
          <div className="grid gap-2 rounded-md border border-border/60 p-3 sm:grid-cols-2">
            {field.options.map((option) => (
              <label
                key={option.id}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option.id)}
                  onChange={(e) =>
                    toggleMultiValue(field.id, option.id, e.target.checked)
                  }
                />
                {option.label}
              </label>
            ))}
            {!field.options.length && (
              <p className="text-sm text-muted-foreground">
                {t.noOptionsConfigured}
              </p>
            )}
          </div>
        </div>
      );
    }

    if (field.field_type === "boolean") {
      return (
        <label
          key={field.id}
          className="flex items-center gap-2 rounded-md border border-border/60 p-3 text-sm"
        >
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => setCustomValue(field.id, e.target.checked)}
          />
          {field.label}
          {field.is_required ? " *" : ""}
        </label>
      );
    }

    if (field.field_type === "file" || field.field_type === "image") {
      return (
        <div key={field.id} className="space-y-2">
          {label}
          <Input
            type="file"
            accept={field.field_type === "image" ? "image/*" : undefined}
            onChange={(e) => {
              const file = e.target.files?.[0];
              setCustomValue(
                field.id,
                file
                  ? {
                      fileName: file.name,
                      fileType: file.type,
                      size: file.size,
                    }
                  : null,
              );
            }}
            required={field.is_required && !value}
          />
        </div>
      );
    }

    const inputTypeByField: Partial<Record<CustomField["field_type"], string>> =
      {
        number: "number",
        decimal: "number",
        rating: "number",
        percentage: "number",
        date: "date",
        time: "time",
        url: "url",
        phone: "tel",
        email: "email",
      };

    return (
      <div key={field.id} className="space-y-2">
        {label}
        <Input
          type={inputTypeByField[field.field_type] ?? "text"}
          value={String(value ?? "")}
          onChange={(e) => setCustomValue(field.id, e.target.value)}
          placeholder={field.placeholder ?? undefined}
          required={field.is_required}
          min={field.min_value != null ? Number(field.min_value) : undefined}
          max={field.max_value != null ? Number(field.max_value) : undefined}
          step={field.field_type === "decimal" ? "0.01" : undefined}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.players}
        description={t.pageDescription}
        breadcrumbs={[
          { label: t.home, href: "/coach/home" },
          { label: t.players },
        ]}
        actions={
          canManagePlayers ? (
            <div className="flex flex-wrap items-center gap-2">
              <PlayerImportDialog
                role="coach"
                disabled={!hasAssignments || loadingPermissions}
              />
              <Button
                className="gap-2"
                disabled={!hasAssignments || loadingPermissions}
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-4 w-4" />
                {t.addPlayer}
              </Button>
            </div>
          ) : undefined
        }
      />

      <Card className="border-border/50 bg-card">
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.2fr)_180px_minmax(220px,1fr)_minmax(220px,1fr)_auto]">
            <div className="space-y-2">
              <Label>{t.search}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={filter.search}
                  onChange={(e) =>
                    setFilter((p) => ({ ...p, search: e.target.value }))
                  }
                  placeholder={t.searchPlaceholder}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t.status}</Label>
              <Select
                value={filter.status}
                onValueChange={(value) =>
                  setFilter((p) => ({ ...p, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.allPlayers}</SelectItem>
                  <SelectItem value="complete">{t.complete}</SelectItem>
                  <SelectItem value="incomplete">{t.incomplete}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.filterByCustomField}</Label>
              <Select
                value={filter.customFieldId}
                onValueChange={(value) =>
                  setFilter((p) => ({
                    ...p,
                    customFieldId: value,
                    customValue: "",
                    customOptionId: "",
                  }))
                }
                >
                  <SelectTrigger>
                  <SelectValue placeholder={t.chooseField} />
                </SelectTrigger>
                <SelectContent>
                  {filterFields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.label} ({field.field_type.replace("_", " ")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.value}</Label>
              {selectedFilterFieldUsesOptions ? (
                <Select
                  value={filter.customOptionId}
                  onValueChange={(value) =>
                    setFilter((p) => ({
                      ...p,
                      customOptionId: value,
                      customValue: "",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.chooseOption} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedFilterField.options.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  type={
                    selectedFilterField?.field_type === "date"
                      ? "date"
                      : selectedFilterField?.field_type === "number" ||
                          selectedFilterField?.field_type === "decimal"
                        ? "number"
                        : "text"
                  }
                  value={filter.customValue}
                  onChange={(e) =>
                    setFilter((p) => ({
                      ...p,
                      customValue: e.target.value,
                      customOptionId: "",
                    }))
                  }
                  placeholder={
                    selectedFilterField
                      ? t.searchCustomValue
                      : t.chooseCustomFieldFirst
                  }
                  disabled={!filter.customFieldId}
                />
              )}
            </div>
            <Button
              variant="outline"
              className="self-end"
              disabled={!hasActiveFilters}
              onClick={() =>
                setFilter({
                  search: "",
                  status: "all",
                  customFieldId: "",
                  customValue: "",
                  customOptionId: "",
                })
              }
            >
              {t.clear}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{players.length} {t.shown}</Badge>
            <span>
              {t.filteringHint}
            </span>
            {selectedFilterFieldUsesOptions &&
              !selectedFilterField.options.length && (
                <span className="text-amber-300">
                  {t.noOptionsThisField}
                </span>
              )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={addOpen}
        onOpenChange={(nextOpen) => {
          setAddOpen(nextOpen);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t.addBasicPlayerInfo}</DialogTitle>
            <DialogDescription>
              {t.addBasicDescription}
            </DialogDescription>
          </DialogHeader>
          <form
            className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
            onSubmit={handleAdd}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.name}</Label>
                <Input
                  value={basic.fullName}
                  onChange={(e) =>
                    setBasic((p) => ({ ...p, fullName: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.birthDate}</Label>
                <Input
                  type="date"
                  value={basic.birthDate}
                  onChange={(e) =>
                    setBasic((p) => ({ ...p, birthDate: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.age}</Label>
                <Input
                  value={calculateAge(basic.birthDate)}
                  readOnly
                  placeholder={t.autoCalculated}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.branch}</Label>
                <Select
                  value={basic.branchId}
                  onValueChange={(value) =>
                    setBasic((p) => ({ ...p, branchId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.selectBranch} />
                  </SelectTrigger>
                  <SelectContent>
                    {assignedBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t.branchHint}
                </p>
              </div>
              <div className="space-y-2">
                <Label>{t.heightCm}</Label>
                <Input
                  type="number"
                  min={1}
                  max={250}
                  value={basic.heightCm}
                  onChange={(e) =>
                    setBasic((p) => ({ ...p, heightCm: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.weightKg}</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={basic.weightKg}
                  onChange={(e) =>
                    setBasic((p) => ({ ...p, weightKg: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.preferredFoot}</Label>
                <Select
                  value={basic.preferredFoot}
                  onValueChange={(value) =>
                    setBasic((p) => ({ ...p, preferredFoot: value }))
                  }
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
                <Label>{t.dateJoinedAcademy}</Label>
                <Input
                  type="date"
                  value={basic.dateJoined}
                  onChange={(e) =>
                    setBasic((p) => ({ ...p, dateJoined: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.gender}</Label>
                <Select
                  value={basic.gender}
                  onValueChange={(value) =>
                    setBasic((p) => ({ ...p, gender: value }))
                  }
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
                <Label>{t.nationality}</Label>
                <Input
                  value={basic.nationality}
                  onChange={(e) =>
                    setBasic((p) => ({ ...p, nationality: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.phoneNumber}</Label>
                <Input
                  value={basic.phone}
                  onChange={(e) =>
                    setBasic((p) => ({ ...p, phone: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.username}</Label>
                <Input
                  value={basic.username}
                  onChange={(e) =>
                    setBasic((p) => ({ ...p, username: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.password}</Label>
                <Input
                  type="password"
                  value={basic.password}
                  onChange={(e) =>
                    setBasic((p) => ({ ...p, password: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.guardianPhone}</Label>
                <Input
                  value={basic.guardianPhone}
                  onChange={(e) =>
                    setBasic((p) => ({ ...p, guardianPhone: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.guardianRelation}</Label>
                <Select
                  value={basic.guardianRelation}
                  onValueChange={(value) =>
                    setBasic((p) => ({ ...p, guardianRelation: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.chooseRelation} />
                  </SelectTrigger>
                  <SelectContent>
                    {GUARDIAN_RELATIONS.map((relation) => (
                      <SelectItem key={relation} value={relation}>
                        {t.guardianRelations[relation]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t.guardianName}</Label>
              <Input
                value={basic.guardianName}
                onChange={(e) =>
                  setBasic((p) => ({ ...p, guardianName: e.target.value }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t.address}</Label>
              <Input
                value={basic.address}
                onChange={(e) =>
                  setBasic((p) => ({ ...p, address: e.target.value }))
                }
                required
              />
            </div>
            {createError && (
              <p className="text-sm text-red-400">{createError}</p>
            )}
            <DialogFooter>
              <Button
                type="submit"
                disabled={
                  creating ||
                  !basic.branchId ||
                  !hasAssignments
                }
                className="gap-2"
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.saveBasicInfo}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(completeId)}
        onOpenChange={(open) => {
          if (!open) {
            setCompleteId(null);
            setCustomValues({});
            setCompleteError("");
            router.replace("/coach/players");
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t.completePlayerCustomProfile}</DialogTitle>
            <DialogDescription>
              {t.completeDescription}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleComplete}>
            {loadingCustomProfile ? (
              <div className="flex items-center gap-2 rounded-md border border-border/60 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.loadingCustomProfileFields}
              </div>
            ) : (
              <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
                {customProfile?.categories.map((category) => (
                  <section key={category.id} className="space-y-3">
                    <div>
                      <h3 className="font-semibold">{category.name}</h3>
                      {category.description && (
                        <p className="text-sm text-muted-foreground">
                          {category.description}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {category.fields.map(renderCustomField)}
                    </div>
                  </section>
                ))}
                {!customProfile?.categories.length && (
                  <p className="rounded-md border border-border/60 p-4 text-sm text-muted-foreground">
                    {t.noCustomFields}
                  </p>
                )}
              </div>
            )}
            {completeError && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {completeError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="submit"
                disabled={completing || loadingCustomProfile}
                className="gap-2"
              >
                {completing && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.completeProfile}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loadingPlayers}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {players.map((player) => {
            const mainPosition = mainPositionForPlayer(player);
            return (
              <Card
                key={player.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer border-border/50 bg-card transition hover:border-primary/50 hover:bg-muted/30"
                onClick={() => router.push(`/coach/players/${player.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(`/coach/players/${player.id}`);
                  }
                }}
              >
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/20 text-primary">
                        {getInitials(player.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{player.full_name}</p>
                        <Badge
                          variant={
                            player.profile_status === "complete"
                              ? "success"
                              : "warning"
                          }
                        >
                          {player.profile_status === "complete"
                            ? t.complete
                            : t.incomplete}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {mainPosition || t.mainPositionNotSet} -{" "}
                        {player.guardian_phone || t.noGuardianPhone}
                      </p>
                    </div>
                  </div>
                  {player.profile_status !== "complete" ? (
                    canManagePlayers ? (
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={(event) => {
                          event.stopPropagation();
                          setCustomValues({});
                          setCompleteError("");
                          setCompleteId(player.id);
                        }}
                      >
                        <ShieldAlert className="h-4 w-4" />
                        {t.completeProfileAction}
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t.permissionRequired}
                      </span>
                    )
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-sm text-emerald-400">
                        <UserCheck className="h-4 w-4" />
                        {t.readyForOperations}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {!players.length && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                {t.noPlayersAssigned}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
