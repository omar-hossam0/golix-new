"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Cake, Loader2, Plus, Trash2, Users } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useCoachPermissions } from "@/lib/hooks/useCoachPermissions";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import {
  type CoachBirthday,
  useCreateCoachBirthYearMutation,
  useDeleteCoachBirthYearMutation,
  useGetCoachBirthdaysQuery,
  useGetCoachManageBranchesQuery,
} from "@/lib/store/api/coachApi";
import { useGetCoachPlayersScopedQuery } from "@/lib/store/api/calendarApi";
import { formatDate, getInitials } from "@/lib/utils";

const getBirthYear = (value: string | null) => {
  if (!value) return null;
  const year = new Date(value).getFullYear();
  return Number.isInteger(year) ? year : null;
};

const birthdayCopy = {
  en: {
    noMainPosition: "No main position",
    genericError: "Something went wrong.",
    createdByCoach: (name?: string | null) => `Created by Coach${name ? `: ${name}` : ""}`,
    createdByAdmin: (name?: string | null) => `Created by Admin${name ? `: ${name}` : ""}`,
    createError: "Could not create the birth year. Please check the values.",
    deleteError: "Could not delete this birth year.",
    title: "Birthdays",
    description: "View your assigned birth years and the players inside each birthday range.",
    home: "Home",
    addBirthYear: "Add Birth Year",
    loadingBirthdays: "Loading birthdays...",
    to: "to",
    players: (count: number) => `${count} players`,
    deleteAria: (label: string) => `Delete ${label}`,
    noBirthDate: "No birth date",
    noPlayersBirthday: "No players in this birthday yet.",
    noBirthdays: "No birthdays assigned yet.",
    addFirst: " Add the first birth year from the button above.",
    dialogTitle: "Add Birth Year",
    dialogDescription: "Create a birth year in one of the branches you can manage.",
    branch: "Branch",
    loadingBranches: "Loading branches...",
    selectBranch: "Select branch",
    noManageBranches: "No manageable branches assigned to this account.",
    fromYear: "From year",
    toYear: "To year",
    labelOptional: "Label (optional)",
    cancel: "Cancel",
    adding: "Adding...",
    deleteTitle: "Delete birth year",
    deleteDescription: (label: string, from: number, toYear: number) =>
      `Delete ${label} (${from}-${toYear})? You can only delete birth years you created.`,
    delete: "Delete",
    profileStatuses: {
      complete: "Complete",
      incomplete: "Incomplete",
      missing: "Missing",
    },
  },
  ar: {
    noMainPosition: "لا يوجد مركز أساسي",
    genericError: "حدث خطأ.",
    createdByCoach: (name?: string | null) => `أنشأه المدرب${name ? `: ${name}` : ""}`,
    createdByAdmin: (name?: string | null) => `أنشأه الأدمن${name ? `: ${name}` : ""}`,
    createError: "تعذر إنشاء سنة الميلاد. راجع القيم.",
    deleteError: "تعذر حذف سنة الميلاد هذه.",
    title: "سنوات الميلاد",
    description: "راجع سنوات الميلاد المعينة لك واللاعبين داخل كل نطاق.",
    home: "الرئيسية",
    addBirthYear: "إضافة سنة ميلاد",
    loadingBirthdays: "جاري تحميل سنوات الميلاد...",
    to: "إلى",
    players: (count: number) => `${count} لاعبين`,
    deleteAria: (label: string) => `حذف ${label}`,
    noBirthDate: "لا يوجد تاريخ ميلاد",
    noPlayersBirthday: "لا يوجد لاعبون في سنة الميلاد هذه بعد.",
    noBirthdays: "لا توجد سنوات ميلاد معينة بعد.",
    addFirst: " أضف أول سنة ميلاد من الزر بالأعلى.",
    dialogTitle: "إضافة سنة ميلاد",
    dialogDescription: "أنشئ سنة ميلاد في أحد الفروع التي يمكنك إدارتها.",
    branch: "الفرع",
    loadingBranches: "جاري تحميل الفروع...",
    selectBranch: "اختر فرعا",
    noManageBranches: "لا توجد فروع قابلة للإدارة لهذا الحساب.",
    fromYear: "من سنة",
    toYear: "إلى سنة",
    labelOptional: "التسمية (اختياري)",
    cancel: "إلغاء",
    adding: "جاري الإضافة...",
    deleteTitle: "حذف سنة الميلاد",
    deleteDescription: (label: string, from: number, toYear: number) =>
      `حذف ${label} (${from}-${toYear})؟ يمكنك حذف سنوات الميلاد التي أنشأتها فقط.`,
    delete: "حذف",
    profileStatuses: {
      complete: "مكتمل",
      incomplete: "غير مكتمل",
      missing: "ناقص",
    },
  },
} as const;

type BirthdayCopy = (typeof birthdayCopy)[keyof typeof birthdayCopy];

function playerMainPosition(player: {
  position?: string | null;
  customProfile?: Array<{ key?: string; label?: string; value?: unknown }>;
}, fallback: string) {
  const field = player.customProfile?.find((item) => {
    const key = String(item.key || "").toLowerCase();
    const label = String(item.label || "").toLowerCase();
    return key === "main_position" || label === "main position";
  });
  if (typeof field?.value === "string" && field.value.trim()) {
    return field.value.trim();
  }
  return player.position || fallback;
}

const getApiErrorMessage = (error: unknown, fallback = "Something went wrong.") => {
  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof (error as { data?: { message?: unknown } }).data?.message === "string"
  ) {
    return (error as { data: { message: string } }).data.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof (error as { data?: { error?: { message?: unknown } } }).data?.error?.message === "string"
  ) {
    return (error as { data: { error: { message: string } } }).data.error.message;
  }
  return fallback;
};

const creatorMeta = (birthday: CoachBirthday, copy: BirthdayCopy) => {
  if (birthday.createdByRole === "coach") {
    return {
      label: copy.createdByCoach(birthday.createdByName),
      className: "border-cyan-400/50 bg-cyan-400/15 text-cyan-100",
    };
  }
  return {
    label: copy.createdByAdmin(birthday.createdByName),
    className: "border-lime-400/50 bg-lime-400/15 text-lime-100",
  };
};

const formatProfileStatus = (
  status: string | null | undefined,
  copy: BirthdayCopy,
) => {
  if (!status) return copy.profileStatuses.missing;
  const key = status.toLowerCase() as keyof typeof copy.profileStatuses;
  return copy.profileStatuses[key] ?? status.replace(/_/g, " ");
};

export default function CoachBirthdaysPage() {
  const language = useDashboardLanguage();
  const t = birthdayCopy[language];
  const { can, isLoading: loadingPermissions } = useCoachPermissions();
  const canManageGroups = can("can_manage_groups");
  const { data: birthdays = [], isLoading: loadingBirthdays } = useGetCoachBirthdaysQuery();
  const { data: manageBranches = [], isLoading: loadingBranches } = useGetCoachManageBranchesQuery();
  const { data: playersRes, isLoading: loadingPlayers } = useGetCoachPlayersScopedQuery({ limit: 200 });
  const [createCoachBirthYear, { isLoading: isCreating }] = useCreateCoachBirthYearMutation();
  const [deleteCoachBirthYear, { isLoading: isDeleting }] = useDeleteCoachBirthYearMutation();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [form, setForm] = useState({
    branchId: "",
    fromYear: "",
    toYear: "",
    label: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<CoachBirthday | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const players = useMemo(() => playersRes?.data ?? [], [playersRes?.data]);

  const branchOptions = useMemo(() => {
    const branchesById = new Map<string, { id: string; name: string }>();
    manageBranches.forEach((branch) => branchesById.set(branch.id, branch));
    birthdays.forEach((birthday) => {
      branchesById.set(birthday.branchId, {
        id: birthday.branchId,
        name: birthday.branchName,
      });
    });
    return [...branchesById.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [birthdays, manageBranches]);

  const birthdaysWithPlayers = useMemo(() => {
    return birthdays.map((birthday) => {
      const scopedPlayers = players.filter((player) => {
        const year = getBirthYear(player.date_of_birth);
        return (
          player.branch_id === birthday.branchId &&
          year !== null &&
          year >= birthday.fromYear &&
          year <= birthday.toYear
        );
      });
      return { ...birthday, players: scopedPlayers };
    });
  }, [birthdays, players]);

  const isLoading = loadingBirthdays || loadingPlayers;

  const resetCreateForm = () => {
    setForm({ branchId: "", fromYear: "", toYear: "", label: "" });
    setCreateError("");
  };

  const handleCreateOpenChange = (open: boolean) => {
    setCreateOpen(open);
    if (!open) resetCreateForm();
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateError("");
    const fromYear = Number(form.fromYear);
    const toYear = Number(form.toYear);
    if (!form.branchId || !Number.isFinite(fromYear) || !Number.isFinite(toYear)) return;

    try {
      await createCoachBirthYear({
        branchId: form.branchId,
        fromYear,
        toYear,
        label: form.label.trim() || undefined,
      }).unwrap();
      handleCreateOpenChange(false);
    } catch (error) {
      setCreateError(
        getApiErrorMessage(
          error,
          t.createError,
        ),
      );
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError("");
    try {
      await deleteCoachBirthYear(deleteTarget.id).unwrap();
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(getApiErrorMessage(error, t.deleteError));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[{ label: t.home, href: "/coach/home" }, { label: t.title }]}
        actions={
          canManageGroups ? (
            <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {t.addBirthYear}
            </Button>
          ) : undefined
        }
      />

      {deleteError && (
        <Card className="border-red-500/40 bg-red-500/10">
          <CardContent className="p-4 text-sm text-red-200">{deleteError}</CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card className="border-border/50 bg-card">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loadingBirthdays}
          </CardContent>
        </Card>
      ) : birthdaysWithPlayers.length ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {birthdaysWithPlayers.map((birthday) => (
            (() => {
              const creator = creatorMeta(birthday, t);
              return (
                <Card key={birthday.id} className="border-border/50 bg-card">
                  <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Cake className="h-4 w-4 text-primary" />
                        {birthday.label}
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {birthday.branchName} - {birthday.fromYear} {t.to} {birthday.toYear}
                      </p>
                      <Badge
                        variant="outline"
                        className={`mt-2 max-w-full truncate px-2 py-0.5 text-[11px] font-semibold ${creator.className}`}
                      >
                        {creator.label}
                      </Badge>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="secondary" className="gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {t.players(birthday.players.length)}
                      </Badge>
                      {birthday.canDelete && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setDeleteError("");
                            setDeleteTarget(birthday);
                          }}
                          aria-label={t.deleteAria(birthday.label)}
                        >
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {birthday.players.map((player) => (
                      <div key={player.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-muted/20 p-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/20 text-xs text-primary">
                              {getInitials(player.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{player.full_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {player.date_of_birth ? formatDate(player.date_of_birth) : t.noBirthDate} - {playerMainPosition(player, t.noMainPosition)}
                            </p>
                          </div>
                        </div>
                        <Badge variant={player.profile_status === "complete" ? "success" : "warning"}>
                          {formatProfileStatus(player.profile_status, t)}
                        </Badge>
                      </div>
                    ))}
                    {!birthday.players.length && (
                      <p className="rounded-lg border border-border/40 p-5 text-center text-sm text-muted-foreground">
                        {t.noPlayersBirthday}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })()
          ))}
        </div>
      ) : (
        <Card className="border-border/50 bg-card">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {t.noBirthdays}
            {canManageGroups ? t.addFirst : ""}
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t.dialogTitle}</DialogTitle>
            <DialogDescription>
              {t.dialogDescription}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label>{t.branch}</Label>
              <Select
                value={form.branchId}
                onValueChange={(branchId) => setForm((current) => ({ ...current, branchId }))}
                disabled={loadingBranches || loadingPermissions}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingBranches ? t.loadingBranches : t.selectBranch} />
                </SelectTrigger>
                <SelectContent>
                  {branchOptions.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!loadingBranches && !branchOptions.length && (
                <p className="text-xs text-muted-foreground">
                  {t.noManageBranches}
                </p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="birth-year-from">{t.fromYear}</Label>
                <Input
                  id="birth-year-from"
                  type="number"
                  min={2000}
                  max={2030}
                  value={form.fromYear}
                  onChange={(event) => setForm((current) => ({ ...current, fromYear: event.target.value }))}
                  placeholder="2013"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birth-year-to">{t.toYear}</Label>
                <Input
                  id="birth-year-to"
                  type="number"
                  min={2000}
                  max={2030}
                  value={form.toYear}
                  onChange={(event) => setForm((current) => ({ ...current, toYear: event.target.value }))}
                  placeholder="2013"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="birth-year-label">{t.labelOptional}</Label>
              <Input
                id="birth-year-label"
                value={form.label}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="U12"
              />
            </div>
            {createError && <p className="text-sm text-red-400">{createError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleCreateOpenChange(false)}>
                {t.cancel}
              </Button>
              <Button
                type="submit"
                className="gap-2"
                disabled={
                  isCreating ||
                  !form.branchId ||
                  !form.fromYear ||
                  !form.toYear ||
                  !branchOptions.length
                }
              >
                {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                {isCreating ? t.adding : t.addBirthYear}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t.deleteTitle}
        description={
          deleteTarget
            ? t.deleteDescription(deleteTarget.label, deleteTarget.fromYear, deleteTarget.toYear)
            : ""
        }
        confirmLabel={t.delete}
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={() => {
          void handleDelete();
        }}
      />
    </div>
  );
}
