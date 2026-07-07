"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
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
  type CustomFieldType,
  type CustomField,
  useCreateCustomCategoryMutation,
  useCreateCustomFieldMutation,
  useCreateCustomFieldOptionMutation,
  useDeleteCustomCategoryMutation,
  useDeleteCustomFieldMutation,
  useGetCustomCategoriesQuery,
} from "@/lib/store/api/calendarApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";

type Role = "admin" | "coach";

interface CoachChoice {
  id: string;
  full_name?: string | null;
  fullName?: string | null;
  username?: string | null;
}

const fieldTypeValues: CustomFieldType[] = [
  "text",
  "long_text",
  "number",
  "decimal",
  "date",
  "time",
  "boolean",
  "single_select",
  "multi_select",
  "rating",
  "percentage",
  "file",
  "image",
  "url",
  "phone",
  "email",
];

const copy = {
  en: {
    deleteFieldTitle: "Delete Field?",
    deleteFieldDescription:
      "This will remove the field from the profile form and delete every saved player value for it. Existing players will look as if this field never existed.",
    fieldPrefix: "Field:",
    cancel: "Cancel",
    deleteFieldAndValues: "Delete Field And Values",
    categorySection: "Category / Section",
    footballInformation: "Football Information",
    description: "Description",
    visibility: "Visibility",
    global: "Global",
    shared: "Shared",
    specificCoach: "Specific Coach",
    coach: "Coach",
    selectCoach: "Select coach",
    addCategory: "Add Category",
    category: "Category",
    selectCategory: "Select category",
    fieldLabel: "Field Label",
    mainPosition: "Main Position",
    fieldKey: "Field Key",
    fieldType: "Field Type",
    unit: "Unit",
    unitPlaceholder: "cm, kg, %",
    requiredForProfile: "Required for profile completion",
    addField: "Add Field",
    addOptionsHint:
      "Create a Single Select or Multi Select field first, then add options here.",
    selectField: "Select Field",
    fieldWithOptions: "Field with options",
    optionLabel: "Option Label",
    striker: "Striker",
    addOption: "Add Option",
    loadingCustomData: "Loading custom data...",
    required: "Required",
    system: "System",
    noFieldsYet: "No fields yet.",
    noCustomData: "No custom player data structure yet.",
    roles: {
      admin: "Admin",
      coach: "Coach",
    },
    visibilityValues: {
      global: "Global",
      shared: "Shared",
      specific_coach: "Specific Coach",
      coach_only: "Coach Only",
    },
    fieldTypes: {
      text: "Text",
      long_text: "Long Text",
      number: "Number",
      decimal: "Decimal Number",
      date: "Date",
      time: "Time",
      boolean: "Yes / No",
      single_select: "Single Select",
      multi_select: "Multi Select",
      rating: "Rating",
      percentage: "Percentage",
      file: "File Upload",
      image: "Image Upload",
      url: "URL",
      phone: "Phone Number",
      email: "Email",
    } satisfies Record<CustomFieldType, string>,
  },
  ar: {
    deleteFieldTitle: "حذف الحقل؟",
    deleteFieldDescription:
      "سيتم حذف الحقل من نموذج الملف الشخصي وحذف كل القيم المحفوظة للاعبين فيه. سيظهر للاعبين الحاليين وكأن هذا الحقل لم يكن موجودًا.",
    fieldPrefix: "الحقل:",
    cancel: "إلغاء",
    deleteFieldAndValues: "حذف الحقل والقيم",
    categorySection: "الفئة / القسم",
    footballInformation: "معلومات كرة القدم",
    description: "الوصف",
    visibility: "الظهور",
    global: "عام",
    shared: "مشترك",
    specificCoach: "مدرب محدد",
    coach: "المدرب",
    selectCoach: "اختر المدرب",
    addCategory: "إضافة فئة",
    category: "الفئة",
    selectCategory: "اختر الفئة",
    fieldLabel: "اسم الحقل",
    mainPosition: "المركز الأساسي",
    fieldKey: "مفتاح الحقل",
    fieldType: "نوع الحقل",
    unit: "الوحدة",
    unitPlaceholder: "سم، كجم، %",
    requiredForProfile: "مطلوب لاكتمال الملف الشخصي",
    addField: "إضافة حقل",
    addOptionsHint:
      "أنشئ حقل اختيار فردي أو اختيار متعدد أولًا، ثم أضف الخيارات هنا.",
    selectField: "اختر الحقل",
    fieldWithOptions: "حقل يحتوي على خيارات",
    optionLabel: "اسم الخيار",
    striker: "مهاجم",
    addOption: "إضافة خيار",
    loadingCustomData: "جاري تحميل البيانات المخصصة...",
    required: "مطلوب",
    system: "نظام",
    noFieldsYet: "لا توجد حقول بعد.",
    noCustomData: "لا يوجد هيكل بيانات مخصص للاعبين بعد.",
    roles: {
      admin: "الإدارة",
      coach: "المدرب",
    },
    visibilityValues: {
      global: "عام",
      shared: "مشترك",
      specific_coach: "مدرب محدد",
      coach_only: "خاص بالمدرب",
    },
    fieldTypes: {
      text: "نص",
      long_text: "نص طويل",
      number: "رقم",
      decimal: "رقم عشري",
      date: "تاريخ",
      time: "وقت",
      boolean: "نعم / لا",
      single_select: "اختيار واحد",
      multi_select: "اختيار متعدد",
      rating: "تقييم",
      percentage: "نسبة مئوية",
      file: "رفع ملف",
      image: "رفع صورة",
      url: "رابط",
      phone: "رقم هاتف",
      email: "بريد إلكتروني",
    } satisfies Record<CustomFieldType, string>,
  },
} as const;

const needsOptions = new Set<CustomFieldType>(["single_select", "multi_select"]);

const toKey = (label: string) =>
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const isProtectedSystemField = (field: Pick<CustomField, "key">) =>
  ["main_position", "main_postion"].includes(toKey(field.key));

export function CustomDataBuilder({ role, coaches = [] }: { role: Role; coaches?: CoachChoice[] }) {
  const language = useDashboardLanguage();
  const t = copy[language];
  const { data: categories = [], isLoading } = useGetCustomCategoriesQuery({ role, targetModule: "player_profile" });
  const [createCategory, { isLoading: creatingCategory }] = useCreateCustomCategoryMutation();
  const [createField, { isLoading: creatingField }] = useCreateCustomFieldMutation();
  const [createOption, { isLoading: creatingOption }] = useCreateCustomFieldOptionMutation();
  const [deleteCategory] = useDeleteCustomCategoryMutation();
  const [deleteField, { isLoading: deletingField }] = useDeleteCustomFieldMutation();
  const [fieldDeleteTarget, setFieldDeleteTarget] = useState<CustomField | null>(null);

  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    visibility: role === "admin" ? "global" : "coach_only",
    assignedCoachId: "",
  });
  const [fieldForm, setFieldForm] = useState({
    categoryId: "",
    label: "",
    key: "",
    fieldType: "text" as CustomFieldType,
    isRequired: true,
    unit: "",
  });
  const [optionForm, setOptionForm] = useState({
    fieldId: "",
    label: "",
  });

  const submitCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createCategory({
      role,
      body: {
        name: categoryForm.name,
        description: categoryForm.description || undefined,
        targetModule: "player_profile",
        visibility: role === "admin" ? categoryForm.visibility : undefined,
        assignedCoachId: role === "admin" && categoryForm.visibility === "specific_coach" ? categoryForm.assignedCoachId : undefined,
        isEditableByCoach: role === "coach",
      },
    }).unwrap();
    setCategoryForm({ name: "", description: "", visibility: role === "admin" ? "global" : "coach_only", assignedCoachId: "" });
  };

  const submitField = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const createdField = await createField({
      role,
      categoryId: fieldForm.categoryId,
      body: {
        label: fieldForm.label,
        key: fieldForm.key || toKey(fieldForm.label),
        fieldType: fieldForm.fieldType,
        isRequired: fieldForm.isRequired,
        unit: fieldForm.unit || undefined,
      },
    }).unwrap();
    if (needsOptions.has(createdField.field_type)) {
      setOptionForm((current) => ({ ...current, fieldId: createdField.id }));
    }
    setFieldForm((current) => ({ ...current, label: "", key: "", fieldType: "text", isRequired: true, unit: "" }));
  };

  const submitOption = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await createOption({
      role,
      fieldId: optionForm.fieldId,
      body: { label: optionForm.label },
    }).unwrap();
    setOptionForm((current) => ({ ...current, label: "" }));
  };

  const ownCanDelete = (createdByRole: "admin" | "coach") => role === "admin" || createdByRole === "coach";
  const canManageField = (field: CustomField) =>
    ownCanDelete(field.created_by_role) && !isProtectedSystemField(field);
  const categoryHasProtectedField = (category: { fields: CustomField[] }) =>
    category.fields.some(isProtectedSystemField);
  const optionFields = categories
    .flatMap((category) => category.fields)
    .filter((field) => needsOptions.has(field.field_type) && !isProtectedSystemField(field));
  const roleLabel = (value: string) =>
    t.roles[value as keyof typeof t.roles] ?? value.replace(/_/g, " ");
  const visibilityLabel = (value: string) =>
    t.visibilityValues[value as keyof typeof t.visibilityValues] ?? value.replace(/_/g, " ");
  const fieldTypeLabel = (value: CustomFieldType) =>
    t.fieldTypes[value] ?? value.replace(/_/g, " ");

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <Dialog
        open={Boolean(fieldDeleteTarget)}
        onOpenChange={(open) => !open && setFieldDeleteTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.deleteFieldTitle}</DialogTitle>
            <DialogDescription>
              {t.deleteFieldDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {t.fieldPrefix} {fieldDeleteTarget?.label}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFieldDeleteTarget(null)}
            >
              {t.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="gap-2"
              disabled={deletingField || !fieldDeleteTarget}
              onClick={async () => {
                if (!fieldDeleteTarget) return;
                await deleteField({ role, id: fieldDeleteTarget.id }).unwrap();
                setFieldDeleteTarget(null);
              }}
            >
              {deletingField && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.deleteFieldAndValues}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="border-border/50 bg-card">
          <CardContent className="p-4">
            <form className="space-y-3" onSubmit={submitCategory}>
              <div>
                <Label>{t.categorySection}</Label>
                <Input value={categoryForm.name} onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))} placeholder={t.footballInformation} required />
              </div>
              <div>
                <Label>{t.description}</Label>
                <Textarea value={categoryForm.description} onChange={(e) => setCategoryForm((p) => ({ ...p, description: e.target.value }))} />
              </div>
              {role === "admin" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t.visibility}</Label>
                    <Select value={categoryForm.visibility} onValueChange={(value) => setCategoryForm((p) => ({ ...p, visibility: value }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">{t.global}</SelectItem>
                        <SelectItem value="shared">{t.shared}</SelectItem>
                        <SelectItem value="specific_coach">{t.specificCoach}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {categoryForm.visibility === "specific_coach" && (
                    <div>
                      <Label>{t.coach}</Label>
                      <Select value={categoryForm.assignedCoachId} onValueChange={(value) => setCategoryForm((p) => ({ ...p, assignedCoachId: value }))}>
                        <SelectTrigger><SelectValue placeholder={t.selectCoach} /></SelectTrigger>
                        <SelectContent>
                          {coaches.map((coach) => (
                            <SelectItem key={coach.id} value={coach.id}>{coach.full_name || coach.fullName || coach.username || coach.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
              <Button type="submit" disabled={creatingCategory || !categoryForm.name || (role === "admin" && categoryForm.visibility === "specific_coach" && !categoryForm.assignedCoachId)} className="w-full gap-2">
                {creatingCategory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t.addCategory}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardContent className="p-4">
            <form className="space-y-3" onSubmit={submitField}>
              <div>
                <Label>{t.category}</Label>
                <Select value={fieldForm.categoryId} onValueChange={(value) => setFieldForm((p) => ({ ...p, categoryId: value }))}>
                  <SelectTrigger><SelectValue placeholder={t.selectCategory} /></SelectTrigger>
                  <SelectContent>
                    {categories.filter((category) => ownCanDelete(category.created_by_role)).map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{t.fieldLabel}</Label>
                  <Input value={fieldForm.label} onChange={(e) => setFieldForm((p) => ({ ...p, label: e.target.value, key: p.key || toKey(e.target.value) }))} placeholder={t.mainPosition} required />
                </div>
                <div>
                  <Label>{t.fieldKey}</Label>
                  <Input value={fieldForm.key} onChange={(e) => setFieldForm((p) => ({ ...p, key: e.target.value }))} placeholder="main_position" required />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>{t.fieldType}</Label>
                  <Select value={fieldForm.fieldType} onValueChange={(value) => setFieldForm((p) => ({ ...p, fieldType: value as CustomFieldType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{fieldTypeValues.map((type) => <SelectItem key={type} value={type}>{fieldTypeLabel(type)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t.unit}</Label>
                  <Input value={fieldForm.unit} onChange={(e) => setFieldForm((p) => ({ ...p, unit: e.target.value }))} placeholder={t.unitPlaceholder} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={fieldForm.isRequired} onChange={(e) => setFieldForm((p) => ({ ...p, isRequired: e.target.checked }))} />
                {t.requiredForProfile}
              </label>
              <Button type="submit" disabled={creatingField || !fieldForm.categoryId || !fieldForm.label || !fieldForm.key} className="w-full gap-2">
                {creatingField ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t.addField}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardContent className="p-4">
            <form className="space-y-3" onSubmit={submitOption}>
              {!optionFields.length && (
                <p className="rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm text-muted-foreground">
                  {t.addOptionsHint}
                </p>
              )}
              <div>
                <Label>{t.selectField}</Label>
                <Select value={optionForm.fieldId} onValueChange={(value) => setOptionForm((p) => ({ ...p, fieldId: value }))}>
                  <SelectTrigger><SelectValue placeholder={t.fieldWithOptions} /></SelectTrigger>
                  <SelectContent>
                    {optionFields.filter((field) => ownCanDelete(field.created_by_role)).map((field) => (
                      <SelectItem key={field.id} value={field.id}>{field.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t.optionLabel}</Label>
                <Input value={optionForm.label} onChange={(e) => setOptionForm((p) => ({ ...p, label: e.target.value }))} placeholder={t.striker} required />
              </div>
              <Button type="submit" disabled={creatingOption || !optionForm.fieldId || !optionForm.label} className="w-full gap-2">
                {creatingOption ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t.addOption}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card><CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t.loadingCustomData}</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {categories.map((category) => (
            <Card key={category.id} className="border-border/50 bg-card">
              <CardContent className="space-y-4 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{category.name}</h3>
                      <Badge variant={category.created_by_role === "admin" ? "default" : "secondary"}>{roleLabel(category.created_by_role)}</Badge>
                      <Badge variant="outline">{visibilityLabel(category.visibility)}</Badge>
                    </div>
                    {category.description && <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>}
                  </div>
                  {ownCanDelete(category.created_by_role) && !categoryHasProtectedField(category) && (
                    <Button variant="outline" size="icon" onClick={() => deleteCategory({ role, id: category.id })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {category.fields.map((field) => (
                    <div key={field.id} className="rounded-md border border-border/60 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{field.label}</p>
                          <p className="text-xs text-muted-foreground">{field.key} - {fieldTypeLabel(field.field_type)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {field.is_required && <Badge variant="warning">{t.required}</Badge>}
                          {isProtectedSystemField(field) && <Badge variant="info">{t.system}</Badge>}
                          {canManageField(field) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setFieldDeleteTarget(field)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {field.options.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {field.options.map((option) => <Badge key={option.id} variant="outline">{option.label}</Badge>)}
                        </div>
                      )}
                    </div>
                  ))}
                  {!category.fields.length && <p className="text-sm text-muted-foreground">{t.noFieldsYet}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
          {!categories.length && <Card><CardContent className="p-8 text-center text-muted-foreground">{t.noCustomData}</CardContent></Card>}
        </div>
      )}
    </div>
  );
}
