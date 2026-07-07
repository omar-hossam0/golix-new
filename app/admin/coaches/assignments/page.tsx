"use client";

import { useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateCoachAssignmentMutation,
  useGetBranchesQuery,
  useGetCoachAssignmentsQuery,
  useGetCoachesQuery,
  useGetGroupsQuery,
  useUploadCoachAssignmentFileMutation,
  type AssignmentFileInput,
  type CoachAssignment,
} from "@/lib/store/api/adminApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { formatDate } from "@/lib/utils";
import { FileImage, FileText, Loader2, Plus, RefreshCw } from "lucide-react";

const statusVariant: Record<CoachAssignment["status"], "secondary" | "info" | "warning" | "success" | "destructive"> = {
  assigned: "secondary",
  in_progress: "info",
  submitted: "warning",
  reviewed: "success",
  cancelled: "destructive",
};

const assignmentsCopy = {
  en: {
    columns: {
      assignment: "Assignment",
      coach: "Coach",
      scope: "Scope",
      files: "Files",
      due: "Due",
      status: "Status",
    },
    statuses: {
      assigned: "Assigned",
      in_progress: "In progress",
      submitted: "Submitted",
      reviewed: "Reviewed",
      cancelled: "Cancelled",
    } satisfies Record<CoachAssignment["status"], string>,
    fileTypes: {
      pdf: "PDF",
      word: "Word",
      image: "image",
    },
    noDescription: "No description",
    coachFallback: "Coach",
    general: "General",
    noDueDate: "No due date",
    pageTitle: "Coach Assignments",
    pageDescription: "Send coach tasks and collect PDF, Word, or image submissions.",
    dashboard: "Dashboard",
    coaches: "Coaches",
    assignments: "Assignments",
    newAssignment: "New Assignment",
    loadError: "Failed to load assignments.",
    retry: "Retry",
    searchAssignments: "Search assignments...",
    allStatuses: "All statuses",
    noAssignments: "No assignments",
    noAssignmentsDescription: "Create the first assignment for a coach.",
    dialogTitle: "New Coach Assignment",
    dialogDescription: "Assignments accept PDF, Word, and image files.",
    coach: "Coach",
    selectCoach: "Select coach...",
    branch: "Branch",
    selectBranch: "Select branch...",
    group: "Group",
    noGroup: "No group",
    dueDate: "Due Date",
    title: "Title",
    titlePlaceholder: "U14 progress report",
    description: "Description",
    briefFile: "Brief File (optional)",
    uploadingFile: "Uploading file...",
    uploadedFile: "Uploaded {fileName} ({fileType})",
    uploadFailed: "Upload failed. Accepted files: PDF, DOC, DOCX, PNG, JPG, JPEG, WEBP.",
    createError: "Could not create assignment. Check the coach, branch, and file type.",
    cancel: "Cancel",
    creating: "Create Assignment",
  },
  ar: {
    columns: {
      assignment: "التكليف",
      coach: "المدرب",
      scope: "النطاق",
      files: "الملفات",
      due: "الموعد",
      status: "الحالة",
    },
    statuses: {
      assigned: "تم التعيين",
      in_progress: "قيد التنفيذ",
      submitted: "تم الإرسال",
      reviewed: "تمت المراجعة",
      cancelled: "ملغي",
    } satisfies Record<CoachAssignment["status"], string>,
    fileTypes: {
      pdf: "PDF",
      word: "Word",
      image: "صورة",
    },
    noDescription: "لا يوجد وصف",
    coachFallback: "مدرب",
    general: "عام",
    noDueDate: "لا يوجد موعد",
    pageTitle: "تكليفات المدربين",
    pageDescription: "أرسل مهام للمدربين واجمع تسليمات PDF أو Word أو صور.",
    dashboard: "لوحة التحكم",
    coaches: "المدربون",
    assignments: "التكليفات",
    newAssignment: "تكليف جديد",
    loadError: "تعذر تحميل التكليفات.",
    retry: "إعادة المحاولة",
    searchAssignments: "ابحث في التكليفات...",
    allStatuses: "كل الحالات",
    noAssignments: "لا توجد تكليفات",
    noAssignmentsDescription: "أنشئ أول تكليف لمدرب.",
    dialogTitle: "تكليف مدرب جديد",
    dialogDescription: "التكليفات تقبل ملفات PDF وWord والصور.",
    coach: "المدرب",
    selectCoach: "اختر مدربًا...",
    branch: "الفرع",
    selectBranch: "اختر فرعًا...",
    group: "المجموعة",
    noGroup: "بدون مجموعة",
    dueDate: "تاريخ التسليم",
    title: "العنوان",
    titlePlaceholder: "تقرير تقدم U14",
    description: "الوصف",
    briefFile: "ملف التعليمات (اختياري)",
    uploadingFile: "جاري رفع الملف...",
    uploadedFile: "تم رفع {fileName} ({fileType})",
    uploadFailed: "فشل الرفع. الملفات المقبولة: PDF وDOC وDOCX وPNG وJPG وJPEG وWEBP.",
    createError: "تعذر إنشاء التكليف. راجع المدرب والفرع ونوع الملف.",
    cancel: "إلغاء",
    creating: "إنشاء التكليف",
  },
} as const;

export default function CoachAssignmentsPage() {
  const language = useDashboardLanguage();
  const t = assignmentsCopy[language];
  const [open, setOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [attachment, setAttachment] = useState<AssignmentFileInput | null>(null);
  const [form, setForm] = useState({
    coachId: "",
    branchId: "",
    groupId: "none",
    title: "",
    description: "",
    dueDate: "",
    adminNotes: "",
    fileType: "pdf" as "pdf" | "word" | "image",
    fileName: "",
    fileUrl: "",
    mimeType: "",
  });

  const { data: coachesRes } = useGetCoachesQuery({ limit: 100 });
  const { data: branches } = useGetBranchesQuery();
  const { data: groups } = useGetGroupsQuery({ branchId: form.branchId }, { skip: !form.branchId });
  const { data, isLoading, isError, refetch } = useGetCoachAssignmentsQuery({
    status: filterStatus === "all" ? undefined : filterStatus,
    limit: 100,
  });
  const [createAssignment, { isLoading: isCreating, error: createError }] = useCreateCoachAssignmentMutation();
  const [uploadAttachment, { isLoading: isUploading, error: uploadError }] =
    useUploadCoachAssignmentFileMutation();

  const coaches = coachesRes?.data ?? [];

  const columns = useMemo<Column<CoachAssignment>[]>(() => [
    {
      key: "title",
      header: t.columns.assignment,
      accessor: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.title}</p>
          <p className="text-xs text-muted-foreground">{row.description || t.noDescription}</p>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.title,
    },
    {
      key: "coach",
      header: t.columns.coach,
      accessor: (row) => row.coachName ?? t.coachFallback,
      sortable: true,
      sortValue: (row) => row.coachName ?? "",
    },
    {
      key: "scope",
      header: t.columns.scope,
      accessor: (row) => (
        <span>{[row.branchName, row.groupName].filter(Boolean).join(" - ") || t.general}</span>
      ),
    },
    {
      key: "files",
      header: t.columns.files,
      accessor: (row) => (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" />
            {row.attachments.length}
          </span>
          <span className="flex items-center gap-1">
            <FileImage className="h-3.5 w-3.5" />
            {row.submissions.length}
          </span>
        </div>
      ),
      sortable: true,
      sortValue: (row) => row.files.length,
    },
    {
      key: "due",
      header: t.columns.due,
      accessor: (row) => row.dueDate ? formatDate(row.dueDate) : t.noDueDate,
      sortable: true,
      sortValue: (row) => row.dueDate ?? "",
    },
    {
      key: "status",
      header: t.columns.status,
      accessor: (row) => (
        <Badge variant={statusVariant[row.status]}>
          {t.statuses[row.status]}
        </Badge>
      ),
      sortable: true,
      sortValue: (row) => row.status,
    },
  ], [t]);

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm({
      coachId: "",
      branchId: "",
      groupId: "none",
      title: "",
      description: "",
      dueDate: "",
      adminNotes: "",
      fileType: "pdf",
      fileName: "",
      fileUrl: "",
      mimeType: "",
    });
    setAttachment(null);
  };

  const handleAttachmentUpload = async (file: File | undefined) => {
    if (!file) return;
    const uploaded = await uploadAttachment(file).unwrap();
    setAttachment(uploaded);
    setForm((current) => ({
      ...current,
      fileType: uploaded.fileType,
      fileName: uploaded.fileName,
      fileUrl: uploaded.fileUrl,
      mimeType: uploaded.mimeType ?? "",
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await createAssignment({
      coachId: form.coachId,
      branchId: form.branchId || undefined,
      groupId: form.groupId === "none" ? undefined : form.groupId,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      dueDate: form.dueDate || undefined,
      adminNotes: form.adminNotes.trim() || undefined,
      attachments: attachment ? [attachment] : undefined,
    }).unwrap();

    resetForm();
    setOpen(false);
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

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t.pageTitle}
        description={t.pageDescription}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.coaches, href: "/admin/coaches" },
          { label: t.assignments },
        ]}
        actions={
          <Button className="gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            {t.newAssignment}
          </Button>
        }
      />

      {isError ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <p className="text-muted-foreground">{t.loadError}</p>
          <Button variant="outline" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            {t.retry}
          </Button>
        </div>
      ) : (
        <DataTable
          data={data?.data ?? []}
          columns={columns}
          searchable
          searchPlaceholder={t.searchAssignments}
          searchKey={(row) => `${row.title} ${row.coachName ?? ""} ${row.branchName ?? ""} ${row.groupName ?? ""}`}
          filters={
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.allStatuses}</SelectItem>
                <SelectItem value="assigned">{t.statuses.assigned}</SelectItem>
                <SelectItem value="submitted">{t.statuses.submitted}</SelectItem>
                <SelectItem value="reviewed">{t.statuses.reviewed}</SelectItem>
                <SelectItem value="cancelled">{t.statuses.cancelled}</SelectItem>
              </SelectContent>
            </Select>
          }
          emptyTitle={t.noAssignments}
          emptyDescription={t.noAssignmentsDescription}
        />
      )}

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) resetForm();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.dialogTitle}</DialogTitle>
            <DialogDescription>{t.dialogDescription}</DialogDescription>
          </DialogHeader>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.coach}</Label>
                <Select value={form.coachId} onValueChange={(value) => updateForm("coachId", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t.selectCoach} />
                  </SelectTrigger>
                  <SelectContent>
                    {coaches.map((coach) => (
                      <SelectItem key={coach.id} value={coach.id}>
                        {coach.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t.branch}</Label>
                <Select
                  value={form.branchId}
                  onValueChange={(value) => setForm((current) => ({ ...current, branchId: value, groupId: "none" }))}
                >
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
              <div className="space-y-2">
                <Label>{t.group}</Label>
                <Select value={form.groupId} onValueChange={(value) => updateForm("groupId", value)} disabled={!form.branchId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t.noGroup}</SelectItem>
                    {(groups ?? []).map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} {group.birth_year ? `- ${group.birth_year}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignment-due">{t.dueDate}</Label>
                <Input
                  id="assignment-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => updateForm("dueDate", event.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="assignment-title">{t.title}</Label>
                <Input
                  id="assignment-title"
                  value={form.title}
                  onChange={(event) => updateForm("title", event.target.value)}
                  placeholder={t.titlePlaceholder}
                  required
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="assignment-description">{t.description}</Label>
                <Textarea
                  id="assignment-description"
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="assignment-file">{t.briefFile}</Label>
                <Input
                  id="assignment-file"
                  type="file"
                  accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp"
                  onChange={(event) => handleAttachmentUpload(event.target.files?.[0])}
                  disabled={isUploading}
                />
                {isUploading && (
                  <p className="text-xs text-muted-foreground">{t.uploadingFile}</p>
                )}
                {attachment && (
                  <p className="text-xs text-emerald-400">
                    {t.uploadedFile
                      .replace("{fileName}", attachment.fileName)
                      .replace("{fileType}", t.fileTypes[attachment.fileType])}
                  </p>
                )}
                {uploadError && (
                  <p className="text-xs text-red-400">
                    {t.uploadFailed}
                  </p>
                )}
              </div>
            </div>
            {createError && <p className="text-sm text-red-400">{t.createError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t.cancel}
              </Button>
              <Button type="submit" disabled={isCreating || !form.coachId || !form.title.trim()} className="gap-2">
                {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.creating}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
