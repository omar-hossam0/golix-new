"use client";

import { useRouter } from "next/navigation";
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
import { Edit2, Plus, MapPin, RefreshCw, Loader2, Trash2 } from "lucide-react";
import {
  useCreateBranchMutation,
  useDeleteBranchMutation,
  useGetBranchesQuery,
  useUpdateBranchMutation,
  type Branch,
} from "@/lib/store/api/adminApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";

type ApiErrorDetail = {
  reason?: string;
  blockers?: Array<{ key?: string; label?: string; count?: number }>;
  solution?: string;
};

type ApiMutationError = {
  data?: {
    error?: {
      message?: string;
      details?: ApiErrorDetail[];
    };
  };
};

function getApiError(
  error: unknown,
  fallbackMessage: string,
  fallbackSolution: string,
) {
  const apiError = error as ApiMutationError | undefined;
  const detail = apiError?.data?.error?.details?.[0];

  return {
    message: apiError?.data?.error?.message ?? fallbackMessage,
    solution:
      detail?.solution ??
      fallbackSolution,
    blockers: detail?.blockers ?? [],
  };
}

const branchCopy = {
  en: {
    requestFailed: "The request could not be completed.",
    dependencySolution:
      "Review the linked records, remove the dependency that blocks this action, then try again.",
    branchName: "Branch Name",
    city: "City",
    capacity: "Capacity",
    status: "Status",
    active: "Active",
    inactive: "Inactive",
    actions: "Actions",
    failedLoad: "Failed to load branches.",
    retry: "Retry",
    title: (count: number) => `Branches (${count})`,
    description: "Manage all academy branches and their details.",
    dashboard: "Dashboard",
    academy: "Academy",
    branches: "Branches",
    addBranch: "Add Branch",
    editBranch: "Edit Branch",
    addBranchDescription: "Create a new academy branch.",
    address: "Address",
    capacityOptional: "Capacity (optional)",
    createError: "Could not create the branch. Please check the fields and try again.",
    cancel: "Cancel",
    saveBranch: "Save Branch",
    createBranch: "Create Branch",
    searchPlaceholder: "Search branches...",
    deleteBranch: "Delete Branch",
    clearCommand: "clear",
    confirmDelete: (name: string) => `Type clear ${name} to confirm deletion.`,
    deletePlaceholder: (name: string) => `clear ${name}`,
    error: "Error",
    blockingData: "Blocking data",
    relatedRecords: "related records",
    solution: "Solution",
    deleting: "Deleting...",
    delete: "Delete",
    empty: "-",
    namePlaceholder: "Cairo - Main",
    addressPlaceholder: "Street, city",
    cityPlaceholder: "Cairo",
  },
  ar: {
    requestFailed: "تعذر إكمال الطلب.",
    dependencySolution:
      "راجع السجلات المرتبطة، أزل الاعتماد الذي يمنع هذا الإجراء، ثم حاول مرة أخرى.",
    branchName: "اسم الفرع",
    city: "المدينة",
    capacity: "السعة",
    status: "الحالة",
    active: "نشط",
    inactive: "غير نشط",
    actions: "الإجراءات",
    failedLoad: "فشل تحميل الفروع.",
    retry: "إعادة المحاولة",
    title: (count: number) => `الفروع (${count})`,
    description: "إدارة كل فروع الأكاديمية وتفاصيلها.",
    dashboard: "لوحة التحكم",
    academy: "الأكاديمية",
    branches: "الفروع",
    addBranch: "إضافة فرع",
    editBranch: "تعديل الفرع",
    addBranchDescription: "أنشئ فرعا جديدا للأكاديمية.",
    address: "العنوان",
    capacityOptional: "السعة (اختياري)",
    createError: "تعذر إنشاء الفرع. راجع الحقول ثم حاول مرة أخرى.",
    cancel: "إلغاء",
    saveBranch: "حفظ الفرع",
    createBranch: "إنشاء الفرع",
    searchPlaceholder: "ابحث في الفروع...",
    deleteBranch: "حذف الفرع",
    clearCommand: "حذف",
    confirmDelete: (name: string) => `اكتب حذف ${name} لتأكيد الحذف.`,
    deletePlaceholder: (name: string) => `حذف ${name}`,
    error: "خطأ",
    blockingData: "بيانات تمنع الحذف",
    relatedRecords: "سجلات مرتبطة",
    solution: "الحل",
    deleting: "جاري الحذف...",
    delete: "حذف",
    empty: "-",
    namePlaceholder: "القاهرة - الرئيسي",
    addressPlaceholder: "الشارع، المدينة",
    cityPlaceholder: "القاهرة",
  },
} as const;

type BranchCopy = (typeof branchCopy)[keyof typeof branchCopy];

const createBaseColumns = (copy: BranchCopy): Column<Branch>[] => [
  {
    key: "name",
    header: copy.branchName,
    accessor: (row) => (
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <MapPin className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.address ?? row.city ?? copy.empty}</p>
        </div>
      </div>
    ),
    sortable: true,
    sortValue: (row) => row.name,
  },
  {
    key: "city",
    header: copy.city,
    accessor: (row) => row.city ?? copy.empty,
    sortable: true,
    sortValue: (row) => row.city ?? "",
  },
  {
    key: "capacity",
    header: copy.capacity,
    accessor: (row) => (
      <span>{row.capacity != null ? row.capacity : copy.empty}</span>
    ),
    sortable: true,
    sortValue: (row) => row.capacity ?? 0,
  },
  {
    key: "status",
    header: copy.status,
    accessor: (row) => (
      <Badge variant={row.is_active ? "success" : "secondary"}>
        {row.is_active ? copy.active : copy.inactive}
      </Badge>
    ),
    sortable: true,
    sortValue: (row) => (row.is_active ? "active" : "inactive"),
  },
];

export default function BranchesPage() {
  const language = useDashboardLanguage();
  const t = branchCopy[language];
  const router = useRouter();
  const { data: branches, isLoading, isError, refetch } = useGetBranchesQuery();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [deleteText, setDeleteText] = useState("");
  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    capacity: "",
  });
  const [createBranch, { isLoading: isCreating, error: createError }] =
    useCreateBranchMutation();
  const [updateBranch, { isLoading: isUpdating, error: updateError }] = useUpdateBranchMutation();
  const [deleteBranch, { isLoading: isDeleting, error: deleteError }] = useDeleteBranchMutation();

  const columns = useMemo<Column<Branch>[]>(() => [
    ...createBaseColumns(t),
    {
      key: "actions",
      header: t.actions,
      accessor: (row) => (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={(event) => {
            event.stopPropagation();
            setEditingBranch(row);
            setForm({
              name: row.name,
              address: row.address ?? "",
              city: row.city ?? "",
              capacity: row.capacity != null ? String(row.capacity) : "",
            });
            setCreateOpen(true);
          }}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={(event) => {
            event.stopPropagation();
            setDeleteTarget(row);
            setDeleteText("");
          }}>
            <Trash2 className="h-4 w-4 text-red-400" />
          </Button>
        </div>
      ),
    },
  ], [t]);

  const handleDialogChange = (open: boolean) => {
    setCreateOpen(open);
    if (!open) {
      setEditingBranch(null);
      setForm({ name: "", address: "", city: "", capacity: "" });
    }
  };

  const handleCreateBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const capacityValue = form.capacity.trim()
      ? Number(form.capacity)
      : undefined;
    const payload = {
      name: form.name.trim(),
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      capacity:
        Number.isFinite(capacityValue) && capacityValue && capacityValue > 0
          ? capacityValue
          : undefined,
    };

    if (!payload.name) return;

    try {
      if (editingBranch) {
        await updateBranch({ id: editingBranch.id, body: payload }).unwrap();
      } else {
        await createBranch(payload).unwrap();
      }
      handleDialogChange(false);
    } catch {
      // Error handled via createError
    }
  };

  const deleteName = deleteTarget?.name ?? "";
  const deleteConfirmText = `${t.clearCommand} ${deleteName}`;
  const deleteApiError = deleteError
    ? getApiError(deleteError, t.requestFailed, t.dependencySolution)
    : null;
  const handleDelete = async () => {
    if (!deleteTarget || deleteText !== deleteConfirmText) return;

    try {
      await deleteBranch(deleteTarget.id).unwrap();
      setDeleteTarget(null);
      setDeleteText("");
    } catch {
      // The dialog renders the API error with the recovery action below.
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        {Array.from({ length: 5 }).map((_, i) => (
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

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t.title(branches?.length ?? 0)}
        description={t.description}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.academy },
          { label: t.branches },
        ]}
        actions={
          <Button className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            {t.addBranch}
          </Button>
        }
      />

      <Dialog open={createOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBranch ? t.editBranch : t.addBranch}</DialogTitle>
            <DialogDescription>
              {t.addBranchDescription}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreateBranch}>
            <div className="space-y-2">
              <Label htmlFor="branch-name">{t.branchName}</Label>
              <Input
                id="branch-name"
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder={t.namePlaceholder}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-address">{t.address}</Label>
              <Input
                id="branch-address"
                value={form.address}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, address: event.target.value }))
                }
                placeholder={t.addressPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-city">{t.city}</Label>
              <Input
                id="branch-city"
                value={form.city}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, city: event.target.value }))
                }
                placeholder={t.cityPlaceholder}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-capacity">{t.capacityOptional}</Label>
              <Input
                id="branch-capacity"
                type="number"
                min={1}
                value={form.capacity}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, capacity: event.target.value }))
                }
                placeholder="120"
              />
            </div>
            {(createError || updateError) && (
              <p className="text-sm text-red-400">
                {t.createError}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleDialogChange(false)}>
                {t.cancel}
              </Button>
              <Button type="submit" disabled={form.name.trim().length === 0 || isCreating || isUpdating} className="gap-2">
                {(isCreating || isUpdating) && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingBranch ? t.saveBranch : t.createBranch}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <DataTable
        data={branches ?? []}
        columns={columns}
        searchable
        searchPlaceholder={t.searchPlaceholder}
        searchKey={(row) => `${row.name} ${row.address ?? ""} ${row.city ?? ""}`}
        onRowClick={(row) => router.push(`/admin/academy/branches/${row.id}`)}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(next) => !next && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.deleteBranch}</DialogTitle>
            <DialogDescription>{t.confirmDelete(deleteName)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} placeholder={t.deletePlaceholder(deleteName)} />
            {deleteApiError && (
              <div className="space-y-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">
                <div>
                  <p className="font-semibold text-red-300">{t.error}</p>
                  <p className="text-red-100">{deleteApiError.message}</p>
                </div>
                {deleteApiError.blockers.length > 0 && (
                  <div>
                    <p className="font-semibold text-red-300">{t.blockingData}</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-red-100">
                      {deleteApiError.blockers.map((blocker) => (
                        <li key={blocker.key ?? blocker.label}>
                          {blocker.count ?? 0} {blocker.label ?? t.relatedRecords}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-red-300">{t.solution}</p>
                  <p className="text-red-100">{deleteApiError.solution}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>{t.cancel}</Button>
            <Button type="button" variant="destructive" disabled={isDeleting || deleteText !== deleteConfirmText} onClick={handleDelete}>
              {isDeleting ? t.deleting : t.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
