"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
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
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { useAppSelector } from "@/lib/store/hooks";
import {
  useDownloadPlayerImportTemplateMutation as useDownloadAdminTemplateMutation,
  useImportPlayersMutation as useImportAdminPlayersMutation,
  useValidatePlayerImportMutation as useValidateAdminImportMutation,
} from "@/lib/store/api/adminApi";
import {
  useDownloadPlayerImportTemplateMutation as useDownloadCoachTemplateMutation,
  useImportPlayersMutation as useImportCoachPlayersMutation,
  useValidatePlayerImportMutation as useValidateCoachImportMutation,
} from "@/lib/store/api/calendarApi";
import type {
  PlayerExportMode,
  PlayerImportError,
  PlayerImportResult,
  PlayerImportValidationResult,
} from "@/lib/types/playerImport";

type ApiError = {
  data?: {
    error?: {
      message?: string;
      details?: PlayerImportError[];
    };
  };
};

const copy = {
  en: {
    open: "Import Excel",
    exportOpen: "Download Excel",
    exportTitle: "Download players Excel",
    exportDescription:
      "Choose whether to export current player data, tutorial rows, or an empty workbook.",
    full: "Full players data",
    fullDescription:
      "Exports every player visible to your account. Passwords are never included.",
    sample: "Tutorial sample",
    sampleDescription:
      "Exports three example rows that show how each field should be completed.",
    empty: "Empty template",
    emptyDescription:
      "Exports headers, dropdowns, and validations without player rows.",
    confirmUsername: "Confirm with your username",
    confirmValue: "Type this value to confirm",
    confirmationMismatch: "Type the displayed confirmation value to continue.",
    exportDownload: "Download selected file",
    title: "Import players from Excel",
    description:
      "Download the template, fill every required column, then validate the whole file before importing.",
    download: "Download tutorial template",
    file: "Excel file",
    choose: "Choose an XLSX file",
    validate: "Validate file",
    import: "Import all players",
    close: "Close",
    noFile: "Choose an XLSX file first.",
    downloadError: "Could not download the import template.",
    validationError: "Could not validate the Excel file.",
    importError: "Could not import the players.",
    valid: "The file is valid and ready to import.",
    invalid: "Fix every error below, then upload the corrected file.",
    imported: "players imported successfully.",
    total: "Total",
    created: "Created",
    updated: "Updated",
    skipped: "Skipped",
    failed: "Failed",
    row: "Row",
    column: "Column",
    value: "Wrong value",
    error: "What to fix",
  },
  ar: {
    open: "استيراد Excel",
    exportOpen: "تنزيل Excel",
    exportTitle: "تنزيل ملف اللاعبين",
    exportDescription:
      "اختر تصدير بيانات اللاعبين الحالية أو ملفًا تعليميًا أو قالبًا فارغًا.",
    full: "بيانات اللاعبين كاملة",
    fullDescription:
      "يصدّر كل اللاعبين المتاحين لحسابك. لا يتم تصدير كلمات المرور مطلقًا.",
    sample: "ملف تعليمي",
    sampleDescription:
      "يصدّر ثلاثة صفوف توضيحية تشرح طريقة تعبئة كل حقل.",
    empty: "قالب فارغ",
    emptyDescription:
      "يصدّر العناوين والقوائم المنسدلة والتحققات بدون صفوف لاعبين.",
    confirmUsername: "أكد باستخدام اسم المستخدم",
    confirmValue: "اكتب هذه القيمة للتأكيد",
    confirmationMismatch: "اكتب قيمة التأكيد الظاهرة كما هي للمتابعة.",
    exportDownload: "تنزيل الملف المحدد",
    title: "استيراد اللاعبين من Excel",
    description:
      "نزّل القالب، املأ كل الأعمدة المطلوبة، ثم تحقّق من الملف كاملًا قبل الاستيراد.",
    download: "تنزيل القالب التعليمي",
    file: "ملف Excel",
    choose: "اختر ملف XLSX",
    validate: "التحقق من الملف",
    import: "استيراد كل اللاعبين",
    close: "إغلاق",
    noFile: "اختر ملف XLSX أولًا.",
    downloadError: "تعذر تنزيل قالب الاستيراد.",
    validationError: "تعذر التحقق من ملف Excel.",
    importError: "تعذر استيراد اللاعبين.",
    valid: "الملف صحيح وجاهز للاستيراد.",
    invalid: "أصلح كل الأخطاء التالية ثم ارفع الملف المصحح.",
    imported: "لاعب تم استيرادهم بنجاح.",
    total: "الإجمالي",
    created: "تم الإنشاء",
    updated: "تم التحديث",
    skipped: "بدون تغيير",
    failed: "فشل",
    row: "الصف",
    column: "العمود",
    value: "القيمة الخاطئة",
    error: "المطلوب إصلاحه",
  },
} as const;

function getApiError(error: unknown, fallback: string) {
  const apiError = error as ApiError;
  return {
    message: apiError.data?.error?.message || fallback,
    errors: apiError.data?.error?.details || [],
  };
}

export function PlayerImportDialog({
  role,
  disabled = false,
}: {
  role: "admin" | "coach";
  disabled?: boolean;
}) {
  const language = useDashboardLanguage();
  const t = copy[language];
  const currentUser = useAppSelector((state) => state.auth.user);
  const confirmationIdentity =
    currentUser?.username || currentUser?.email || "";
  const [open, setOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState<PlayerExportMode>("sample");
  const [confirmation, setConfirmation] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [validation, setValidation] =
    useState<PlayerImportValidationResult | null>(null);
  const [result, setResult] = useState<PlayerImportResult | null>(null);

  const [downloadAdminTemplate, adminDownloadState] =
    useDownloadAdminTemplateMutation();
  const [downloadCoachTemplate, coachDownloadState] =
    useDownloadCoachTemplateMutation();
  const [validateAdminImport, adminValidationState] =
    useValidateAdminImportMutation();
  const [validateCoachImport, coachValidationState] =
    useValidateCoachImportMutation();
  const [importAdminPlayers, adminImportState] =
    useImportAdminPlayersMutation();
  const [importCoachPlayers, coachImportState] =
    useImportCoachPlayersMutation();

  const downloading =
    role === "admin"
      ? adminDownloadState.isLoading
      : coachDownloadState.isLoading;
  const validating =
    role === "admin"
      ? adminValidationState.isLoading
      : coachValidationState.isLoading;
  const importing =
    role === "admin" ? adminImportState.isLoading : coachImportState.isLoading;

  const resetFileState = (nextFile: File | null) => {
    setFile(nextFile);
    setMessage("");
    setValidation(null);
    setResult(null);
  };

  const downloadWorkbook = async (
    mode: PlayerExportMode,
    confirmedUsername?: string,
  ) => {
    try {
      const url =
        role === "admin"
          ? await downloadAdminTemplate({
              mode,
              confirmation: confirmedUsername,
            }).unwrap()
          : await downloadCoachTemplate({
              mode,
              confirmation: confirmedUsername,
            }).unwrap();
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `goalix-players-${mode}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      return true;
    } catch (error) {
      const apiError = getApiError(error, t.downloadError);
      if (exportOpen) setExportMessage(apiError.message);
      else setMessage(apiError.message);
      return false;
    } finally {
      if (role === "admin") {
        adminDownloadState.reset();
      } else {
        coachDownloadState.reset();
      }
    }
  };

  const handleTemplateDownload = async () => {
    setMessage("");
    await downloadWorkbook("sample");
  };

  const handleExport = async () => {
    setExportMessage("");
    if (
      exportMode === "full" &&
      confirmation.trim().toLowerCase() !==
        confirmationIdentity.trim().toLowerCase()
    ) {
      setExportMessage(t.confirmationMismatch);
      return;
    }
    const downloaded = await downloadWorkbook(
      exportMode,
      exportMode === "full" ? confirmation.trim() : undefined,
    );
    if (downloaded) {
      setExportOpen(false);
      setConfirmation("");
    }
  };

  const handleValidate = async () => {
    setMessage("");
    setResult(null);
    if (!file) {
      setMessage(t.noFile);
      return;
    }
    try {
      const nextValidation =
        role === "admin"
          ? await validateAdminImport(file).unwrap()
          : await validateCoachImport(file).unwrap();
      setValidation(nextValidation);
    } catch (error) {
      const apiError = getApiError(error, t.validationError);
      setMessage(apiError.message);
      setValidation({
        valid: false,
        totalRows: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: apiError.errors.length ? 1 : 0,
        status: "failed",
        errors: apiError.errors,
      });
    }
  };

  const handleImport = async () => {
    setMessage("");
    if (!file || !validation?.valid) return;
    try {
      const nextResult =
        role === "admin"
          ? await importAdminPlayers(file).unwrap()
          : await importCoachPlayers(file).unwrap();
      setResult(nextResult);
      setValidation(null);
    } catch (error) {
      const apiError = getApiError(error, t.importError);
      setMessage(apiError.message);
      setValidation({
        valid: false,
        totalRows: validation.totalRows,
        created: 0,
        updated: 0,
        skipped: 0,
        failed: apiError.errors.length ? 1 : 0,
        status: "failed",
        errors: apiError.errors,
      });
    }
  };

  const errors = validation?.errors || [];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        disabled={disabled}
        onClick={() => {
          setExportMessage("");
          setExportOpen(true);
        }}
      >
        <Download className="h-4 w-4" />
        {t.exportOpen}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="gap-2"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <FileSpreadsheet className="h-4 w-4" />
        {t.open}
      </Button>
      <Dialog
        open={exportOpen}
        onOpenChange={(nextOpen) => {
          setExportOpen(nextOpen);
          if (!nextOpen) {
            setConfirmation("");
            setExportMessage("");
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t.exportTitle}</DialogTitle>
            <DialogDescription>{t.exportDescription}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {(
              [
                ["full", t.full, t.fullDescription],
                ["sample", t.sample, t.sampleDescription],
                ["empty", t.empty, t.emptyDescription],
              ] as const
            ).map(([mode, label, description]) => (
              <label
                key={mode}
                className="flex cursor-pointer items-start gap-3 border p-3"
              >
                <input
                  type="radio"
                  name={`player-export-mode-${role}`}
                  value={mode}
                  checked={exportMode === mode}
                  onChange={() => {
                    setExportMode(mode);
                    setExportMessage("");
                  }}
                  className="mt-1"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-sm text-muted-foreground">
                    {description}
                  </span>
                </span>
              </label>
            ))}

            {exportMode === "full" && (
              <div className="space-y-2">
                <Label htmlFor={`player-export-confirmation-${role}`}>
                  {t.confirmUsername}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t.confirmValue}:{" "}
                  <strong className="text-foreground">
                    {confirmationIdentity}
                  </strong>
                </p>
                <Input
                  id={`player-export-confirmation-${role}`}
                  value={confirmation}
                  autoComplete="off"
                  onChange={(event) => {
                    setConfirmation(event.target.value);
                    setExportMessage("");
                  }}
                />
              </div>
            )}

            {exportMessage && (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{exportMessage}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setExportOpen(false)}
            >
              {t.close}
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={
                downloading ||
                (exportMode === "full" &&
                  confirmation.trim().toLowerCase() !==
                    confirmationIdentity.trim().toLowerCase())
              }
              onClick={handleExport}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t.exportDownload}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen && result) resetFileState(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t.title}</DialogTitle>
            <DialogDescription>{t.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={downloading}
              onClick={handleTemplateDownload}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {t.download}
            </Button>

            <div className="space-y-2">
              <Label htmlFor={`player-import-${role}`}>{t.file}</Label>
              <Input
                id={`player-import-${role}`}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                aria-label={t.choose}
                onChange={(event) =>
                  resetFileState(event.target.files?.[0] || null)
                }
              />
              {file && (
                <p className="text-sm text-muted-foreground">{file.name}</p>
              )}
            </div>

            {message && (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {validation && (
              <div className="space-y-3">
                <div
                  className={`flex items-start gap-2 text-sm ${
                    validation.valid ? "text-emerald-500" : "text-destructive"
                  }`}
                >
                  {validation.valid ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>{validation.valid ? t.valid : t.invalid}</span>
                </div>

                {validation.valid && (
                  <div className="grid grid-cols-2 gap-px border bg-border text-sm sm:grid-cols-4">
                    {[
                      [t.created, validation.created],
                      [t.updated, validation.updated],
                      [t.skipped, validation.skipped],
                      [t.failed, validation.failed],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="bg-background p-3">
                        <span className="block text-xs text-muted-foreground">
                          {label}
                        </span>
                        <strong className="text-lg">{value}</strong>
                      </div>
                    ))}
                  </div>
                )}

                {errors.length > 0 && (
                  <div className="max-h-72 overflow-auto border">
                    <div className="grid min-w-[760px] grid-cols-[70px_150px_180px_minmax(280px,1fr)] bg-muted px-3 py-2 text-xs font-semibold">
                      <span>{t.row}</span>
                      <span>{t.column}</span>
                      <span>{t.value}</span>
                      <span>{t.error}</span>
                    </div>
                    {errors.map((error, index) => (
                      <div
                        key={`${error.row}-${error.field}-${index}`}
                        className="grid min-w-[760px] grid-cols-[70px_150px_180px_minmax(280px,1fr)] border-t px-3 py-2 text-sm"
                      >
                        <span>{error.row ?? "-"}</span>
                        <span>{error.column}</span>
                        <span className="truncate" title={String(error.value)}>
                          {String(error.value ?? "") || "-"}
                        </span>
                        <span>{error.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {result && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {result.created + result.updated} {t.imported}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-px border bg-border text-sm sm:grid-cols-5">
                  {[
                    [t.total, result.totalRows],
                    [t.created, result.created],
                    [t.updated, result.updated],
                    [t.skipped, result.skipped],
                    [t.failed, result.failed],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="bg-background p-3">
                      <span className="block text-xs text-muted-foreground">
                        {label}
                      </span>
                      <strong className="text-lg">{value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t.close}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={!file || validating || importing}
              onClick={handleValidate}
            >
              {validating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {t.validate}
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={!file || !validation?.valid || validating || importing}
              onClick={handleImport}
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.import}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
