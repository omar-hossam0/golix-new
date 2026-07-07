"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  useCreateBirthYearMutation,
  useDeleteBirthYearMutation,
  useGetBirthYearsQuery,
  useGetBranchesQuery,
  useLazyGetBirthYearByIdQuery,
  useUpdateBirthYearMutation,
  type BirthYearRange,
} from "@/lib/store/api/adminApi";
import { Calendar, Edit2, Loader2, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";

const copy = {
  en: {
    title: "Birth Years",
    description:
      "Create age categories with year ranges. Multiple ranges can share the same label.",
    dashboard: "Dashboard",
    academy: "Academy",
    addRange: "Add Birth Year Range",
    selectBranch: "Select a branch...",
    createOrSelectBranch: "Create or select a branch first.",
    noBirthYearsTitle: "No birth years yet",
    noBirthYearsDescription: "Add the first birth year range for this branch.",
    range: "range",
    ranges: "ranges",
    createdByCoach: "Created by Coach",
    createdByAdmin: "Created by Admin",
    editTitle: "Edit Birth Year Range",
    createTitle: "Add Birth Year Range",
    formDescription:
      "Create a year range for this branch. You can use the same label for multiple ranges.",
    labelOptional: "Label (optional)",
    labelPlaceholder: "e.g., Juniors, U12, etc.",
    labelHint: "If not provided, will be auto-generated from the year range",
    fromYear: "From Year",
    toYear: "To Year",
    saveError: "Could not save this birth year range.",
    cancel: "Cancel",
    save: "Save",
    create: "Create",
    deleteTitle: "Delete Birth Year",
    playersMoveRequired:
      "player must be moved before deleting. The target range will expand automatically if needed.",
    playersMoveRequiredPlural:
      "players must be moved before deleting. The target range will expand automatically if needed.",
    typeToConfirm: "Type",
    toConfirmDeletion: "to confirm deletion.",
    checkingPlayers: "Checking assigned players...",
    transferPlayersTo: "Transfer players to",
    chooseTarget: "Choose target birth year...",
    transferHint:
      "The selected birth year will automatically expand from the youngest moved player year to the oldest moved player year.",
    deleteError: "Could not delete this birth year. It may have active relations.",
    inspectError: "Could not inspect this birth year before deletion.",
    selectTargetError: "Select a target birth year before deleting.",
    deleting: "Deleting...",
    delete: "Delete",
  },
  ar: {
    title: "سنوات الميلاد",
    description:
      "أنشئ فئات عمرية بنطاقات سنوات. يمكن لأكثر من نطاق استخدام نفس الاسم.",
    dashboard: "لوحة التحكم",
    academy: "الأكاديمية",
    addRange: "إضافة نطاق سنة ميلاد",
    selectBranch: "اختر فرعًا...",
    createOrSelectBranch: "أنشئ فرعًا أو اختر فرعًا أولًا.",
    noBirthYearsTitle: "لا توجد سنوات ميلاد بعد",
    noBirthYearsDescription: "أضف أول نطاق سنة ميلاد لهذا الفرع.",
    range: "نطاق",
    ranges: "نطاقات",
    createdByCoach: "أنشأه المدرب",
    createdByAdmin: "أنشأته الإدارة",
    editTitle: "تعديل نطاق سنة الميلاد",
    createTitle: "إضافة نطاق سنة ميلاد",
    formDescription:
      "أنشئ نطاق سنوات لهذا الفرع. يمكنك استخدام نفس الاسم لأكثر من نطاق.",
    labelOptional: "الاسم (اختياري)",
    labelPlaceholder: "مثال: الناشئون، U12، إلخ.",
    labelHint: "إذا لم تكتبه، سيتم إنشاؤه تلقائيًا من نطاق السنوات",
    fromYear: "من سنة",
    toYear: "إلى سنة",
    saveError: "تعذر حفظ نطاق سنة الميلاد.",
    cancel: "إلغاء",
    save: "حفظ",
    create: "إنشاء",
    deleteTitle: "حذف سنة الميلاد",
    playersMoveRequired:
      "لاعب يجب نقله قبل الحذف. سيتم توسيع النطاق الهدف تلقائيًا إذا لزم الأمر.",
    playersMoveRequiredPlural:
      "لاعبين يجب نقلهم قبل الحذف. سيتم توسيع النطاق الهدف تلقائيًا إذا لزم الأمر.",
    typeToConfirm: "اكتب",
    toConfirmDeletion: "لتأكيد الحذف.",
    checkingPlayers: "جاري فحص اللاعبين المرتبطين...",
    transferPlayersTo: "نقل اللاعبين إلى",
    chooseTarget: "اختر سنة الميلاد الهدف...",
    transferHint:
      "سيتم توسيع سنة الميلاد المختارة تلقائيًا من أصغر سنة للاعبين المنقولين إلى أكبر سنة.",
    deleteError: "تعذر حذف سنة الميلاد. قد تكون مرتبطة بعلاقات نشطة.",
    inspectError: "تعذر فحص سنة الميلاد قبل الحذف.",
    selectTargetError: "اختر سنة ميلاد هدف قبل الحذف.",
    deleting: "جاري الحذف...",
    delete: "حذف",
  },
} as const;

export default function BirthYearsPage() {
  const language = useDashboardLanguage();
  const t = copy[language];
  const router = useRouter();
  const { data: branches, isLoading: loadingBranches } = useGetBranchesQuery();
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const selectedBranch = selectedBranchId || branches?.[0]?.id || "";
  const [open, setOpen] = useState(false);
  const [editingRange, setEditingRange] = useState<(BirthYearRange & { groupLabel?: string }) | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<(BirthYearRange & { groupLabel?: string }) | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [deletePlayerCount, setDeletePlayerCount] = useState(0);
  const [transferBirthYearId, setTransferBirthYearId] = useState("");
  const [deleteFlowError, setDeleteFlowError] = useState("");
  const [form, setForm] = useState({ fromYear: "", toYear: "", label: "" });
  const { data: birthYearGroups, isLoading: loadingBirthYears } = useGetBirthYearsQuery(selectedBranch, {
    skip: !selectedBranch,
  });
  const [createBirthYear, { isLoading: isCreating, error }] = useCreateBirthYearMutation();
  const [updateBirthYear, { isLoading: isUpdating, error: updateError }] = useUpdateBirthYearMutation();
  const [deleteBirthYear, { isLoading: isDeleting, error: deleteError }] = useDeleteBirthYearMutation();
  const [loadBirthYearDetail, { isFetching: loadingDeleteDetail }] = useLazyGetBirthYearByIdQuery();

  const openCreate = () => {
    setEditingRange(null);
    setForm({ fromYear: "", toYear: "", label: "" });
    setOpen(true);
  };

  const openEdit = (range: BirthYearRange & { groupLabel?: string }) => {
    setEditingRange(range);
    setForm({ fromYear: String(range.fromYear), toYear: String(range.toYear), label: range.groupLabel ?? "" });
    setOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedBranch || !form.fromYear || !form.toYear) return;

    const payload = {
      fromYear: Number(form.fromYear),
      toYear: Number(form.toYear),
      label: form.label.trim() || undefined,
    };

    if (editingRange) {
      await updateBirthYear({ id: editingRange.id, body: payload }).unwrap();
    } else {
      await createBirthYear({ branchId: selectedBranch, ...payload }).unwrap();
    }

    setForm({ fromYear: "", toYear: "", label: "" });
    setEditingRange(null);
    setOpen(false);
  };

  const deleteName = deleteTarget?.groupLabel ?? deleteTarget?.label ?? "";
  const transferOptions = (birthYearGroups ?? [])
    .flatMap((group) => group.birthYears.map((range) => ({
      id: range.id,
      label: `${group.label} (${range.fromYear}-${range.toYear})`,
    })))
    .filter((range) => range.id !== deleteTarget?.id);

  const openDelete = async (range: BirthYearRange & { groupLabel?: string }) => {
    setDeleteTarget(range);
    setDeleteText("");
    setTransferBirthYearId("");
    setDeletePlayerCount(0);
    setDeleteFlowError("");

    try {
      const detail = await loadBirthYearDetail(range.id).unwrap();
      setDeletePlayerCount(detail.players.length);
    } catch {
      setDeleteFlowError(t.inspectError);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleteText !== deleteConfirmText) return;
    setDeleteFlowError("");
    if (deletePlayerCount > 0 && !transferBirthYearId) {
      setDeleteFlowError(t.selectTargetError);
      return;
    }
    await deleteBirthYear({
      id: deleteTarget.id,
      transferBirthYearId: deletePlayerCount > 0 ? transferBirthYearId : undefined,
    }).unwrap();
    setDeleteTarget(null);
    setDeleteText("");
    setTransferBirthYearId("");
    setDeletePlayerCount(0);
  };

  const creatorMeta = (range: BirthYearRange) => {
    if (range.createdByRole === "coach") {
      return {
        label: `${t.createdByCoach}${range.createdByName ? `: ${range.createdByName}` : ""}`,
        className: "border-cyan-400/50 bg-cyan-400/15 text-cyan-100",
      };
    }
    return {
      label: `${t.createdByAdmin}${range.createdByName ? `: ${range.createdByName}` : ""}`,
      className: "border-lime-400/50 bg-lime-400/15 text-lime-100",
    };
  };
  const formatRangeCount = (count: number) =>
    `${count} ${count === 1 ? t.range : t.ranges}`;
  const deleteConfirmText = deleteName ? `clear ${deleteName}` : "";

  if (loadingBranches) return <LoadingSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in" dir={language === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.academy },
          { label: t.title },
        ]}
        actions={
          <Button className="gap-1.5" disabled={!selectedBranch} onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t.addRange}
          </Button>
        }
      />

      <div className="max-w-xs">
        <Select value={selectedBranch} onValueChange={setSelectedBranchId}>
          <SelectTrigger>
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
      </div>

      {!selectedBranch ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t.createOrSelectBranch}</p>
      ) : loadingBirthYears ? (
        <LoadingSkeleton />
      ) : !birthYearGroups || birthYearGroups.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t.noBirthYearsTitle}</CardTitle>
            <CardDescription>{t.noBirthYearsDescription}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {birthYearGroups.map((group) => (
            <Card key={group.normalizedLabel}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
                    <Calendar className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{group.label}</CardTitle>
                    <CardDescription className="text-xs">
                      {formatRangeCount(group.birthYears.length)}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {group.birthYears.map((range) => (
                    (() => {
                      const creator = creatorMeta(range);
                      return (
                        <div
                          key={range.id}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2"
                          onClick={() => router.push(`/admin/academy/birth-years/${range.id}`)}
                        >
                          <div className="min-w-0 space-y-1.5">
                            <p className="text-sm font-medium">
                              {range.fromYear === range.toYear
                                ? range.fromYear
                                : `${range.fromYear} - ${range.toYear}`}
                            </p>
                            <Badge
                              variant="outline"
                              className={`max-w-full truncate px-2 py-0.5 text-[11px] font-semibold ${creator.className}`}
                            >
                              {creator.label}
                            </Badge>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button type="button" variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); openEdit({ ...range, groupLabel: group.label }); }}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); openDelete({ ...range, groupLabel: group.label }); }}>
                              <Trash2 className="h-4 w-4 text-red-400" />
                            </Button>
                          </div>
                        </div>
                      );
                    })()
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRange ? t.editTitle : t.createTitle}</DialogTitle>
            <DialogDescription>
              {t.formDescription}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="birth-year-label">{t.labelOptional}</Label>
              <Input
                id="birth-year-label"
                value={form.label}
                onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                placeholder={t.labelPlaceholder}
              />
              <p className="text-xs text-muted-foreground">
                {t.labelHint}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from-year">{t.fromYear}</Label>
                <Input
                  id="from-year"
                  type="number"
                  min={2000}
                  max={2030}
                  value={form.fromYear}
                  onChange={(event) => setForm((current) => ({ ...current, fromYear: event.target.value }))}
                  placeholder="2010"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to-year">{t.toYear}</Label>
                <Input
                  id="to-year"
                  type="number"
                  min={2000}
                  max={2030}
                  value={form.toYear}
                  onChange={(event) => setForm((current) => ({ ...current, toYear: event.target.value }))}
                  placeholder="2011"
                  required
                />
              </div>
            </div>
            {(error || updateError) && <p className="text-sm text-red-400">{t.saveError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit" disabled={isCreating || isUpdating || !form.fromYear || !form.toYear} className="gap-2">
                {(isCreating || isUpdating) && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingRange ? t.save : t.create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(next) => !next && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.deleteTitle}</DialogTitle>
            <DialogDescription>
              {deletePlayerCount > 0
                ? `${deletePlayerCount} ${
                    deletePlayerCount === 1 ? t.playersMoveRequired : t.playersMoveRequiredPlural
                  }`
                : `${t.typeToConfirm} ${deleteConfirmText} ${t.toConfirmDeletion}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {loadingDeleteDetail && <p className="text-sm text-muted-foreground">{t.checkingPlayers}</p>}
            {deletePlayerCount > 0 && (
              <div className="space-y-2">
                <Label>{t.transferPlayersTo}</Label>
                <Select value={transferBirthYearId} onValueChange={setTransferBirthYearId}>
                  <SelectTrigger><SelectValue placeholder={t.chooseTarget} /></SelectTrigger>
                  <SelectContent>
                    {transferOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t.transferHint}
                </p>
              </div>
            )}
            <Input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} placeholder={deleteConfirmText} />
            {(deleteError || deleteFlowError) && <p className="text-sm text-red-400">{deleteFlowError || t.deleteError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>{t.cancel}</Button>
            <Button type="button" variant="destructive" disabled={isDeleting || loadingDeleteDetail || deleteText !== deleteConfirmText || (deletePlayerCount > 0 && !transferBirthYearId)} onClick={handleDelete}>
              {isDeleting ? t.deleting : t.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
