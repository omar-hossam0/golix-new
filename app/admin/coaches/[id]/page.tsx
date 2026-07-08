"use client";

import { use, useState } from "react";
import Image from "next/image";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { StatsCard } from "@/components/shared/StatsCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useGetCoachByIdQuery,
  useGetCoachGroupsQuery,
  useRegenerateCoachMfaBackupCodesMutation,
  useSetupCoachMfaMutation,
  useUpdateCoachMutation,
  useVerifyCoachMfaMutation,
  type Setup2FAResponse,
} from "@/lib/store/api/adminApi";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import { getInitials } from "@/lib/utils";
import { Edit, Calendar, KeyRound, Loader2, ShieldCheck } from "lucide-react";

type ApiErrorDetails = {
  data?: {
    error?: {
      message?: string;
      details?: { message?: string }[];
    };
  };
};

function getApiErrorMessage(err: unknown, fallback: string) {
  const apiError = err as ApiErrorDetails;
  const detailMessages = apiError.data?.error?.details
    ?.map((detail) => detail.message)
    .filter(Boolean);

  return detailMessages?.length
    ? detailMessages.join(". ")
    : (apiError.data?.error?.message ?? fallback);
}

const strongPasswordPattern =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/;

const coachProfileCopy = {
  en: {
    coachPhone: "Coach phone",
    mfaResetMessage: "Coach MFA was reset. Scan the new QR code.",
    mfaScanMessage: "Scan this QR code with the coach authenticator app.",
    mfaSetupError: "Could not start coach MFA setup.",
    mfaCodeError: "Enter the 6-digit code from the coach phone.",
    mfaActiveMessage:
      "Coach MFA is active now. The coach can log in with this authenticator.",
    mfaInvalidCode: "Invalid MFA code.",
    backupCodesMessage:
      "New coach backup codes generated. Old coach backup codes are no longer valid.",
    backupCodesError: "Could not generate coach backup codes.",
    notFound: "Coach not found.",
    dashboard: "Dashboard",
    coaches: "Coaches",
    editProfile: "Edit Profile",
    manageMfa: "Manage Coach MFA",
    addMfa: "Add Coach MFA",
    coachFallback: "Coach",
    joined: "Joined",
    specialization: "Specialization",
    assignedGroups: "Assigned Groups",
    mfa: "MFA",
    enabled: "Enabled",
    notSet: "Not set",
    groups: "Groups",
    group: "Group",
    role: "Role",
    noGroups: "No groups assigned.",
    coachMfa: "Coach MFA",
    mfaDescription:
      "This creates an authenticator device for {name}. The verification code must come from the coach phone.",
    deviceName: "Device name",
    addDevice: "Add Device",
    startSetup: "Start Setup",
    resetMfa: "Reset MFA",
    appEntry: "The authenticator app entry will show as Goalix Academy Coach.",
    qrAlt: "Coach MFA QR code",
    issuer: "Issuer",
    manualSecret: "Manual secret",
    coachCode: "6-digit coach code",
    verifyDevice: "Verify Coach Device",
    coachBackupCodes: "Coach backup codes",
    backupCodesDescription:
      "Generate replacement backup codes for this coach. Old coach codes will stop working.",
    generateCodes: "Generate Codes",
    backupCodes: "Backup codes",
    resetCoachPassword: "Reset Coach Password",
    resetPasswordDescription:
      "Change the coach login password. The username stays locked and will not change.",
    username: "Username",
    noUsername: "No username",
    newPassword: "New password",
    confirmPassword: "Confirm password",
  },
  ar: {
    coachPhone: "هاتف المدرب",
    mfaResetMessage: "تمت إعادة ضبط MFA للمدرب. امسح رمز QR الجديد.",
    mfaScanMessage: "امسح رمز QR باستخدام تطبيق المصادقة الخاص بالمدرب.",
    mfaSetupError: "تعذر بدء إعداد MFA للمدرب.",
    mfaCodeError: "أدخل الكود المكون من 6 أرقام من هاتف المدرب.",
    mfaActiveMessage:
      "أصبح MFA للمدرب نشطًا الآن. يستطيع المدرب تسجيل الدخول بهذا التطبيق.",
    mfaInvalidCode: "كود MFA غير صحيح.",
    backupCodesMessage:
      "تم إنشاء أكواد احتياطية جديدة للمدرب. الأكواد القديمة لم تعد صالحة.",
    backupCodesError: "تعذر إنشاء الأكواد الاحتياطية للمدرب.",
    notFound: "لم يتم العثور على المدرب.",
    dashboard: "لوحة التحكم",
    coaches: "المدربون",
    editProfile: "تعديل الملف",
    manageMfa: "إدارة MFA للمدرب",
    addMfa: "إضافة MFA للمدرب",
    coachFallback: "مدرب",
    joined: "انضم",
    specialization: "التخصص",
    assignedGroups: "المجموعات المعينة",
    mfa: "MFA",
    enabled: "مفعل",
    notSet: "غير محدد",
    groups: "المجموعات",
    group: "مجموعة",
    role: "الدور",
    noGroups: "لا توجد مجموعات معينة.",
    coachMfa: "MFA المدرب",
    mfaDescription:
      "هذا ينشئ جهاز مصادقة لـ {name}. يجب أن يأتي كود التحقق من هاتف المدرب.",
    deviceName: "اسم الجهاز",
    addDevice: "إضافة جهاز",
    startSetup: "بدء الإعداد",
    resetMfa: "إعادة ضبط MFA",
    appEntry: "سيظهر إدخال تطبيق المصادقة باسم Goalix Academy Coach.",
    qrAlt: "رمز QR الخاص بـ MFA للمدرب",
    issuer: "المصدر",
    manualSecret: "السر اليدوي",
    coachCode: "كود المدرب من 6 أرقام",
    verifyDevice: "تأكيد جهاز المدرب",
    coachBackupCodes: "الأكواد الاحتياطية للمدرب",
    backupCodesDescription:
      "أنشئ أكوادًا احتياطية بديلة لهذا المدرب. ستتوقف الأكواد القديمة عن العمل.",
    generateCodes: "إنشاء الأكواد",
    backupCodes: "الأكواد الاحتياطية",
    resetCoachPassword: "إعادة تعيين كلمة مرور المدرب",
    resetPasswordDescription:
      "غيّر كلمة مرور دخول المدرب. اسم المستخدم ثابت ولن يتغير.",
    username: "اسم المستخدم",
    noUsername: "لا يوجد اسم مستخدم",
    newPassword: "كلمة المرور الجديدة",
    confirmPassword: "تأكيد كلمة المرور",
  },
} as const;

export default function CoachProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    resetPassword?: string | string[];
  }>;
}) {
  const language = useDashboardLanguage();
  const t = coachProfileCopy[language];
  const { id } = use(params);
  const query = use(searchParams);
  const { data: coach, isLoading, error, refetch } = useGetCoachByIdQuery(id);
  const { data: groups } = useGetCoachGroupsQuery(id);
  const [setupCoachMfa, { isLoading: isSettingUpMfa }] =
    useSetupCoachMfaMutation();
  const [verifyCoachMfa, { isLoading: isVerifyingMfa }] =
    useVerifyCoachMfaMutation();
  const [
    regenerateCoachMfaBackupCodes,
    { isLoading: isRegeneratingCoachBackupCodes },
  ] = useRegenerateCoachMfaBackupCodesMutation();
  const [updateCoach, { isLoading: isResettingPassword }] =
    useUpdateCoachMutation();
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<Setup2FAResponse | null>(null);
  const [mfaDeviceName, setMfaDeviceName] = useState<string>(t.coachPhone);
  const [mfaToken, setMfaToken] = useState("");
  const [mfaBackupCodes, setMfaBackupCodes] = useState<string[]>([]);
  const [mfaError, setMfaError] = useState("");
  const [mfaMessage, setMfaMessage] = useState("");
  const resetPasswordQueryValue = Array.isArray(query.resetPassword)
    ? query.resetPassword[0]
    : query.resetPassword;
  const [resetPasswordOpen, setResetPasswordOpen] = useState(
    resetPasswordQueryValue === "1",
  );
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resetPasswordError, setResetPasswordError] = useState("");
  const [resetPasswordMessage, setResetPasswordMessage] = useState("");

  const closeMfaDialog = () => {
    setMfaOpen(false);
    setMfaSetup(null);
    setMfaToken("");
    setMfaBackupCodes([]);
    setMfaError("");
    setMfaMessage("");
  };

  const openMfaDialog = () => {
    if (!coach) return;
    setMfaDeviceName(`${coach.full_name} ${t.coachPhone}`);
    setMfaOpen(true);
    setMfaSetup(null);
    setMfaToken("");
    setMfaBackupCodes([]);
    setMfaError("");
    setMfaMessage("");
  };

  const closeResetPasswordDialog = () => {
    setResetPasswordOpen(false);
    setResetPassword("");
    setResetPasswordConfirm("");
    setResetPasswordError("");
    setResetPasswordMessage("");
  };

  const handleResetCoachPassword = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!coach) return;
    setResetPasswordError("");
    setResetPasswordMessage("");

    if (!strongPasswordPattern.test(resetPassword)) {
      setResetPasswordError(
        "Password must be 8+ characters and include uppercase, number, and special character.",
      );
      return;
    }
    if (resetPassword !== resetPasswordConfirm) {
      setResetPasswordError("Password confirmation does not match.");
      return;
    }

    try {
      await updateCoach({
        id: coach.id,
        body: { password: resetPassword },
      }).unwrap();
      setResetPassword("");
      setResetPasswordConfirm("");
      setResetPasswordMessage(
        "Coach password changed. Any open reset request for this coach is now resolved.",
      );
      void refetch();
    } catch (err) {
      setResetPasswordError(
        getApiErrorMessage(err, "Could not reset coach password."),
      );
    }
  };

  const handleSetupCoachMfa = async (resetExisting = false) => {
    if (!coach) return;
    setMfaError("");
    setMfaMessage("");
    setMfaBackupCodes([]);
    try {
      const result = await setupCoachMfa({
        coachId: coach.id,
        deviceName:
          mfaDeviceName.trim() || `${coach.full_name} ${t.coachPhone}`,
        resetExisting,
      }).unwrap();
      setMfaSetup(result);
      setMfaMessage(resetExisting ? t.mfaResetMessage : t.mfaScanMessage);
    } catch (err) {
      setMfaError(getApiErrorMessage(err, t.mfaSetupError));
    }
  };

  const handleVerifyCoachMfa = async () => {
    if (!coach || !mfaSetup?.deviceId) return;
    setMfaError("");
    setMfaMessage("");
    if (!/^\d{6}$/.test(mfaToken.trim())) {
      setMfaError(t.mfaCodeError);
      return;
    }
    try {
      const result = await verifyCoachMfa({
        coachId: coach.id,
        deviceId: mfaSetup.deviceId,
        token: mfaToken.trim(),
      }).unwrap();
      setMfaBackupCodes(result.backupCodes || []);
      setMfaMessage(t.mfaActiveMessage);
      setMfaToken("");
      void refetch();
    } catch (err) {
      setMfaError(getApiErrorMessage(err, t.mfaInvalidCode));
    }
  };

  const handleRegenerateCoachBackupCodes = async () => {
    if (!coach) return;
    setMfaError("");
    setMfaMessage("");
    try {
      const result = await regenerateCoachMfaBackupCodes({
        coachId: coach.id,
      }).unwrap();
      setMfaBackupCodes(result.backupCodes || []);
      setMfaMessage(t.backupCodesMessage);
    } catch (err) {
      setMfaError(getApiErrorMessage(err, t.backupCodesError));
    }
  };

  if (isLoading) return <LoadingSkeleton />;
  if (error || !coach) {
    return (
      <div className="flex h-96 items-center justify-center">
        <p className="text-muted-foreground">{t.notFound}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={coach.full_name}
        breadcrumbs={[
          { label: t.dashboard, href: "/admin/dashboard" },
          { label: t.coaches, href: "/admin/coaches" },
          { label: coach.full_name },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-1.5">
              <Edit className="h-4 w-4" />
              {t.editProfile}
            </Button>
            <Button className="gap-1.5" onClick={openMfaDialog}>
              <ShieldCheck className="h-4 w-4" />
              {coach.totp_enabled ? t.manageMfa : t.addMfa}
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-border/50 bg-card">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-accent/20 text-2xl font-bold text-accent">
                  {getInitials(coach.full_name)}
                </AvatarFallback>
              </Avatar>
              <h3 className="mt-4 text-lg font-bold">{coach.full_name}</h3>
              <p className="text-sm text-muted-foreground">
                {coach.specialization ?? t.coachFallback}
              </p>
              <div className="mt-6 w-full space-y-3 text-sm">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {t.joined} {new Date(coach.created_at).toLocaleDateString()}
                  </span>
                </div>
                {coach.bio && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {coach.bio}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatsCard
              label={t.specialization}
              value={coach.specialization ?? "\u2014"}
              icon="UserCheck"
            />
            <StatsCard
              label={t.assignedGroups}
              value={groups?.length ?? 0}
              icon="Layers"
            />
            <StatsCard
              label={t.mfa}
              value={coach.totp_enabled ? t.enabled : t.notSet}
              icon="ClipboardCheck"
            />
          </div>
          <Tabs defaultValue="groups">
            <TabsList>
              <TabsTrigger value="groups">{t.groups}</TabsTrigger>
            </TabsList>
            <TabsContent value="groups" className="mt-4 space-y-3">
              {groups && groups.length > 0 ? (
                groups.map((g) => (
                  <Card key={g.id} className="border-border/50 bg-card">
                    <CardContent className="flex items-center justify-between p-4">
                      <div>
                        <p className="font-medium">
                          {t.group} {g.group_id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.role}: {g.role}
                        </p>
                      </div>
                      <Badge variant="secondary">{g.role}</Badge>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t.noGroups}
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog
        open={resetPasswordOpen}
        onOpenChange={(nextOpen) =>
          nextOpen ? setResetPasswordOpen(true) : closeResetPasswordDialog()
        }
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.resetCoachPassword}</DialogTitle>
            <DialogDescription>{t.resetPasswordDescription}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetCoachPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="coach-reset-username">{t.username}</Label>
              <Input
                id="coach-reset-username"
                value={coach.username ?? t.noUsername}
                readOnly
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coach-reset-password">{t.newPassword}</Label>
              <Input
                id="coach-reset-password"
                type="password"
                value={resetPassword}
                onChange={(event) => setResetPassword(event.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coach-reset-password-confirm">
                {t.confirmPassword}
              </Label>
              <Input
                id="coach-reset-password-confirm"
                type="password"
                value={resetPasswordConfirm}
                onChange={(event) =>
                  setResetPasswordConfirm(event.target.value)
                }
                autoComplete="new-password"
              />
            </div>
            {resetPasswordError && (
              <p className="text-sm text-red-400">{resetPasswordError}</p>
            )}
            {resetPasswordMessage && (
              <p className="text-sm text-emerald-400">{resetPasswordMessage}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeResetPasswordDialog}
              >
                إغلاق
              </Button>
              <Button
                type="submit"
                disabled={isResettingPassword}
                className="gap-2"
              >
                {isResettingPassword && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                تغيير كلمة المرور
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={mfaOpen}
        onOpenChange={(nextOpen) =>
          nextOpen ? setMfaOpen(true) : closeMfaDialog()
        }
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.coachMfa}</DialogTitle>
            <DialogDescription>
              {t.mfaDescription.replace("{name}", coach.full_name)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-lg border border-border/70 bg-card/50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="coach-detail-mfa-device-name">
                    {t.deviceName}
                  </Label>
                  <Input
                    id="coach-detail-mfa-device-name"
                    value={mfaDeviceName}
                    onChange={(event) => setMfaDeviceName(event.target.value)}
                    placeholder={t.coachPhone}
                  />
                </div>
                <Button
                  type="button"
                  className="gap-2"
                  disabled={isSettingUpMfa}
                  onClick={() => handleSetupCoachMfa(false)}
                >
                  {isSettingUpMfa ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <KeyRound className="h-4 w-4" />
                  )}
                  {coach.totp_enabled ? t.addDevice : t.startSetup}
                </Button>
                {coach.totp_enabled && (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isSettingUpMfa}
                    onClick={() => handleSetupCoachMfa(true)}
                  >
                    {t.resetMfa}
                  </Button>
                )}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{t.appEntry}</p>
            </div>

            {mfaSetup && (
              <div className="grid gap-5 rounded-lg border border-border/70 bg-card/40 p-4 sm:grid-cols-[220px_1fr]">
                <div className="flex justify-center rounded-lg bg-white p-3">
                  <Image
                    src={mfaSetup.qrCode}
                    alt={t.qrAlt}
                    width={192}
                    height={192}
                    unoptimized
                  />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t.issuer}</Label>
                    <Input
                      value={mfaSetup.issuer ?? "Goalix Academy Coach"}
                      readOnly
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.manualSecret}</Label>
                    <Input value={mfaSetup.secret} readOnly />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coach-detail-mfa-token">
                      {t.coachCode}
                    </Label>
                    <Input
                      id="coach-detail-mfa-token"
                      value={mfaToken}
                      onChange={(event) =>
                        setMfaToken(
                          event.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                    />
                  </div>
                  <Button
                    type="button"
                    className="gap-2"
                    disabled={isVerifyingMfa || mfaToken.length !== 6}
                    onClick={handleVerifyCoachMfa}
                  >
                    {isVerifyingMfa && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {t.verifyDevice}
                  </Button>
                </div>
              </div>
            )}

            {coach.totp_enabled && (
              <div className="rounded-lg border border-border/70 bg-card/40 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">
                      {t.coachBackupCodes}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t.backupCodesDescription}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled={isRegeneratingCoachBackupCodes}
                    onClick={handleRegenerateCoachBackupCodes}
                  >
                    {isRegeneratingCoachBackupCodes ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                    {t.generateCodes}
                  </Button>
                </div>
              </div>
            )}

            {mfaBackupCodes.length > 0 && (
              <div className="rounded-lg border border-lime-400/30 bg-lime-400/10 p-4">
                <p className="font-medium text-lime-200">{t.backupCodes}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {mfaBackupCodes.map((code) => (
                    <code
                      key={code}
                      className="rounded-md bg-background/70 px-3 py-2 text-sm text-foreground"
                    >
                      {code}
                    </code>
                  ))}
                </div>
              </div>
            )}

            {mfaMessage && (
              <p className="text-sm text-lime-300">{mfaMessage}</p>
            )}
            {mfaError && <p className="text-sm text-red-400">{mfaError}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
