"use client";

import { useCallback, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateGroupMutation,
  useDeleteGroupMutation,
  useGetBirthYearsQuery,
  useGetBranchesQuery,
  useGetGroupsQuery,
  useGetPlayersQuery,
  useUpdateGroupMutation,
  type Group,
  type PlayerRow,
  type BirthYearGroup,
  type GroupAssignmentMode,
} from "@/lib/store/api/adminApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { Edit2, Layers, Loader2, Plus, RefreshCw, Trash2, Users } from "lucide-react";

type PlayerPick = Pick<PlayerRow, "id" | "full_name" | "date_of_birth" | "player_code"> & { code: string };

const groupsCopy = {
  en: {
    group: "Group",
    noBirthYears: "No birth years",
    players: "Players",
    coaches: "Coaches",
    status: "Status",
    active: "Active",
    inactive: "Inactive",
    actions: "Actions",
    pageTitle: "Groups",
    pageDescription: "Create groups under a branch and its birth years.",
    dashboard: "Dashboard",
    academy: "Academy",
    selectBranch: "Select branch...",
    createGroup: "Create Group",
    selectBranchPrompt: "Select a branch to view its groups.",
    loadError: "Failed to load groups.",
    retry: "Retry",
    searchGroups: "Search groups...",
    emptyTitle: "No groups yet",
    emptyDescription: "Create a group for one of this branch's birth years.",
    editGroup: "Edit Group",
    dialogDescription: "Build the group from birth years or selected players.",
    groupBasis: "Group basis",
    birthDateRanges: "Birth date ranges",
    playersById: "Players by ID or search",
    birthYears: "Birth Years",
    searchBirthYears: "Search birth years...",
    playerIdRange: "Player ID range",
    fromPlayerId: "From player ID, e.g. PLY-U14-2026-0001",
    toPlayerId: "To player ID, e.g. PLY-U14-2026-0025",
    useRange: "Use range",
    rangeHelpStart:
      "The full range is resolved securely on save inside the selected branch.",
    rangeHelpEnd:
      "matching players are visible in the current search result.",
    searchPlayers: "Search by player name or ID...",
    selectedManually: "selected manually",
    clearSelected: "Clear selected",
    remove: "Remove",
    searchingPlayers: "Searching players...",
    noPlayers: "No players found in this branch.",
    groupName: "Group Name",
    groupNamePlaceholder: "U14 Elite",
    description: "Description",
    descriptionPlaceholder: "Optional group notes",
    maxPlayers: "Max Players",
    missingBirthYear: "Create a birth year for this branch before creating groups.",
    saveError: "Could not save this group.",
    cancel: "Cancel",
    save: "Save",
    create: "Create",
    deleteGroup: "Delete Group",
    deletePrefix: "clear",
    deleteDescription: "Type {expected} to confirm deletion.",
    deleteError: "Could not delete this group. It may have active relations.",
    deleting: "Deleting...",
    delete: "Delete",
  },
  ar: {
    group: "المجموعة",
    noBirthYears: "لا توجد سنوات ميلاد",
    players: "اللاعبون",
    coaches: "المدربون",
    status: "الحالة",
    active: "نشطة",
    inactive: "غير نشطة",
    actions: "الإجراءات",
    pageTitle: "المجموعات",
    pageDescription: "إنشاء مجموعات داخل الفرع وسنوات الميلاد التابعة له.",
    dashboard: "لوحة التحكم",
    academy: "الأكاديمية",
    selectBranch: "اختر الفرع...",
    createGroup: "إنشاء مجموعة",
    selectBranchPrompt: "اختر فرعًا لعرض مجموعاته.",
    loadError: "فشل تحميل المجموعات.",
    retry: "إعادة المحاولة",
    searchGroups: "ابحث في المجموعات...",
    emptyTitle: "لا توجد مجموعات بعد",
    emptyDescription: "أنشئ مجموعة لإحدى سنوات الميلاد في هذا الفرع.",
    editGroup: "تعديل المجموعة",
    dialogDescription: "كوّن المجموعة من سنوات الميلاد أو من لاعبين محددين.",
    groupBasis: "أساس المجموعة",
    birthDateRanges: "نطاقات تاريخ الميلاد",
    playersById: "لاعبون بالرقم أو البحث",
    birthYears: "سنوات الميلاد",
    searchBirthYears: "ابحث في سنوات الميلاد...",
    playerIdRange: "نطاق أرقام اللاعبين",
    fromPlayerId: "من رقم اللاعب، مثال PLY-U14-2026-0001",
    toPlayerId: "إلى رقم اللاعب، مثال PLY-U14-2026-0025",
    useRange: "استخدام النطاق",
    rangeHelpStart: "يتم حل النطاق الكامل بأمان عند الحفظ داخل الفرع المحدد.",
    rangeHelpEnd: "لاعبين مطابقين ظاهرين في نتيجة البحث الحالية.",
    searchPlayers: "ابحث باسم اللاعب أو رقمه...",
    selectedManually: "تم اختيارهم يدويًا",
    clearSelected: "مسح المختارين",
    remove: "إزالة",
    searchingPlayers: "جاري البحث عن اللاعبين...",
    noPlayers: "لا يوجد لاعبون في هذا الفرع.",
    groupName: "اسم المجموعة",
    groupNamePlaceholder: "فريق U14 المميز",
    description: "الوصف",
    descriptionPlaceholder: "ملاحظات اختيارية للمجموعة",
    maxPlayers: "الحد الأقصى للاعبين",
    missingBirthYear: "أنشئ سنة ميلاد لهذا الفرع قبل إنشاء المجموعات.",
    saveError: "تعذر حفظ هذه المجموعة.",
    cancel: "إلغاء",
    save: "حفظ",
    create: "إنشاء",
    deleteGroup: "حذف المجموعة",
    deletePrefix: "مسح",
    deleteDescription: "اكتب {expected} لتأكيد الحذف.",
    deleteError: "تعذر حذف هذه المجموعة. قد تكون مرتبطة بعلاقات نشطة.",
    deleting: "جاري الحذف...",
    delete: "حذف",
  },
} as const;

export default function GroupsPage() {
  const language = useDashboardLanguage();
  const t = groupsCopy[language];
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [birthYearSearch, setBirthYearSearch] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");
  const [fromPlayerCode, setFromPlayerCode] = useState("");
  const [toPlayerCode, setToPlayerCode] = useState("");
  const [selectedPlayerMap, setSelectedPlayerMap] = useState<Record<string, PlayerPick>>({});
  const [form, setForm] = useState({
    assignmentMode: "birth_year" as GroupAssignmentMode,
    birthYearIds: [] as string[],
    playerIds: [] as string[],
    name: "",
    description: "",
    maxPlayers: "25",
  });

  const { data: branches, isLoading: loadingBranches } = useGetBranchesQuery();
  const selectedBranch = selectedBranchId || branches?.[0]?.id || "";
  const { data: birthYears } = useGetBirthYearsQuery(selectedBranch, { skip: !selectedBranch });
  const {
    data: groups,
    isLoading: loadingGroups,
    isError,
    refetch,
  } = useGetGroupsQuery({ branchId: selectedBranch }, { skip: !selectedBranch });
  const { data: players, isFetching: loadingPlayers } = useGetPlayersQuery({
    branchId: selectedBranch,
    limit: 100,
    search: playerSearch.trim() || undefined,
  }, { skip: !selectedBranch });
  const [createGroup, { isLoading: isCreating, error: createError }] = useCreateGroupMutation();
  const [updateGroup, { isLoading: isUpdating, error: updateError }] = useUpdateGroupMutation();
  const [deleteGroup, { isLoading: isDeleting, error: deleteError }] = useDeleteGroupMutation();

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    setForm((current) => ({ ...current, birthYearIds: [], playerIds: [] }));
  };

  const birthYearOptions = useMemo(() => {
    return ((birthYears ?? []) as BirthYearGroup[]).flatMap((group) =>
      group.birthYears.map((range) => ({
        id: range.id,
        label: `${group.label} (${range.fromYear}-${range.toYear})`,
      })),
    );
  }, [birthYears]);

  const filteredBirthYearOptions = useMemo(() => {
    const term = birthYearSearch.trim().toLowerCase();
    if (!term) return birthYearOptions;
    return birthYearOptions.filter((birthYear) => birthYear.label.toLowerCase().includes(term));
  }, [birthYearOptions, birthYearSearch]);

  const playerOptions = useMemo(() => {
    return (players?.data ?? [])
      .map((player) => ({ ...player, code: player.player_code ?? player.id }))
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const term = playerSearch.trim().toLowerCase();
    if (!term) return playerOptions;
    return playerOptions.filter((player) => `${player.full_name} ${player.code} ${player.date_of_birth ?? ""}`.toLowerCase().includes(term));
  }, [playerOptions, playerSearch]);

  const rangePlayers = useMemo(() => {
    if (!fromPlayerCode.trim() || !toPlayerCode.trim()) return [];
    const from = fromPlayerCode.trim();
    const to = toPlayerCode.trim();
    const [start, end] = from.localeCompare(to, undefined, { numeric: true }) <= 0 ? [from, to] : [to, from];
    return playerOptions.filter((player) =>
      player.code.localeCompare(start, undefined, { numeric: true }) >= 0 &&
      player.code.localeCompare(end, undefined, { numeric: true }) <= 0,
    );
  }, [fromPlayerCode, toPlayerCode, playerOptions]);

  const selectedPlayers = useMemo(() => {
    return form.playerIds
      .map((id) => selectedPlayerMap[id] ?? playerOptions.find((player) => player.id === id))
      .filter((player): player is PlayerPick => Boolean(player));
  }, [form.playerIds, playerOptions, selectedPlayerMap]);

  const resetForm = () => {
    setForm({ assignmentMode: "birth_year", birthYearIds: [], playerIds: [], name: "", description: "", maxPlayers: "25" });
    setBirthYearSearch("");
    setPlayerSearch("");
    setFromPlayerCode("");
    setToPlayerCode("");
    setSelectedPlayerMap({});
    setEditingGroup(null);
  };

  const openEdit = useCallback((group: Group) => {
    const groupPlayers = Object.fromEntries((group.players ?? []).map((player) => [player.id, {
      id: player.id,
      full_name: player.fullName,
      date_of_birth: player.birthDate ?? null,
      player_code: player.playerCode ?? null,
      code: player.playerCode ?? player.id,
    }]));
    setEditingGroup(group);
    setForm({
      assignmentMode: group.assignment_mode ?? (group.birth_years?.length ? "birth_year" : "players"),
      birthYearIds: group.birth_years?.map((birthYear) => birthYear.id) ?? [],
      playerIds: group.players?.map((player) => player.id) ?? [],
      name: group.name,
      description: group.description ?? "",
      maxPlayers: String(group.max_players ?? 25),
    });
    setSelectedPlayerMap(groupPlayers);
    setOpen(true);
  }, []);

  const columns = useMemo<Column<Group>[]>(() => [
    {
      key: "name",
      header: t.group,
      accessor: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">
            {row.birth_years?.length
              ? row.birth_years.map((birthYear) => `${birthYear.label} ${birthYear.fromYear}-${birthYear.toYear}`).join(", ")
              : t.noBirthYears}
          </p>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.name,
    },
    {
      key: "players",
      header: t.players,
      accessor: (row) => (
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{row.player_count ?? 0}/{row.max_players ?? 0}</span>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.player_count ?? 0,
    },
    {
      key: "coaches",
      header: t.coaches,
      accessor: (row) => row.coach_count ?? 0,
      sortable: true,
      sortValue: (row) => row.coach_count ?? 0,
    },
    {
      key: "status",
      header: t.status,
      accessor: (row) => (
        <Badge variant={row.is_active ? "success" : "secondary"}>
          {row.is_active ? t.active : t.inactive}
        </Badge>
      ),
      sortable: true,
      sortValue: (row) => (row.is_active ? "active" : "inactive"),
    },
    {
      key: "actions",
      header: t.actions,
      accessor: (row) => (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); openEdit(row); }}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); setDeleteTarget(row); setDeleteText(""); }}>
            <Trash2 className="h-4 w-4 text-red-400" />
          </Button>
        </div>
      ),
    },
  ], [openEdit, t]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedBranch || !form.name.trim()) return;
    if (form.assignmentMode === "birth_year" && !form.birthYearIds.length) return;
    if (form.assignmentMode === "players" && !form.playerIds.length) return;

    const payload = {
      assignmentMode: form.assignmentMode,
      birthYearIds: form.assignmentMode === "birth_year" ? form.birthYearIds : undefined,
      playerIds: form.assignmentMode === "players" && form.playerIds.length ? form.playerIds : undefined,
      playerCodeFrom: form.assignmentMode === "players" && fromPlayerCode.trim() ? fromPlayerCode.trim() : undefined,
      playerCodeTo: form.assignmentMode === "players" && toPlayerCode.trim() ? toPlayerCode.trim() : undefined,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      maxPlayers: Number(form.maxPlayers) || 25,
    };

    const createPayload = {
      branchId: selectedBranch,
      ...payload,
    };

    if (editingGroup) {
      await updateGroup({ id: editingGroup.id, body: payload }).unwrap();
    } else {
      await createGroup(createPayload).unwrap();
    }

    resetForm();
    setOpen(false);
  };

  const applyPlayerRange = () => {
    if (!fromPlayerCode.trim() || !toPlayerCode.trim()) return;
    setForm((current) => ({
      ...current,
      playerIds: [...new Set([...current.playerIds, ...rangePlayers.map((player) => player.id)])],
    }));
    setSelectedPlayerMap((current) => ({
      ...current,
      ...Object.fromEntries(rangePlayers.map((player) => [player.id, player])),
    }));
  };

  const togglePlayer = (player: PlayerPick, checked: boolean) => {
    setForm((current) => ({
      ...current,
      playerIds: checked
        ? [...new Set([...current.playerIds, player.id])]
        : current.playerIds.filter((id) => id !== player.id),
    }));
    setSelectedPlayerMap((current) => {
      if (checked) return { ...current, [player.id]: player };
      const next = { ...current };
      delete next[player.id];
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleteText !== `${t.deletePrefix} ${deleteTarget.name}`) return;
    await deleteGroup(deleteTarget.id).unwrap();
    setDeleteTarget(null);
    setDeleteText("");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t.pageTitle}
        description={t.pageDescription}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.academy },
          { label: t.pageTitle },
        ]}
        actions={
          <div className="flex gap-2">
            {!loadingBranches && (
              <Select value={selectedBranch} onValueChange={handleBranchChange}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder={t.selectBranch} />
                </SelectTrigger>
                <SelectContent>
                  {(branches ?? []).map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button className="gap-1.5" disabled={!selectedBranch} onClick={() => { resetForm(); setOpen(true); }}>
              <Plus className="h-4 w-4" />
              {t.createGroup}
            </Button>
          </div>
        }
      />

      {!selectedBranch ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <Layers className="h-10 w-10 opacity-30" />
          <p>{t.selectBranchPrompt}</p>
        </div>
      ) : loadingGroups ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <p className="text-muted-foreground">{t.loadError}</p>
          <Button variant="outline" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            {t.retry}
          </Button>
        </div>
      ) : (
        <DataTable
          data={groups ?? []}
          columns={columns}
          searchable
          searchPlaceholder={t.searchGroups}
          searchKey={(row) => `${row.name} ${row.birth_years?.map((birthYear) => birthYear.label).join(" ") ?? ""}`}
          emptyTitle={t.emptyTitle}
          emptyDescription={t.emptyDescription}
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? t.editGroup : t.createGroup}</DialogTitle>
            <DialogDescription>{t.dialogDescription}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label>{t.groupBasis}</Label>
              <Select value={form.assignmentMode} onValueChange={(value) => {
                setForm((current) => ({ ...current, assignmentMode: value as GroupAssignmentMode, birthYearIds: [], playerIds: [] }));
                setSelectedPlayerMap({});
                setFromPlayerCode("");
                setToPlayerCode("");
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="birth_year">{t.birthDateRanges}</SelectItem>
                  <SelectItem value="players">{t.playersById}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.assignmentMode === "birth_year" ? (
              <div className="space-y-2">
                <Label>{t.birthYears}</Label>
                <Input value={birthYearSearch} onChange={(event) => setBirthYearSearch(event.target.value)} placeholder={t.searchBirthYears} />
                <div className="grid max-h-56 gap-2 overflow-auto rounded-md border border-border p-3">
                {filteredBirthYearOptions.map((birthYear) => (
                  <label key={birthYear.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.birthYearIds.includes(birthYear.id)}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        birthYearIds: event.target.checked
                          ? [...current.birthYearIds, birthYear.id]
                          : current.birthYearIds.filter((id) => id !== birthYear.id),
                      }))}
                    />
                    {birthYear.label}
                  </label>
                ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{t.playerIdRange}</Label>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <Input value={fromPlayerCode} onChange={(event) => setFromPlayerCode(event.target.value)} placeholder={t.fromPlayerId} />
                  <Input value={toPlayerCode} onChange={(event) => setToPlayerCode(event.target.value)} placeholder={t.toPlayerId} />
                  <Button type="button" variant="outline" onClick={applyPlayerRange} disabled={!fromPlayerCode.trim() || !toPlayerCode.trim()}>
                    {t.useRange}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.rangeHelpStart} {rangePlayers.length} {t.rangeHelpEnd}
                </p>

                <Label>{t.players}</Label>
                <Input value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} placeholder={t.searchPlayers} />
                {!!selectedPlayers.length && (
                  <div className="space-y-2 rounded-md border border-border p-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{selectedPlayers.length} {t.selectedManually}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setForm((current) => ({ ...current, playerIds: [] })); setSelectedPlayerMap({}); }}>
                        {t.clearSelected}
                      </Button>
                    </div>
                    {selectedPlayers.map((player) => (
                      <div key={player.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm">
                        <span>{player.full_name} <span className="text-muted-foreground">#{player.code}</span></span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePlayer(player, false)}
                        >
                          {t.remove}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid max-h-56 gap-2 overflow-auto rounded-md border border-border p-3">
                  {loadingPlayers && <p className="text-sm text-muted-foreground">{t.searchingPlayers}</p>}
                  {filteredPlayers.map((player) => (
                    <label key={player.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.playerIds.includes(player.id)}
                        onChange={(event) => togglePlayer(player, event.target.checked)}
                      />
                      {player.full_name} <span className="text-muted-foreground">#{player.code}</span>
                    </label>
                  ))}
                  {!loadingPlayers && !filteredPlayers.length && <p className="text-sm text-muted-foreground">{t.noPlayers}</p>}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="group-name">{t.groupName}</Label>
              <Input
                id="group-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder={t.groupNamePlaceholder}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-description">{t.description}</Label>
              <Input
                id="group-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder={t.descriptionPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-max">{t.maxPlayers}</Label>
              <Input
                id="group-max"
                type="number"
                min={1}
                max={100}
                value={form.maxPlayers}
                onChange={(event) => setForm((current) => ({ ...current, maxPlayers: event.target.value }))}
              />
            </div>
            {form.assignmentMode === "birth_year" && !birthYearOptions.length && (
              <p className="text-sm text-amber-400">{t.missingBirthYear}</p>
            )}
            {(createError || updateError) && <p className="text-sm text-red-400">{t.saveError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t.cancel}
              </Button>
              <Button
                type="submit"
                disabled={isCreating || isUpdating || !form.name.trim() || (form.assignmentMode === "birth_year" ? !form.birthYearIds.length : (!form.playerIds.length && (!fromPlayerCode.trim() || !toPlayerCode.trim())))}
                className="gap-2"
              >
                {(isCreating || isUpdating) && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingGroup ? t.save : t.create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(next) => !next && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.deleteGroup}</DialogTitle>
            <DialogDescription>
              {t.deleteDescription.replace(
                "{expected}",
                `${t.deletePrefix} ${deleteTarget?.name ?? ""}`,
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} placeholder={`${t.deletePrefix} ${deleteTarget?.name ?? ""}`} />
            {deleteError && <p className="text-sm text-red-400">{t.deleteError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>{t.cancel}</Button>
            <Button type="button" variant="destructive" disabled={isDeleting || deleteText !== `${t.deletePrefix} ${deleteTarget?.name ?? ""}`} onClick={handleDelete}>
              {isDeleting ? t.deleting : t.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
