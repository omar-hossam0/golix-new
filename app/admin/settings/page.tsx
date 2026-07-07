"use client";

import { useState } from "react";
import Image from "next/image";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  useCreateDatabaseBackupMutation,
  useDisable2FAMutation,
  useGetAcademyQuery,
  useGetCurrentUserQuery,
  useGetDatabaseBackupsQuery,
  useGetMfaDevicesQuery,
  useRegenerateMfaBackupCodesMutation,
  useRestoreDatabaseBackupMutation,
  useRevokeMfaDeviceMutation,
  useSetup2FAMutation,
  useSetupMfaDeviceMutation,
  useUpdateAcademyMutation,
  useVerifySetup2FAMutation,
  useVerifyMfaDeviceMutation,
  type Setup2FAResponse,
} from "@/lib/store/api/adminApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { useAppDispatch } from "@/lib/store/hooks";
import { setMfaSetupRequired, updateUser } from "@/lib/store/slices/authSlice";
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Database,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  ShieldOff,
  Trash2,
} from "lucide-react";

type AcademyDraft = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  communityWhatsappUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  matchDayOpenMinutesBeforeKickoff?: string;
  lateGraceMinutes?: string;
  autoCloseMinutes?: string;
  qrAttendanceEnabled?: boolean;
  keepQrOpenWhileEventActive?: boolean;
};

const SYSTEM_WEEK_STARTS_ON = "saturday";

const numberDraft = (
  draftValue: string | undefined,
  storedValue: unknown,
  fallback: number,
) =>
  draftValue ??
  String(typeof storedValue === "number" ? storedValue : fallback);

const booleanDraft = (
  draftValue: boolean | undefined,
  storedValue: unknown,
  fallback: boolean,
) => draftValue ?? (typeof storedValue === "boolean" ? storedValue : fallback);

const clampInt = (
  value: string,
  min: number,
  max: number,
  fallback: number,
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

const normalizeOptionalUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const formatBackupSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const megabytes = bytes / 1024 / 1024;
  return `${megabytes.toFixed(megabytes < 1 ? 2 : 1)} MB`;
};

function getApiErrorMessage(err: unknown, fallback: string) {
  if (
    typeof err === "object" &&
    err &&
    "data" in err &&
    typeof err.data === "object" &&
    err.data &&
    "error" in err.data &&
    typeof err.data.error === "object" &&
    err.data.error &&
    "message" in err.data.error
  ) {
    return String(err.data.error.message);
  }

  return fallback;
}

const settingsCopy = {
  en: {
    pageTitle: "Academy Profile",
    pageDescription: "Manage your academy information and admin security.",
    dashboard: "Dashboard",
    settings: "Settings",
    generalInfo: "General Information",
    academyName: "Academy Name",
    email: "Email",
    phone: "Phone",
    address: "Address",
    saving: "Saving...",
    saveChanges: "Save Changes",
    saved: "Saved",
    footerLinks: "Footer & Social Links",
    footerLinksDescription:
      "These contact details and social links appear on the public homepage footer.",
    facebookUrl: "Facebook URL",
    instagramUrl: "Instagram URL",
    twitterUrl: "Twitter / X URL",
    linkedinUrl: "LinkedIn URL",
    systemDefaults: "System Defaults",
    matchDayOpen: "Match Day opens before kick-off",
    whatsappCommunity: "WhatsApp Community Link",
    lateGrace: "Late Grace Minutes",
    autoClose: "Auto Close Minutes",
    qrAttendance: "QR Attendance",
    adminSecurity: "Admin Login Security",
    adminSecurityDescription:
      "Two-factor authentication for this admin account.",
    checking: "Checking",
    twoFaOn: "2FA On",
    twoFaOff: "2FA Off",
    twoFaRequired: "Admin login requires a 2FA code.",
    authenticatorDevices: "Authenticator devices",
    authenticatorDevicesDescription:
      "Scan a new QR code to add another phone. It will show as Goalix Academy Admin.",
    addDevice: "Add device",
    primary: "Primary",
    added: "Added",
    lastUsed: "Last used",
    remove: "Remove",
    noDevices:
      "Your existing MFA device is still active. Add a new device to manage devices here.",
    newDeviceName: "New device name",
    defaultDeviceName: "Admin phone",
    newMfaAlt: "New MFA device QR code",
    authenticatorLabel: "Authenticator label",
    issuerFallback: "Goalix Academy Admin",
    secret: "Secret",
    verificationCode: "Verification code",
    verifyDevice: "Verify device",
    cancel: "Cancel",
    backupCodesTitle: "MFA backup codes",
    backupCodesDescription:
      "Existing codes cannot be viewed again. Generate new codes to replace the old ones.",
    adminPassword: "Admin password",
    generateBackupCodes: "Generate new backup codes",
    disable2FA: "Disable 2FA",
    twoFaNotRequired: "Admin login currently does not require 2FA.",
    enable2FA: "Enable 2FA",
    twoFaQrAlt: "2FA QR code",
    verifyAndEnable: "Verify & Enable",
    backupCodes: "Backup codes",
    saveError: "Could not save academy settings.",
    start2FAError: "Could not start 2FA setup.",
    twoFaEnabled: "2FA enabled.",
    invalidCode: "Invalid verification code.",
    twoFaDisabled:
      "2FA disabled. Set it up again before using the admin dashboard.",
    disable2FAError: "Could not disable 2FA.",
    addDeviceError: "Could not add MFA device.",
    deviceAdded: "MFA device added.",
    invalidDeviceCode: "Invalid device verification code.",
    deviceRemoved: "MFA device removed.",
    removeDeviceError: "Could not remove MFA device.",
    backupCodesGenerated: "New backup codes generated. Save them now.",
    backupCodesError: "Could not generate backup codes.",
    databaseBackups: "Database backups",
    databaseBackupsDescription:
      "Automatic PostgreSQL backups run from the worker. You can also create one now before risky work.",
    automaticBackups: "Automatic",
    enabled: "Enabled",
    disabled: "Disabled",
    backupInterval: "Every",
    backupRetention: "Retention",
    latestBackup: "Latest backup",
    noBackups: "No database backups found yet.",
    createBackup: "Create backup now",
    creatingBackup: "Creating backup...",
    backupCreated: "Database backup created.",
    backupCreateError: "Could not create database backup.",
    restoreDatabase: "Restore database",
    restoreDatabaseDescription:
      "This replaces the current database with the selected backup. A safety backup is created first.",
    chooseBackup: "Choose backup",
    restoreConfirmationLabel: "Confirmation phrase",
    restoreConfirmationHint: "Type the phrase exactly:",
    restoreNow: "Restore selected backup",
    restoring: "Restoring...",
    restoreDisabled: "Restore is disabled on this server.",
    restoreDone: "Database restore completed.",
    restoreError: "Could not restore database backup.",
  },
  ar: {
    pageTitle: "ملف الأكاديمية",
    pageDescription: "إدارة بيانات الأكاديمية وأمان حساب الإدارة.",
    dashboard: "لوحة التحكم",
    settings: "الإعدادات",
    generalInfo: "البيانات العامة",
    academyName: "اسم الأكاديمية",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    address: "العنوان",
    saving: "جاري الحفظ...",
    saveChanges: "حفظ التغييرات",
    saved: "تم الحفظ",
    footerLinks: "الفوتر وروابط التواصل",
    footerLinksDescription:
      "تظهر بيانات التواصل وروابط السوشيال في فوتر الصفحة الرئيسية العامة.",
    facebookUrl: "رابط فيسبوك",
    instagramUrl: "رابط إنستجرام",
    twitterUrl: "رابط تويتر / X",
    linkedinUrl: "رابط لينكدإن",
    systemDefaults: "إعدادات النظام الافتراضية",
    matchDayOpen: "فتح يوم المباراة قبل ضربة البداية",
    whatsappCommunity: "رابط مجتمع واتساب",
    lateGrace: "دقائق السماح للتأخير",
    autoClose: "دقائق الإغلاق التلقائي",
    qrAttendance: "حضور QR",
    adminSecurity: "أمان تسجيل دخول الإدارة",
    adminSecurityDescription: "المصادقة الثنائية لهذا الحساب الإداري.",
    checking: "جاري الفحص",
    twoFaOn: "2FA مفعلة",
    twoFaOff: "2FA غير مفعلة",
    twoFaRequired: "تسجيل دخول الإدارة يتطلب كود مصادقة ثنائية.",
    authenticatorDevices: "أجهزة المصادقة",
    authenticatorDevicesDescription:
      "امسح كود QR جديد لإضافة هاتف آخر. سيظهر باسم Goalix Academy Admin.",
    addDevice: "إضافة جهاز",
    primary: "أساسي",
    added: "تمت الإضافة",
    lastUsed: "آخر استخدام",
    remove: "إزالة",
    noDevices:
      "جهاز المصادقة الحالي ما زال نشطًا. أضف جهازًا جديدًا لإدارة الأجهزة من هنا.",
    newDeviceName: "اسم الجهاز الجديد",
    defaultDeviceName: "هاتف الإدارة",
    newMfaAlt: "كود QR لجهاز MFA جديد",
    authenticatorLabel: "اسم المصادقة",
    issuerFallback: "Goalix Academy Admin",
    secret: "المفتاح السري",
    verificationCode: "كود التحقق",
    verifyDevice: "تأكيد الجهاز",
    cancel: "إلغاء",
    backupCodesTitle: "أكواد MFA الاحتياطية",
    backupCodesDescription:
      "لا يمكن عرض الأكواد الحالية مرة أخرى. أنشئ أكوادًا جديدة لاستبدال القديمة.",
    adminPassword: "كلمة مرور الإدارة",
    generateBackupCodes: "إنشاء أكواد احتياطية جديدة",
    disable2FA: "تعطيل 2FA",
    twoFaNotRequired: "تسجيل دخول الإدارة لا يتطلب 2FA حاليًا.",
    enable2FA: "تفعيل 2FA",
    twoFaQrAlt: "كود QR لتفعيل 2FA",
    verifyAndEnable: "تأكيد وتفعيل",
    backupCodes: "الأكواد الاحتياطية",
    saveError: "تعذر حفظ إعدادات الأكاديمية.",
    start2FAError: "تعذر بدء إعداد 2FA.",
    twoFaEnabled: "تم تفعيل 2FA.",
    invalidCode: "كود التحقق غير صحيح.",
    twoFaDisabled:
      "تم تعطيل 2FA. فعّله مرة أخرى قبل استخدام لوحة تحكم الإدارة.",
    disable2FAError: "تعذر تعطيل 2FA.",
    addDeviceError: "تعذر إضافة جهاز MFA.",
    deviceAdded: "تمت إضافة جهاز MFA.",
    invalidDeviceCode: "كود تحقق الجهاز غير صحيح.",
    deviceRemoved: "تمت إزالة جهاز MFA.",
    removeDeviceError: "تعذر إزالة جهاز MFA.",
    backupCodesGenerated: "تم إنشاء أكواد احتياطية جديدة. احفظها الآن.",
    backupCodesError: "تعذر إنشاء الأكواد الاحتياطية.",
    databaseBackups: "\u0646\u0633\u062e \u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a",
    databaseBackupsDescription:
      "\u0627\u0644\u0646\u0633\u062e \u0627\u0644\u062a\u0644\u0642\u0627\u0626\u064a \u0644\u0640 PostgreSQL \u064a\u0639\u0645\u0644 \u0645\u0646 \u0627\u0644\u0640 worker. \u064a\u0645\u0643\u0646\u0643 \u0623\u064a\u0636\u0627 \u0625\u0646\u0634\u0627\u0621 \u0646\u0633\u062e\u0629 \u0627\u0644\u0622\u0646 \u0642\u0628\u0644 \u0623\u064a \u0639\u0645\u0644 \u062d\u0633\u0627\u0633.",
    automaticBackups: "\u062a\u0644\u0642\u0627\u0626\u064a",
    enabled: "\u0645\u0641\u0639\u0644",
    disabled: "\u063a\u064a\u0631 \u0645\u0641\u0639\u0644",
    backupInterval: "\u0643\u0644",
    backupRetention: "\u0645\u062f\u0629 \u0627\u0644\u0627\u062d\u062a\u0641\u0627\u0638",
    latestBackup: "\u0622\u062e\u0631 \u0646\u0633\u062e\u0629",
    noBackups: "\u0644\u0627 \u062a\u0648\u062c\u062f \u0646\u0633\u062e \u0644\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u062d\u062a\u0649 \u0627\u0644\u0622\u0646.",
    createBackup: "\u0625\u0646\u0634\u0627\u0621 \u0646\u0633\u062e\u0629 \u0627\u0644\u0622\u0646",
    creatingBackup: "\u062c\u0627\u0631\u064a \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0646\u0633\u062e\u0629...",
    backupCreated: "\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0646\u0633\u062e\u0629 \u0644\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a.",
    backupCreateError: "\u062a\u0639\u0630\u0631 \u0625\u0646\u0634\u0627\u0621 \u0646\u0633\u062e\u0629 \u0644\u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a.",
    restoreDatabase: "\u0627\u0633\u062a\u0631\u062c\u0627\u0639 \u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a",
    restoreDatabaseDescription:
      "\u0647\u0630\u0627 \u064a\u0633\u062a\u0628\u062f\u0644 \u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u062d\u0627\u0644\u064a\u0629 \u0628\u0627\u0644\u0646\u0633\u062e\u0629 \u0627\u0644\u0645\u062d\u062f\u062f\u0629. \u064a\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0646\u0633\u062e\u0629 \u0623\u0645\u0627\u0646 \u0623\u0648\u0644\u0627.",
    chooseBackup: "\u0627\u062e\u062a\u0631 \u0627\u0644\u0646\u0633\u062e\u0629",
    restoreConfirmationLabel: "\u0639\u0628\u0627\u0631\u0629 \u0627\u0644\u062a\u0623\u0643\u064a\u062f",
    restoreConfirmationHint: "\u0627\u0643\u062a\u0628 \u0627\u0644\u0639\u0628\u0627\u0631\u0629 \u0643\u0645\u0627 \u0647\u064a:",
    restoreNow: "\u0627\u0633\u062a\u0631\u062c\u0627\u0639 \u0627\u0644\u0646\u0633\u062e\u0629 \u0627\u0644\u0645\u062d\u062f\u062f\u0629",
    restoring: "\u062c\u0627\u0631\u064a \u0627\u0644\u0627\u0633\u062a\u0631\u062c\u0627\u0639...",
    restoreDisabled: "\u0627\u0644\u0627\u0633\u062a\u0631\u062c\u0627\u0639 \u063a\u064a\u0631 \u0645\u0641\u0639\u0644 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0633\u064a\u0631\u0641\u0631.",
    restoreDone: "\u062a\u0645 \u0627\u0633\u062a\u0631\u062c\u0627\u0639 \u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a.",
    restoreError: "\u062a\u0639\u0630\u0631 \u0627\u0633\u062a\u0631\u062c\u0627\u0639 \u0646\u0633\u062e\u0629 \u0642\u0627\u0639\u062f\u0629 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a.",
  },
} as const;

export default function AcademyProfilePage() {
  const dispatch = useAppDispatch();
  const language = useDashboardLanguage();
  const t = settingsCopy[language];
  const dateLocale = language === "ar" ? "ar-EG" : "en-US";
  const { data: academy, isLoading } = useGetAcademyQuery();
  const { data: currentUser, isLoading: loadingUser } =
    useGetCurrentUserQuery();
  const [updateAcademy, { isLoading: saving }] = useUpdateAcademyMutation();
  const [setup2FA, { isLoading: settingUp2FA }] = useSetup2FAMutation();
  const [verifySetup2FA, { isLoading: verifying2FA }] =
    useVerifySetup2FAMutation();
  const [disable2FA, { isLoading: disabling2FA }] = useDisable2FAMutation();
  const { data: mfaDevices = [] } = useGetMfaDevicesQuery(undefined, {
    skip: !currentUser?.totpEnabled,
  });
  const [setupMfaDevice, { isLoading: settingUpDevice }] =
    useSetupMfaDeviceMutation();
  const [verifyMfaDevice, { isLoading: verifyingDevice }] =
    useVerifyMfaDeviceMutation();
  const [revokeMfaDevice, { isLoading: revokingDevice }] =
    useRevokeMfaDeviceMutation();
  const [regenerateBackupCodes, { isLoading: regeneratingBackupCodes }] =
    useRegenerateMfaBackupCodesMutation();
  const { data: databaseBackups, isLoading: loadingDatabaseBackups } =
    useGetDatabaseBackupsQuery();
  const [createDatabaseBackup, { isLoading: creatingDatabaseBackup }] =
    useCreateDatabaseBackupMutation();
  const [restoreDatabaseBackup, { isLoading: restoringDatabaseBackup }] =
    useRestoreDatabaseBackupMutation();

  const [academyDraft, setAcademyDraft] = useState<AcademyDraft>({});
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [setupData, setSetupData] = useState<Setup2FAResponse | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [newDeviceName, setNewDeviceName] = useState<string>(
    t.defaultDeviceName,
  );
  const [newDeviceSetup, setNewDeviceSetup] = useState<Setup2FAResponse | null>(
    null,
  );
  const [newDeviceCode, setNewDeviceCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [backupCodesPassword, setBackupCodesPassword] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupCodesCopied, setBackupCodesCopied] = useState(false);
  const [securityMessage, setSecurityMessage] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [selectedBackupFileName, setSelectedBackupFileName] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [restoreConfirmation, setRestoreConfirmation] = useState("");
  const [databaseBackupMessage, setDatabaseBackupMessage] = useState("");
  const [databaseBackupError, setDatabaseBackupError] = useState("");

  const settings = (academy?.settings ?? {}) as Record<string, unknown>;
  const attendanceSettings =
    typeof settings.attendance === "object" && settings.attendance
      ? (settings.attendance as Record<string, unknown>)
      : {};
  const academyName = academyDraft.name ?? academy?.name ?? "";
  const academyEmail = academyDraft.email ?? academy?.email ?? "";
  const academyPhone = academyDraft.phone ?? academy?.phone ?? "";
  const academyAddress = academyDraft.address ?? academy?.address ?? "";
  const socialLinks =
    typeof settings.socialLinks === "object" && settings.socialLinks
      ? (settings.socialLinks as Record<string, unknown>)
      : {};
  const settingsWithoutTimezone = { ...settings };
  delete settingsWithoutTimezone.timezone;
  const facebookUrl =
    academyDraft.facebookUrl ??
    (typeof socialLinks.facebook === "string" ? socialLinks.facebook : "");
  const instagramUrl =
    academyDraft.instagramUrl ??
    (typeof socialLinks.instagram === "string" ? socialLinks.instagram : "");
  const twitterUrl =
    academyDraft.twitterUrl ??
    (typeof socialLinks.twitter === "string" ? socialLinks.twitter : "");
  const linkedinUrl =
    academyDraft.linkedinUrl ??
    (typeof socialLinks.linkedin === "string" ? socialLinks.linkedin : "");
  const communityWhatsappUrl =
    academyDraft.communityWhatsappUrl ??
    (typeof settings.communityWhatsappUrl === "string"
      ? settings.communityWhatsappUrl
      : "");
  const matchDayOpenMinutesBeforeKickoff = numberDraft(
    academyDraft.matchDayOpenMinutesBeforeKickoff,
    settings.matchDayOpenMinutesBeforeKickoff,
    5,
  );
  const lateGraceMinutes = numberDraft(
    academyDraft.lateGraceMinutes,
    attendanceSettings.lateGraceMinutes,
    10,
  );
  const autoCloseMinutes = numberDraft(
    academyDraft.autoCloseMinutes,
    attendanceSettings.autoCloseMinutes,
    30,
  );
  const qrAttendanceEnabled = booleanDraft(
    academyDraft.qrAttendanceEnabled,
    attendanceSettings.qrAttendanceEnabled,
    true,
  );
  const keepQrOpenWhileEventActive = booleanDraft(
    academyDraft.keepQrOpenWhileEventActive,
    attendanceSettings.keepQrOpenWhileEventActive,
    true,
  );
  const totpEnabled = Boolean(currentUser?.totpEnabled);
  const mfaAccountLabel =
    currentUser?.email ||
    currentUser?.username ||
    currentUser?.phone ||
    "admin";
  const selectedRestoreBackup =
    selectedBackupFileName || databaseBackups?.latestBackup?.fileName || "";
  const restoreConfirmationPhrase =
    databaseBackups?.restoreConfirmation || "RESTORE GOALIX";
  const canRestoreDatabaseBackup =
    Boolean(databaseBackups?.restoreEnabled) &&
    Boolean(selectedRestoreBackup) &&
    Boolean(restorePassword) &&
    restoreConfirmation === restoreConfirmationPhrase &&
    !restoringDatabaseBackup;

  const getAuthenticatorLabel = (issuer?: string) =>
    `${issuer ?? "Goalix Academy Admin"}:${mfaAccountLabel}`;

  const updateDraft = (field: keyof AcademyDraft, value: string) => {
    setAcademyDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    setSaveError("");
    try {
      const safeMatchDayOpenMinutes = clampInt(
        matchDayOpenMinutesBeforeKickoff,
        0,
        240,
        5,
      );
      await updateAcademy({
        name: academyName.trim(),
        email: academyEmail.trim() || null,
        phone: academyPhone.trim() || null,
        address: academyAddress.trim() || null,
        settings: {
          ...settingsWithoutTimezone,
          weekStartsOn: SYSTEM_WEEK_STARTS_ON,
          communityWhatsappUrl: normalizeOptionalUrl(communityWhatsappUrl),
          socialLinks: {
            ...socialLinks,
            facebook: normalizeOptionalUrl(facebookUrl),
            instagram: normalizeOptionalUrl(instagramUrl),
            twitter: normalizeOptionalUrl(twitterUrl),
            linkedin: normalizeOptionalUrl(linkedinUrl),
          },
          matchDayOpenMinutesBeforeKickoff: safeMatchDayOpenMinutes,
          attendance: {
            ...attendanceSettings,
            qrAttendanceEnabled,
            keepQrOpenWhileEventActive,
            lateGraceMinutes: clampInt(lateGraceMinutes, 0, 120, 10),
            autoCloseMinutes: clampInt(autoCloseMinutes, 0, 240, 30),
          },
        },
      }).unwrap();
      setAcademyDraft({});
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(getApiErrorMessage(err, t.saveError));
    }
  };

  const handleCreateDatabaseBackup = async () => {
    setDatabaseBackupError("");
    setDatabaseBackupMessage("");

    try {
      const result = await createDatabaseBackup().unwrap();
      setSelectedBackupFileName(result.fileName);
      setDatabaseBackupMessage(`${t.backupCreated} ${result.fileName}`);
    } catch (err) {
      setDatabaseBackupError(getApiErrorMessage(err, t.backupCreateError));
    }
  };

  const handleRestoreDatabaseBackup = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setDatabaseBackupError("");
    setDatabaseBackupMessage("");

    if (!selectedRestoreBackup) {
      setDatabaseBackupError(t.noBackups);
      return;
    }

    try {
      await restoreDatabaseBackup({
        fileName: selectedRestoreBackup,
        password: restorePassword,
        confirmation: restoreConfirmation,
      }).unwrap();
      setRestorePassword("");
      setRestoreConfirmation("");
      setDatabaseBackupMessage(t.restoreDone);
    } catch (err) {
      setDatabaseBackupError(getApiErrorMessage(err, t.restoreError));
    }
  };

  const handleStart2FA = async () => {
    setSecurityError("");
    setSecurityMessage("");
    setBackupCodes([]);
    setBackupCodesCopied(false);

    try {
      const result = await setup2FA().unwrap();
      setSetupData(result);
      setSetupCode("");
    } catch (err) {
      setSecurityError(getApiErrorMessage(err, t.start2FAError));
    }
  };

  const handleVerify2FA = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSecurityError("");
    setSecurityMessage("");

    try {
      const result = await verifySetup2FA(setupCode.trim()).unwrap();
      setBackupCodes(result.backupCodes);
      setBackupCodesCopied(false);
      setSetupData(null);
      setSetupCode("");
      dispatch(updateUser({ totpEnabled: true }));
      dispatch(setMfaSetupRequired(false));
      setSecurityMessage(t.twoFaEnabled);
    } catch (err) {
      setSecurityError(getApiErrorMessage(err, t.invalidCode));
    }
  };

  const handleDisable2FA = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSecurityError("");
    setSecurityMessage("");

    try {
      await disable2FA(disablePassword).unwrap();
      setDisablePassword("");
      setBackupCodes([]);
      setSetupData(null);
      dispatch(updateUser({ totpEnabled: false }));
      dispatch(setMfaSetupRequired(true));
      setSecurityMessage(t.twoFaDisabled);
    } catch (err) {
      setSecurityError(getApiErrorMessage(err, t.disable2FAError));
    }
  };

  const handleStartDeviceSetup = async () => {
    setSecurityError("");
    setSecurityMessage("");

    try {
      const result = await setupMfaDevice({
        deviceName: newDeviceName.trim() || t.defaultDeviceName,
      }).unwrap();
      setNewDeviceSetup(result);
      setNewDeviceCode("");
    } catch (err) {
      setSecurityError(getApiErrorMessage(err, t.addDeviceError));
    }
  };

  const handleVerifyDevice = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!newDeviceSetup?.deviceId) return;
    setSecurityError("");
    setSecurityMessage("");

    try {
      await verifyMfaDevice({
        deviceId: newDeviceSetup.deviceId,
        token: newDeviceCode.trim(),
      }).unwrap();
      setNewDeviceSetup(null);
      setNewDeviceCode("");
      setSecurityMessage(t.deviceAdded);
    } catch (err) {
      setSecurityError(getApiErrorMessage(err, t.invalidDeviceCode));
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    setSecurityError("");
    setSecurityMessage("");

    try {
      await revokeMfaDevice(deviceId).unwrap();
      setSecurityMessage(t.deviceRemoved);
    } catch (err) {
      setSecurityError(getApiErrorMessage(err, t.removeDeviceError));
    }
  };

  const handleRegenerateBackupCodes = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setSecurityError("");
    setSecurityMessage("");

    try {
      const result = await regenerateBackupCodes(backupCodesPassword).unwrap();
      setBackupCodes(result.backupCodes);
      setBackupCodesCopied(false);
      setBackupCodesPassword("");
      setSecurityMessage(t.backupCodesGenerated);
    } catch (err) {
      setSecurityError(getApiErrorMessage(err, t.backupCodesError));
    }
  };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={t.pageTitle}
        description={t.pageDescription}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.settings },
          { label: t.pageTitle },
        ]}
      />

      <div className="space-y-6">
        <div className="space-y-6">
          <Card className="border-border/50 bg-card">
            <CardHeader>
              <CardTitle className="text-base">{t.generalInfo}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t.academyName}</Label>
                <Input
                  value={academyName}
                  onChange={(event) => updateDraft("name", event.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.email}</Label>
                  <Input
                    type="email"
                    value={academyEmail}
                    onChange={(event) =>
                      updateDraft("email", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.phone}</Label>
                  <Input
                    value={academyPhone}
                    onChange={(event) =>
                      updateDraft("phone", event.target.value)
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t.address}</Label>
                <Input
                  value={academyAddress}
                  onChange={(event) =>
                    updateDraft("address", event.target.value)
                  }
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  className="gap-1.5"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Save className="h-4 w-4" />
                  {saving ? t.saving : t.saveChanges}
                </Button>
                {saved && (
                  <span className="flex items-center gap-1 text-sm text-emerald-400">
                    <CheckCircle className="h-4 w-4" /> {t.saved}
                  </span>
                )}
              </div>
              {saveError && <p className="text-sm text-red-400">{saveError}</p>}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card">
            <CardHeader>
              <CardTitle className="text-base">{t.footerLinks}</CardTitle>
              <CardDescription>{t.footerLinksDescription}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t.facebookUrl}</Label>
                <Input
                  type="url"
                  value={facebookUrl}
                  onChange={(event) =>
                    updateDraft("facebookUrl", event.target.value)
                  }
                  placeholder="https://facebook.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label>{t.instagramUrl}</Label>
                <Input
                  type="url"
                  value={instagramUrl}
                  onChange={(event) =>
                    updateDraft("instagramUrl", event.target.value)
                  }
                  placeholder="https://instagram.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label>{t.twitterUrl}</Label>
                <Input
                  type="url"
                  value={twitterUrl}
                  onChange={(event) =>
                    updateDraft("twitterUrl", event.target.value)
                  }
                  placeholder="https://x.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label>{t.linkedinUrl}</Label>
                <Input
                  type="url"
                  value={linkedinUrl}
                  onChange={(event) =>
                    updateDraft("linkedinUrl", event.target.value)
                  }
                  placeholder="https://linkedin.com/company/..."
                />
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <Button
                  className="gap-1.5"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Save className="h-4 w-4" />
                  {saving ? t.saving : t.saveChanges}
                </Button>
                {saved && (
                  <span className="flex items-center gap-1 text-sm text-emerald-400">
                    <CheckCircle className="h-4 w-4" /> {t.saved}
                  </span>
                )}
              </div>
              {saveError && (
                <p className="text-sm text-red-400 sm:col-span-2">
                  {saveError}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card">
            <CardHeader>
              <CardTitle className="text-base">{t.systemDefaults}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="match-day-open-minutes">
                    {t.matchDayOpen}
                  </Label>
                  <Input
                    id="match-day-open-minutes"
                    type="number"
                    min={0}
                    max={240}
                    step={1}
                    value={matchDayOpenMinutesBeforeKickoff}
                    onChange={(event) =>
                      updateDraft(
                        "matchDayOpenMinutesBeforeKickoff",
                        event.target.value,
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {language === "ar"
                      ? "\u0639\u062f\u062f \u0627\u0644\u062f\u0642\u0627\u0626\u0642 \u0642\u0628\u0644 \u0636\u0631\u0628\u0629 \u0627\u0644\u0628\u062f\u0627\u064a\u0629 \u0627\u0644\u062a\u064a \u064a\u0645\u0643\u0646 \u0644\u0644\u0645\u062f\u0631\u0628 \u062e\u0644\u0627\u0644\u0647\u0627 \u0641\u062a\u062d \u064a\u0648\u0645 \u0627\u0644\u0645\u0628\u0627\u0631\u0627\u0629 (0\u2013240)."
                      : "Minutes before kick-off when coaches can open Match Day (0\u2013240)."}
                  </p>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="community-whatsapp-url">
                    {t.whatsappCommunity}
                  </Label>
                  <Input
                    id="community-whatsapp-url"
                    type="url"
                    value={communityWhatsappUrl}
                    onChange={(event) =>
                      updateDraft("communityWhatsappUrl", event.target.value)
                    }
                    placeholder="https://chat.whatsapp.com/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.lateGrace}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={120}
                    value={lateGraceMinutes}
                    onChange={(event) =>
                      updateDraft("lateGraceMinutes", event.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.autoClose}</Label>
                  <Input
                    type="number"
                    min={0}
                    max={240}
                    value={autoCloseMinutes}
                    onChange={(event) =>
                      updateDraft("autoCloseMinutes", event.target.value)
                    }
                  />
                </div>
              </div>
              <label className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-muted/20 p-3 text-sm">
                <span>{t.qrAttendance}</span>
                <input
                  type="checkbox"
                  checked={qrAttendanceEnabled}
                  onChange={(event) =>
                    setAcademyDraft((current) => ({
                      ...current,
                      qrAttendanceEnabled: event.target.checked,
                    }))
                  }
                />
              </label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  className="gap-1.5"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saving ? t.saving : t.saveChanges}
                </Button>
                {saved && (
                  <span className="flex items-center gap-1 text-sm text-emerald-400">
                    <CheckCircle className="h-4 w-4" /> {t.saved}
                  </span>
                )}
              </div>
              {saveError && <p className="text-sm text-red-400">{saveError}</p>}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Database className="h-4 w-4" />
                  {t.databaseBackups}
                </CardTitle>
                <CardDescription>{t.databaseBackupsDescription}</CardDescription>
              </div>
              <Badge
                variant={databaseBackups?.automaticEnabled ? "success" : "secondary"}
              >
                {t.automaticBackups}:{" "}
                {databaseBackups?.automaticEnabled ? t.enabled : t.disabled}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border/50 bg-muted/10 p-3">
                  <p className="text-xs text-muted-foreground">
                    {t.backupInterval}
                  </p>
                  <p className="text-sm font-medium">
                    {databaseBackups?.intervalMinutes ?? "-"} min
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/10 p-3">
                  <p className="text-xs text-muted-foreground">
                    {t.backupRetention}
                  </p>
                  <p className="text-sm font-medium">
                    {databaseBackups?.retentionDays ?? "-"} days
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/10 p-3">
                  <p className="text-xs text-muted-foreground">
                    {t.latestBackup}
                  </p>
                  <p className="truncate text-sm font-medium">
                    {databaseBackups?.latestBackup?.fileName ?? t.noBackups}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {(databaseBackups?.backups?.length ?? 0) > 0 ? (
                  <div className="space-y-2">
                    {databaseBackups?.backups.slice(0, 5).map((backup) => (
                      <div
                        key={backup.fileName}
                        className="flex flex-col gap-1 rounded-lg border border-border/40 bg-background/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="break-all font-mono text-xs">
                          {backup.fileName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(backup.createdAt).toLocaleString(dateLocale)}{" "}
                          - {formatBackupSize(backup.sizeBytes)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border/40 p-3 text-sm text-muted-foreground">
                    {loadingDatabaseBackups ? t.checking : t.noBackups}
                  </p>
                )}
              </div>

              <Button
                type="button"
                onClick={handleCreateDatabaseBackup}
                disabled={creatingDatabaseBackup}
                className="gap-1.5"
              >
                {creatingDatabaseBackup ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {creatingDatabaseBackup ? t.creatingBackup : t.createBackup}
              </Button>

              <form
                onSubmit={handleRestoreDatabaseBackup}
                className="space-y-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3"
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-red-300" />
                  <div>
                    <p className="text-sm font-semibold text-red-100">
                      {t.restoreDatabase}
                    </p>
                    <p className="text-xs text-red-100/80">
                      {databaseBackups?.restoreEnabled
                        ? t.restoreDatabaseDescription
                        : t.restoreDisabled}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t.chooseBackup}</Label>
                    <Select
                      value={selectedRestoreBackup}
                      onValueChange={setSelectedBackupFileName}
                      disabled={!databaseBackups?.backups.length}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t.chooseBackup} />
                      </SelectTrigger>
                      <SelectContent>
                        {databaseBackups?.backups.map((backup) => (
                          <SelectItem
                            key={backup.fileName}
                            value={backup.fileName}
                          >
                            {backup.fileName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="restore-db-password">
                      {t.adminPassword}
                    </Label>
                    <Input
                      id="restore-db-password"
                      type="password"
                      value={restorePassword}
                      onChange={(event) =>
                        setRestorePassword(event.target.value)
                      }
                      autoComplete="current-password"
                      disabled={!databaseBackups?.restoreEnabled}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="restore-db-confirmation">
                    {t.restoreConfirmationLabel}
                  </Label>
                  <Input
                    id="restore-db-confirmation"
                    value={restoreConfirmation}
                    onChange={(event) =>
                      setRestoreConfirmation(event.target.value)
                    }
                    placeholder={`${t.restoreConfirmationHint} ${restoreConfirmationPhrase}`}
                    disabled={!databaseBackups?.restoreEnabled}
                  />
                </div>

                <Button
                  type="submit"
                  variant="destructive"
                  disabled={!canRestoreDatabaseBackup}
                  className="gap-1.5"
                >
                  {restoringDatabaseBackup ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {restoringDatabaseBackup ? t.restoring : t.restoreNow}
                </Button>
              </form>

              {databaseBackupMessage && (
                <p className="text-sm text-emerald-400">
                  {databaseBackupMessage}
                </p>
              )}
              {databaseBackupError && (
                <p className="text-sm text-red-400">{databaseBackupError}</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base">{t.adminSecurity}</CardTitle>
                <CardDescription>{t.adminSecurityDescription}</CardDescription>
              </div>
              <Badge variant={totpEnabled ? "success" : "secondary"}>
                {loadingUser
                  ? t.checking
                  : totpEnabled
                    ? t.twoFaOn
                    : t.twoFaOff}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-5">
              {totpEnabled ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
                    <ShieldCheck className="h-4 w-4" />
                    {t.twoFaRequired}
                  </div>

                  <div className="space-y-3 rounded-lg border border-border/50 bg-muted/10 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold">
                          {t.authenticatorDevices}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.authenticatorDevicesDescription}
                        </p>
                      </div>
                      {!newDeviceSetup && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleStartDeviceSetup}
                          disabled={settingUpDevice}
                          className="gap-1.5"
                        >
                          {settingUpDevice ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          {t.addDevice}
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {mfaDevices.map((device) => (
                        <div
                          key={device.id}
                          className="flex flex-col gap-2 rounded-lg border border-border/40 bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{device.deviceName}</p>
                              {device.isPrimary && (
                                <Badge variant="success">{t.primary}</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {t.added}{" "}
                              {new Date(device.createdAt).toLocaleString(
                                dateLocale,
                              )}
                              {device.lastUsedAt
                                ? ` - ${t.lastUsed} ${new Date(device.lastUsedAt).toLocaleString(dateLocale)}`
                                : ""}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRevokeDevice(device.id)}
                            disabled={revokingDevice || mfaDevices.length <= 1}
                            className="gap-1.5"
                            title={
                              mfaDevices.length <= 1
                                ? "Add and verify another device before removing this one."
                                : undefined
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            {t.remove}
                          </Button>
                        </div>
                      ))}
                      {!mfaDevices.length && (
                        <p className="rounded-lg border border-dashed border-border/40 p-3 text-sm text-muted-foreground">
                          {t.noDevices}
                        </p>
                      )}
                    </div>

                    {!newDeviceSetup && (
                      <div className="space-y-2">
                        <Label htmlFor="new-mfa-device-name">
                          {t.newDeviceName}
                        </Label>
                        <Input
                          id="new-mfa-device-name"
                          value={newDeviceName}
                          onChange={(event) =>
                            setNewDeviceName(event.target.value)
                          }
                          placeholder={t.defaultDeviceName}
                        />
                      </div>
                    )}

                    {newDeviceSetup && (
                      <form onSubmit={handleVerifyDevice} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                          <div className="rounded-lg border border-border/50 bg-white p-2">
                            <Image
                              src={newDeviceSetup.qrCode}
                              alt={t.newMfaAlt}
                              width={164}
                              height={164}
                              unoptimized
                              className="h-[164px] w-[164px]"
                            />
                          </div>
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label>{t.authenticatorLabel}</Label>
                              <Input
                                value={
                                  newDeviceSetup.issuer ?? t.issuerFallback
                                }
                                readOnly
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>{t.secret}</Label>
                              <Input
                                value={newDeviceSetup.secret}
                                readOnly
                                className="font-mono text-xs"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="new-device-code">
                                {t.verificationCode}
                              </Label>
                              <Input
                                id="new-device-code"
                                value={newDeviceCode}
                                onChange={(event) =>
                                  setNewDeviceCode(
                                    event.target.value.replace(/\D/g, ""),
                                  )
                                }
                                inputMode="numeric"
                                maxLength={6}
                                required
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="submit"
                            disabled={
                              verifyingDevice || newDeviceCode.length !== 6
                            }
                            className="gap-1.5"
                          >
                            {verifyingDevice && (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            {t.verifyDevice}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setNewDeviceSetup(null)}
                          >
                            {t.cancel}
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>

                  <form
                    onSubmit={handleRegenerateBackupCodes}
                    className="space-y-3 rounded-lg border border-border/50 bg-muted/10 p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {t.backupCodesTitle}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.backupCodesDescription}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-backup-codes-password">
                        {t.adminPassword}
                      </Label>
                      <Input
                        id="admin-backup-codes-password"
                        type="password"
                        value={backupCodesPassword}
                        onChange={(event) =>
                          setBackupCodesPassword(event.target.value)
                        }
                        autoComplete="current-password"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={regeneratingBackupCodes || !backupCodesPassword}
                      className="gap-1.5"
                    >
                      {regeneratingBackupCodes ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                      {t.generateBackupCodes}
                    </Button>
                  </form>

                  <form onSubmit={handleDisable2FA} className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="disable-2fa-password">
                        {t.adminPassword}
                      </Label>
                      <Input
                        id="disable-2fa-password"
                        type="password"
                        value={disablePassword}
                        onChange={(event) =>
                          setDisablePassword(event.target.value)
                        }
                        autoComplete="current-password"
                        required
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={disabling2FA}
                      className="gap-1.5"
                    >
                      {disabling2FA ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldOff className="h-4 w-4" />
                      )}
                      {t.disable2FA}
                    </Button>
                  </form>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-300">
                    <ShieldOff className="h-4 w-4" />
                    {t.twoFaNotRequired}
                  </div>
                  {!setupData ? (
                    <Button
                      onClick={handleStart2FA}
                      disabled={settingUp2FA || loadingUser}
                      className="gap-1.5"
                    >
                      {settingUp2FA ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                      {t.enable2FA}
                    </Button>
                  ) : (
                    <form onSubmit={handleVerify2FA} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
                        <div className="rounded-lg border border-border/50 bg-white p-2">
                          <Image
                            src={setupData.qrCode}
                            alt={t.twoFaQrAlt}
                            width={164}
                            height={164}
                            unoptimized
                            className="h-[164px] w-[164px]"
                          />
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label>{t.authenticatorLabel}</Label>
                            <Input
                              value={setupData.issuer ?? t.issuerFallback}
                              readOnly
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{t.secret}</Label>
                            <Input
                              value={setupData.secret}
                              readOnly
                              className="font-mono text-xs"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="setup-2fa-code">
                              {t.verificationCode}
                            </Label>
                            <Input
                              id="setup-2fa-code"
                              value={setupCode}
                              onChange={(event) =>
                                setSetupCode(
                                  event.target.value.replace(/\D/g, ""),
                                )
                              }
                              inputMode="numeric"
                              maxLength={6}
                              required
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          disabled={verifying2FA}
                          className="gap-1.5"
                        >
                          {verifying2FA && (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          )}
                          {t.verifyAndEnable}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setSetupData(null)}
                        >
                          {t.cancel}
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {backupCodes.length > 0 && (
                <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3">
                  <p className="text-sm font-medium">{t.backupCodes}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {backupCodes.map((code) => (
                      <code
                        key={code}
                        className="rounded bg-background px-2 py-1 text-sm"
                      >
                        {code}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {securityMessage && (
                <p className="text-sm text-emerald-400">{securityMessage}</p>
              )}
              {securityError && (
                <p className="text-sm text-red-400">{securityError}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
