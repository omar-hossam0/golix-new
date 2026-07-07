"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { FinishedMatchDetails } from "@/components/shared/FinishedMatchDetails";
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
  useGetAdminMatchQuery,
  useGetAdminMatchesQuery,
  useHardDeleteAdminMatchMutation,
  type Match,
} from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { formatDate, formatTime12 } from "@/lib/utils";

const archiveCopy = {
  en: {
    title: "Finished Matches",
    description:
      "Review played matches with saved tactics, squad, attendance, incidents, and player stats.",
    dashboard: "Dashboard",
    matches: "Matches",
    archive: "Archive",
    deleteForever: "Delete Forever",
    deleteTitle: "Delete Finished Match Forever",
    deleteDescription:
      "This permanently removes the match, calendar event, squad, tactics, attendance, incidents, goals, substitutions, and player stats. Type",
    toConfirm: "to confirm.",
    confirmation: "Confirmation",
    cancel: "Cancel",
    deleting: "Deleting...",
    confirmDelete: "Delete Forever",
    deleteExpected: (name: string) => `delete match forever ${name}`,
    typeToConfirm: (expected: string) => `Type "${expected}" to confirm permanent deletion.`,
    deleteFailed: "Could not permanently delete this match.",
    deleteSolution:
      "Solution: remove or detach any remaining linked records, then try Delete Forever again.",
    finished: "finished",
    toBeConfirmed: "To be confirmed",
    loading: "Loading finished matches...",
    empty: "No finished matches yet.",
    deleteMatch: (name: string) => `Delete ${name} forever`,
  },
  ar: {
    title: "المباريات المنتهية",
    description: "راجع المباريات الملعوبة بالتكتيك والقائمة والحضور والأحداث والإحصائيات.",
    dashboard: "لوحة التحكم",
    matches: "المباريات",
    archive: "الأرشيف",
    deleteForever: "حذف نهائي",
    deleteTitle: "حذف المباراة المنتهية نهائيًا",
    deleteDescription:
      "سيتم حذف المباراة وحدث التقويم والقائمة والتكتيك والحضور والأحداث والأهداف والتبديلات وإحصائيات اللاعبين نهائيًا. اكتب",
    toConfirm: "للتأكيد.",
    confirmation: "التأكيد",
    cancel: "إلغاء",
    deleting: "جاري الحذف...",
    confirmDelete: "حذف نهائي",
    deleteExpected: (name: string) => `حذف المباراة نهائيا ${name}`,
    typeToConfirm: (expected: string) => `اكتب "${expected}" لتأكيد الحذف النهائي.`,
    deleteFailed: "تعذر حذف هذه المباراة نهائيًا.",
    deleteSolution: "الحل: احذف أو افصل أي سجلات مرتبطة متبقية، ثم جرّب الحذف النهائي مرة أخرى.",
    finished: "منتهية",
    toBeConfirmed: "سيتم التأكيد",
    loading: "جاري تحميل المباريات المنتهية...",
    empty: "لا توجد مباريات منتهية حتى الآن.",
    deleteMatch: (name: string) => `حذف ${name} نهائيًا`,
  },
} as const;

const getApiMessage = (error: unknown, fallback: string) => {
  const apiError = error as {
    data?: {
      message?: string;
      errors?: Array<{ message?: string }>;
      error?: { message?: string; details?: Array<{ message?: string }> };
    };
  };
  return (
    apiError.data?.error?.details?.[0]?.message ??
    apiError.data?.errors?.[0]?.message ??
    apiError.data?.error?.message ??
    apiError.data?.message ??
    fallback
  );
};

export default function AdminMatchArchivePage() {
  const language = useDashboardLanguage();
  const t = archiveCopy[language];
  const { data: matchesRes, isLoading } = useGetAdminMatchesQuery({
    limit: 100,
  });
  const [selectedId, setSelectedId] = useState("");
  const [deleteMatchRow, setDeleteMatchRow] = useState<Match | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [hardDeleteMatch, { isLoading: deletingMatch }] =
    useHardDeleteAdminMatchMutation();

  const matches = useMemo(() => matchesRes?.data ?? [], [matchesRes?.data]);
  const finishedMatches = useMemo(
    () =>
      matches.filter(
        (match) =>
          match.status === "finished" ||
          match.status === "completed" ||
          match.match_status === "finished",
      ),
    [matches],
  );
  const activeId = finishedMatches.some((match) => match.id === selectedId)
    ? selectedId
    : finishedMatches[0]?.id || "";
  const activeMatch = finishedMatches.find((item) => item.id === activeId);
  const { data: match, isLoading: loadingMatch } = useGetAdminMatchQuery(
    activeId,
    { skip: !activeId },
  );
  const deleteExpected = t.deleteExpected(deleteMatchRow?.opponent_name ?? "");

  const openDeleteDialog = (item: Match) => {
    setDeleteError("");
    setDeleteConfirm("");
    setDeleteMatchRow(item);
  };

  const closeDeleteDialog = () => {
    if (deletingMatch) return;
    setDeleteMatchRow(null);
    setDeleteConfirm("");
    setDeleteError("");
  };

  const handleHardDeleteMatch = async () => {
    if (!deleteMatchRow) return;
    if (deleteConfirm.trim() !== deleteExpected) {
      setDeleteError(t.typeToConfirm(deleteExpected));
      return;
    }

    try {
      await hardDeleteMatch(deleteMatchRow.id).unwrap();
      if (selectedId === deleteMatchRow.id || activeId === deleteMatchRow.id) {
        setSelectedId("");
      }
      setDeleteMatchRow(null);
      setDeleteConfirm("");
      setDeleteError("");
    } catch (error) {
      const message = getApiMessage(
        error,
        t.deleteFailed,
      );
      setDeleteError(
        `${message}\n${t.deleteSolution}`,
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.matches, href: "/admin/matches" },
          { label: t.archive },
        ]}
        actions={
          <Button
            type="button"
            variant="destructive"
            className="gap-2"
            disabled={!activeMatch}
            onClick={() => activeMatch && openDeleteDialog(activeMatch)}
          >
            <Trash2 className="h-4 w-4" />
            {t.deleteForever}
          </Button>
        }
      />

      <Dialog
        open={Boolean(deleteMatchRow)}
        onOpenChange={(nextOpen) => !nextOpen && closeDeleteDialog()}
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
            <Label htmlFor="archive-delete-match-confirm">{t.confirmation}</Label>
            <Input
              id="archive-delete-match-confirm"
              value={deleteConfirm}
              onChange={(event) => setDeleteConfirm(event.target.value)}
              placeholder={deleteExpected}
              autoComplete="off"
            />
          </div>
          {deleteError && (
            <p className="whitespace-pre-line rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-300">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDeleteDialog}
              disabled={deletingMatch}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              disabled={
                deletingMatch || deleteConfirm.trim() !== deleteExpected
              }
              onClick={handleHardDeleteMatch}
            >
              {deletingMatch ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {t.confirmDelete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <Card className="border-border/50 bg-card">
          <CardContent className="space-y-2 p-4">
            {finishedMatches.map((item) => (
              <div
                key={item.id}
                className={`flex items-stretch overflow-hidden rounded-md border transition-colors ${
                  activeId === item.id
                    ? "border-primary bg-primary/10"
                    : "border-border/50 bg-muted/10 hover:bg-muted/30"
                }`}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 p-3 text-left"
                  onClick={() => setSelectedId(item.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.opponent_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(item.match_date)} ·{" "}
                        {formatTime12(item.match_time)}
                      </p>
                    </div>
                    <Badge variant="success">{t.finished}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.location || t.toBeConfirmed}
                  </p>
                </button>
                <button
                  type="button"
                  className="grid w-11 shrink-0 place-items-center border-l border-inherit text-red-300 transition-colors hover:bg-red-500/10 hover:text-red-200"
                  onClick={() => openDeleteDialog(item)}
                  title={t.deleteMatch(item.opponent_name)}
                  aria-label={t.deleteMatch(item.opponent_name)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {isLoading && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.loading}
              </p>
            )}
            {!finishedMatches.length && !isLoading && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t.empty}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardContent className="p-4">
            <FinishedMatchDetails
              match={match}
              isLoading={loadingMatch}
              hasMatches={Boolean(finishedMatches.length)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
