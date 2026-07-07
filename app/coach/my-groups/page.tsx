"use client";

import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import {
  useCreateCoachBirthYearMutation,
  useCreateCoachGroupMutation,
  useGetCoachBirthdaysQuery,
  useGetCoachGroupsQuery,
} from "@/lib/store/api/coachApi";
import { useGetCoachPlayersScopedQuery } from "@/lib/store/api/calendarApi";
import { useCoachPermissions } from "@/lib/hooks/useCoachPermissions";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { Clock, ChevronRight, Loader2, Plus, Search, X } from "lucide-react";
import Link from "next/link";

const getApiErrorMessage = (err: unknown, fallback: string) => {
  const apiError = err as {
    data?: {
      error?: {
        message?: string;
        details?: Array<{ message?: string }>;
      };
      errors?: Array<{ message?: string }>;
    };
  };
  return (
    apiError.data?.error?.details?.[0]?.message ??
    apiError.data?.errors?.[0]?.message ??
    apiError.data?.error?.message ??
    fallback
  );
};

const myGroupsCopy = {
  en: {
    pageTitle: "My Groups",
    pageDescription: "Groups assigned to you",
    home: "Home",
    createGroup: "Create Group",
    createDescription: "Create a new group and assign it to yourself.",
    branch: "Branch",
    loadingBranches: "Loading branches...",
    selectBranch: "Select branch",
    birthYear: "Birth Year",
    selectBirthYear: "Select birth year",
    players: "Players",
    playersHint: "Optional. Search and choose specific players for this group.",
    selected: "{count} selected",
    searchPlayers: "Search player name, position, guardian...",
    removePlayer: "Remove {name}",
    selectBranchFirst: "Select a branch and birth year first.",
    loadingPlayers: "Loading players...",
    noPosition: "No position",
    noPlayers: "No players found for this branch and birth year.",
    addBirthYear: "Add Birth Year",
    addBirthYearHint: "Create a new birth year for the selected branch.",
    fromYear: "From year",
    toYear: "To year",
    labelOptional: "Label (optional)",
    adding: "Adding...",
    add: "Add",
    birthYearError: "Could not create the birth year. Please check the values.",
    groupName: "Group Name",
    groupNamePlaceholder: "U14 Elite",
    createError: "Could not create the group. Please try again.",
    cancel: "Cancel",
    creating: "Creating...",
    loadingGroups: "Loading groups...",
    loadError: "Could not load your groups from the backend.",
    attendance: "Attendance",
    avgScore: "Avg Score",
    noGroups: "No groups assigned yet.",
    statuses: { active: "active", inactive: "inactive" },
  },
  ar: {
    pageTitle: "مجموعاتي",
    pageDescription: "المجموعات المعينة لك",
    home: "الرئيسية",
    createGroup: "إنشاء مجموعة",
    createDescription: "أنشئ مجموعة جديدة وعيّنها لنفسك.",
    branch: "الفرع",
    loadingBranches: "جاري تحميل الفروع...",
    selectBranch: "اختر فرعًا",
    birthYear: "سنة الميلاد",
    selectBirthYear: "اختر سنة الميلاد",
    players: "اللاعبون",
    playersHint: "اختياري. ابحث واختر لاعبين محددين لهذه المجموعة.",
    selected: "{count} محدد",
    searchPlayers: "ابحث باسم اللاعب أو المركز أو ولي الأمر...",
    removePlayer: "إزالة {name}",
    selectBranchFirst: "اختر فرعًا وسنة ميلاد أولًا.",
    loadingPlayers: "جاري تحميل اللاعبين...",
    noPosition: "لا يوجد مركز",
    noPlayers: "لا يوجد لاعبون لهذا الفرع وسنة الميلاد.",
    addBirthYear: "إضافة سنة ميلاد",
    addBirthYearHint: "أنشئ سنة ميلاد جديدة للفرع المحدد.",
    fromYear: "من سنة",
    toYear: "إلى سنة",
    labelOptional: "العنوان (اختياري)",
    adding: "جاري الإضافة...",
    add: "إضافة",
    birthYearError: "تعذر إنشاء سنة الميلاد. راجع القيم.",
    groupName: "اسم المجموعة",
    groupNamePlaceholder: "نخبة U14",
    createError: "تعذر إنشاء المجموعة. حاول مرة أخرى.",
    cancel: "إلغاء",
    creating: "جاري الإنشاء...",
    loadingGroups: "جاري تحميل المجموعات...",
    loadError: "تعذر تحميل مجموعاتك من الباك.",
    attendance: "الحضور",
    avgScore: "متوسط النتيجة",
    noGroups: "لا توجد مجموعات معينة حتى الآن.",
    statuses: { active: "نشطة", inactive: "غير نشطة" },
  },
} as const;

export default function CoachMyGroupsPage() {
  const language = useDashboardLanguage();
  const t = myGroupsCopy[language];
  const { can } = useCoachPermissions();
  const canManageGroups = can("can_manage_groups");
  const { data: myGroups = [], isLoading, isError } = useGetCoachGroupsQuery();
  const { data: birthdays = [], isLoading: loadingBirthdays } =
    useGetCoachBirthdaysQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    branchId: "",
    birthYearId: "",
    playerIds: [] as string[],
    name: "",
  });
  const [playerSearch, setPlayerSearch] = useState("");
  const [createCoachGroup, { isLoading: isCreating, error: createError }] =
    useCreateCoachGroupMutation();
  const branches = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    birthdays.forEach((birthday) => {
      byId.set(birthday.branchId, {
        id: birthday.branchId,
        name: birthday.branchName,
      });
    });
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [birthdays]);
  const birthYearOptions = useMemo(
    () =>
      birthdays
        .filter((birthday) => birthday.branchId === form.branchId)
        .map((birthday) => ({
          id: birthday.id,
          label: `${birthday.label} (${birthday.fromYear}-${birthday.toYear})`,
          fromYear: birthday.fromYear,
          toYear: birthday.toYear,
        }))
        .sort((a, b) => a.fromYear - b.fromYear),
    [birthdays, form.branchId],
  );
  const { data: playersRes, isLoading: loadingPlayers } =
    useGetCoachPlayersScopedQuery({ limit: 200 });
  const selectedBirthYear = birthYearOptions.find(
    (year) => year.id === form.birthYearId,
  );
  const availablePlayers = useMemo(() => {
    const term = playerSearch.trim().toLowerCase();
    return (playersRes?.data ?? [])
      .filter((player) => {
        if (
          form.branchId &&
          player.branch_id &&
          player.branch_id !== form.branchId
        )
          return false;
        if (selectedBirthYear && player.date_of_birth) {
          const year = new Date(player.date_of_birth).getFullYear();
          if (
            Number.isFinite(year) &&
            (year < selectedBirthYear.fromYear ||
              year > selectedBirthYear.toYear)
          )
            return false;
        }
        if (!term) return true;
        return `${player.full_name} ${player.position ?? ""} ${player.guardian_name ?? ""} ${player.guardian_phone ?? ""}`
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [form.branchId, playerSearch, playersRes?.data, selectedBirthYear]);
  const selectedPlayers = useMemo(() => {
    const all = playersRes?.data ?? [];
    return form.playerIds
      .map((id) => all.find((player) => player.id === id))
      .filter((player): player is NonNullable<typeof player> =>
        Boolean(player),
      );
  }, [form.playerIds, playersRes?.data]);
  const [birthYearForm, setBirthYearForm] = useState({
    fromYear: "",
    toYear: "",
    label: "",
  });
  const [birthYearFormError, setBirthYearFormError] = useState("");
  const [
    createBirthYear,
    { isLoading: isCreatingBirthYear, error: birthYearError },
  ] = useCreateCoachBirthYearMutation();

  const handleDialogChange = (open: boolean) => {
    setCreateOpen(open);
    if (!open) {
      setForm({
        branchId: "",
        birthYearId: "",
        playerIds: [],
        name: "",
      });
      setPlayerSearch("");
    }
  };

  const handleBranchChange = (value: string) => {
    setForm((prev) => ({
      ...prev,
      branchId: value,
      birthYearId: "",
      playerIds: [],
    }));
    setBirthYearFormError("");
    setPlayerSearch("");
  };

  const handleBirthYearChange = (value: string) => {
    setForm((prev) => ({ ...prev, birthYearId: value }));
    setPlayerSearch("");
  };

  const togglePlayer = (playerId: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      playerIds: checked
        ? [...new Set([...prev.playerIds, playerId])]
        : prev.playerIds.filter((id) => id !== playerId),
    }));
  };

  const handleCreateGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      branchId: form.branchId,
      birthYearId: form.birthYearId,
      playerIds: form.playerIds,
      name: form.name.trim(),
      maxPlayers: Math.max(form.playerIds.length, 100),
    };

    try {
      await createCoachGroup(payload).unwrap();
      handleDialogChange(false);
    } catch {
      // Mutation error handled via createError state
    }
  };

  const canSubmit =
    form.branchId &&
    form.birthYearId &&
    form.name.trim().length > 0 &&
    !isCreating;

  const fromYearValue = Number(birthYearForm.fromYear);
  const toYearValue = Number(birthYearForm.toYear);
  const canCreateBirthYear =
    form.branchId &&
    Number.isFinite(fromYearValue) &&
    Number.isFinite(toYearValue) &&
    fromYearValue >= 2000 &&
    toYearValue <= 2030 &&
    fromYearValue <= toYearValue &&
    !isCreatingBirthYear;

  const handleCreateBirthYear = async () => {
    if (!canCreateBirthYear) return;
    setBirthYearFormError("");
    try {
      const result = await createBirthYear({
        branchId: form.branchId,
        fromYear: fromYearValue,
        toYear: toYearValue,
        label: birthYearForm.label.trim() || undefined,
      }).unwrap();
      setForm((prev) => ({ ...prev, birthYearId: result.id }));
      setBirthYearForm({ fromYear: "", toYear: "", label: "" });
    } catch (err) {
      setBirthYearFormError(
        getApiErrorMessage(
          err,
          t.birthYearError,
        ),
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.pageTitle}
        description={t.pageDescription}
        breadcrumbs={[
          { label: t.home, href: "/coach/home" },
          { label: t.pageTitle },
        ]}
        actions={
          canManageGroups ? (
            <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              {t.createGroup}
            </Button>
          ) : undefined
        }
      />

      <Dialog open={createOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t.createGroup}</DialogTitle>
            <DialogDescription>
              {t.createDescription}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreateGroup}>
            <div className="space-y-2">
              <Label>{t.branch}</Label>
              <Select
                value={form.branchId}
                onValueChange={handleBranchChange}
                disabled={loadingBirthdays}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingBirthdays ? t.loadingBranches : t.selectBranch
                    }
                  />
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
            <div className="space-y-2">
              <Label>{t.birthYear}</Label>
              <Select
                value={form.birthYearId}
                onValueChange={handleBirthYearChange}
                disabled={!form.branchId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.selectBirthYear} />
                </SelectTrigger>
                <SelectContent>
                  {birthYearOptions.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/15 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label>{t.players}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t.playersHint}
                  </p>
                </div>
                <Badge variant="secondary">
                  {t.selected.replace("{count}", String(form.playerIds.length))}
                </Badge>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={playerSearch}
                  onChange={(event) => setPlayerSearch(event.target.value)}
                  placeholder={t.searchPlayers}
                  disabled={!form.branchId || !form.birthYearId}
                />
              </div>
              {!!selectedPlayers.length && (
                <div className="flex flex-wrap gap-2">
                  {selectedPlayers.map((player) => (
                    <Badge
                      key={player.id}
                      variant="outline"
                      className="gap-1.5 py-1"
                    >
                      {player.full_name}
                      <button
                        type="button"
                        className="rounded-full text-muted-foreground hover:text-foreground"
                        onClick={() => togglePlayer(player.id, false)}
                        aria-label={t.removePlayer.replace("{name}", player.full_name)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="grid max-h-48 gap-2 overflow-auto rounded-md border border-border/70 p-3">
                {!form.branchId || !form.birthYearId ? (
                  <p className="text-sm text-muted-foreground">
                    {t.selectBranchFirst}
                  </p>
                ) : loadingPlayers ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.loadingPlayers}
                  </p>
                ) : availablePlayers.length ? (
                  availablePlayers.map((player) => (
                    <label
                      key={player.id}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/30"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.playerIds.includes(player.id)}
                          onChange={(event) =>
                            togglePlayer(player.id, event.target.checked)
                          }
                        />
                        <span>{player.full_name}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {player.position ?? t.noPosition}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t.noPlayers}
                  </p>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="text-sm font-semibold text-foreground">
                {t.addBirthYear}
              </p>
              <p className="text-xs text-muted-foreground">
                {t.addBirthYearHint}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="coach-birth-year-from">{t.fromYear}</Label>
                  <Input
                    id="coach-birth-year-from"
                    type="number"
                    min={2000}
                    max={2030}
                    value={birthYearForm.fromYear}
                    onChange={(event) =>
                      setBirthYearForm((prev) => ({
                        ...prev,
                        fromYear: event.target.value,
                      }))
                    }
                    placeholder="2012"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coach-birth-year-to">{t.toYear}</Label>
                  <Input
                    id="coach-birth-year-to"
                    type="number"
                    min={2000}
                    max={2030}
                    value={birthYearForm.toYear}
                    onChange={(event) =>
                      setBirthYearForm((prev) => ({
                        ...prev,
                        toYear: event.target.value,
                      }))
                    }
                    placeholder="2013"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coach-birth-year-label">
                    {t.labelOptional}
                  </Label>
                  <Input
                    id="coach-birth-year-label"
                    value={birthYearForm.label}
                    onChange={(event) =>
                      setBirthYearForm((prev) => ({
                        ...prev,
                        label: event.target.value,
                      }))
                    }
                    placeholder="U12"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={handleCreateBirthYear}
                  disabled={!canCreateBirthYear}
                >
                  {isCreatingBirthYear && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {isCreatingBirthYear ? t.adding : t.add}
                </Button>
              </div>
              {(birthYearFormError || birthYearError) && (
                <p className="mt-2 text-xs text-red-400">
                  {birthYearFormError ||
                    t.birthYearError}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="coach-group-name">{t.groupName}</Label>
              <Input
                id="coach-group-name"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder={t.groupNamePlaceholder}
                required
              />
            </div>
            {createError && (
              <p className="text-sm text-red-400">
                {t.createError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogChange(false)}
              >
                {t.cancel}
              </Button>
              <Button type="submit" disabled={!canSubmit} className="gap-2">
                {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                {isCreating ? t.creating : t.createGroup}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {isLoading && (
        <Card className="border-border/50 bg-card">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.loadingGroups}
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card className="border-red-500/30 bg-red-500/10">
          <CardContent className="p-4 text-sm text-red-300">
            {t.loadError}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {myGroups.map((group) => {
          return (
            <Link key={group.id} href={`/coach/my-groups/${group.id}`}>
              <Card className="border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <CardContent className="p-6">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{group.name}</h3>
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {group.schedule}
                      </div>
                    </div>
                    <Badge
                      variant={
                        group.status === "active" ? "default" : "secondary"
                      }
                    >
                      {group.status in t.statuses
                        ? t.statuses[group.status as keyof typeof t.statuses]
                        : group.status}
                    </Badge>
                  </div>

                  {/* Stats Row */}
                  <div className="mb-4 grid grid-cols-3 gap-4 rounded-lg bg-muted/20 p-3">
                    <div className="text-center">
                      <p className="text-lg font-bold">{group.playerCount}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {t.players}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-primary">
                        {group.avgAttendance}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {t.attendance}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-accent">
                        {group.avgPerformance}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {t.avgScore}
                      </p>
                    </div>
                  </div>

                  {/* Player Avatars */}
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {group.branchName} -{" "}
                      {group.birthYears
                        .map(
                          (birthYear) =>
                            `${birthYear.label} ${birthYear.fromYear}-${birthYear.toYear}`,
                        )
                        .join(", ")}
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {!isLoading && myGroups.length === 0 && (
        <Card className="border-border/50 bg-card">
          <CardContent className="p-8 text-center text-muted-foreground">
            {t.noGroups}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
