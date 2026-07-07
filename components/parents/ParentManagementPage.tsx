"use client";

import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Link2,
  Loader2,
  ScanQrCode,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDashboardLanguage } from "@/lib/hooks/useDashboardLanguage";
import {
  type AdminParentAccount,
  type AdminParentLink,
  type ParentManagementRole,
  useCreateManagedParentAccountMutation,
  useCreateManagedParentLinkMutation,
  useDeleteManagedParentLinkMutation,
  useGetManagedLinkablePlayersQuery,
  useGetManagedParentAccountsQuery,
  useGetManagedParentLinksQuery,
  useLinkManagedParentByQrMutation,
  useUpdateManagedParentLinkMutation,
} from "@/lib/store/api/calendarApi";

type Notice = { type: "success" | "error"; text: string } | null;
type PermissionKey = "canViewProgress" | "canViewPayments" | "canMessageCoach";
type ScanStatus =
  | { type: "idle"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

type Html5QrcodeInstance = {
  start: (
    cameraConfig: MediaTrackConstraints,
    config: {
      fps: number;
      qrbox: (viewfinderWidth: number, viewfinderHeight: number) => { width: number; height: number };
      aspectRatio: number;
      disableFlip: boolean;
      videoConstraints: MediaTrackConstraints;
    },
    onSuccess: (decodedText: string) => void,
    onError?: () => void,
  ) => Promise<unknown>;
  stop: () => Promise<void>;
  clear: () => void;
  isScanning?: boolean;
};

type JsQrFunction = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" },
) => { data: string } | null;

type NativeBarcodeDetector = {
  detect: (source: HTMLVideoElement | HTMLCanvasElement) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => NativeBarcodeDetector;

const relationshipOptions = [
  ["father", "Father", "الأب"],
  ["mother", "Mother", "الأم"],
  ["grandfather", "Grandfather", "الجد"],
  ["grandmother", "Grandmother", "الجدة"],
  ["brother", "Brother", "الأخ"],
  ["sister", "Sister", "الأخت"],
  ["uncle", "Uncle", "العم / الخال"],
  ["aunt", "Aunt", "العمة / الخالة"],
  ["legal_guardian", "Legal Guardian", "وصي قانوني"],
  ["stepfather", "Stepfather", "زوج الأم"],
  ["stepmother", "Stepmother", "زوجة الأب"],
  ["foster_parent", "Foster Parent", "ولي رعاية"],
  ["guardian", "Guardian", "ولي أمر"],
  ["other", "Other", "أخرى"],
] as const;

const copy = {
  en: {
    title: "Parents",
    description: "Create parent logins and link them to one or more players.",
    dashboard: "Dashboard",
    search: "Search parent, player, phone...",
    parents: "Parents",
    players: "Players",
    links: "Links",
    addParent: "Add Parent",
    addParentTitle: "Add Parent",
    fullName: "Parent Full Name",
    username: "Username",
    password: "Password",
    phone: "Phone Number",
    address: "Address",
    relationship: "Relationship to the Player",
    save: "Save",
    create: "Link Parent to Player",
    parentAccount: "Parent account",
    chooseParent: "Choose parent...",
    player: "Player",
    choosePlayer: "Choose player...",
    primaryChild: "Primary child",
    progress: "Progress",
    payments: "Payments",
    coachChat: "Coach chat",
    scanAndLink: "Scan QR & Link",
    linkSelected: "Link selected player",
    activeLinks: "Active links",
    loading: "Loading parent links...",
    noContact: "No contact",
    linkedTo: "linked to",
    primary: "Primary",
    remove: "Remove",
    empty: "No parent links yet.",
    createParentSuccess: "Parent account was created.",
    createSuccess: "The parent-player link was created.",
    qrSuccess: "QR player linked.",
    updateSuccess: "The link permissions were updated.",
    removeSuccess: "The parent-player link was removed.",
    actionFailed: "The action could not be completed. Please try again.",
    removeConfirm: "Remove this parent-player link?",
    parentFallback: "Parent account",
    chooseParentFirst: "Choose a parent account first.",
    scannerTitle: "Link by Player QR",
    cameraScanning: "Camera is scanning.",
    readyToScan: "Ready to scan player QR.",
    qrDetected: "QR detected. Linking player...",
    startCamera: "Start",
    stopCamera: "Stop",
    manualPlaceholder: "QR payload, player code, or ID",
    secureCamera: "Camera requires HTTPS on phones, or localhost on this computer.",
    cameraBlocked: "Camera permission is blocked by the browser.",
    cameraMissing: "No usable camera was found on this device.",
    cameraBusy: "The camera is busy in another app or tab.",
    cameraUnsupported: "Camera scanning is not supported by this browser.",
  },
  ar: {
    title: "أولياء الأمور",
    description: "إنشاء حسابات أولياء الأمور وربطها بلاعب أو أكثر.",
    dashboard: "لوحة التحكم",
    search: "ابحث عن ولي أمر أو لاعب أو رقم هاتف...",
    parents: "أولياء الأمور",
    players: "اللاعبون",
    links: "الروابط",
    addParent: "إضافة ولي أمر",
    addParentTitle: "إضافة ولي أمر",
    fullName: "الاسم الكامل لولي الأمر",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    phone: "رقم الهاتف",
    address: "العنوان",
    relationship: "صلة القرابة باللاعب",
    save: "حفظ",
    create: "ربط ولي الأمر بلاعب",
    parentAccount: "حساب ولي الأمر",
    chooseParent: "اختر ولي الأمر...",
    player: "اللاعب",
    choosePlayer: "اختر اللاعب...",
    primaryChild: "اللاعب الأساسي",
    progress: "التقدم",
    payments: "المدفوعات",
    coachChat: "محادثة المدرب",
    scanAndLink: "مسح QR وربط",
    linkSelected: "ربط اللاعب المحدد",
    activeLinks: "الروابط النشطة",
    loading: "جاري تحميل روابط أولياء الأمور...",
    noContact: "لا توجد وسيلة تواصل",
    linkedTo: "مرتبط باللاعب",
    primary: "أساسي",
    remove: "فك الربط",
    empty: "لا توجد روابط لأولياء الأمور بعد.",
    createParentSuccess: "تم إنشاء حساب ولي الأمر.",
    createSuccess: "تم إنشاء الربط بين ولي الأمر واللاعب.",
    qrSuccess: "تم ربط اللاعب من QR.",
    updateSuccess: "تم تحديث صلاحيات الربط.",
    removeSuccess: "تم فك الربط بين ولي الأمر واللاعب.",
    actionFailed: "تعذر تنفيذ الإجراء. حاول مرة أخرى.",
    removeConfirm: "هل تريد فك الربط بين ولي الأمر واللاعب؟",
    parentFallback: "حساب ولي الأمر",
    chooseParentFirst: "اختر حساب ولي الأمر أولاً.",
    scannerTitle: "ربط من QR اللاعب",
    cameraScanning: "الكاميرا تعمل الآن.",
    readyToScan: "جاهز لمسح QR اللاعب.",
    qrDetected: "تم قراءة QR. جاري ربط اللاعب...",
    startCamera: "تشغيل",
    stopCamera: "إيقاف",
    manualPlaceholder: "QR أو كود اللاعب أو ID",
    secureCamera: "الكاميرا تحتاج HTTPS على الهاتف أو localhost على هذا الجهاز.",
    cameraBlocked: "صلاحية الكاميرا محجوبة من المتصفح.",
    cameraMissing: "لا توجد كاميرا متاحة على هذا الجهاز.",
    cameraBusy: "الكاميرا مستخدمة في تطبيق أو تبويب آخر.",
    cameraUnsupported: "المتصفح لا يدعم مسح الكاميرا.",
  },
} as const;

const initialParentForm = {
  fullName: "",
  username: "",
  password: "",
  phone: "",
  address: "",
  relationship: "guardian",
};

const scannerVideoConstraints: MediaTrackConstraints = {
  facingMode: { ideal: "environment" },
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 24, max: 30 },
  advanced: [{ focusMode: "continuous" }],
} as unknown as MediaTrackConstraints;

function getApiMessage(error: unknown, fallback: string) {
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
}

function parentLabel(parent: AdminParentAccount, fallback: string) {
  return parent.name || parent.full_name || parent.username || parent.email || parent.phone || fallback;
}

function relationLabel(value: string, language: "en" | "ar") {
  const option = relationshipOptions.find(([id]) => id === value);
  return option ? option[language === "ar" ? 2 : 1] : value;
}

function getScannerBox(viewfinderWidth: number, viewfinderHeight: number) {
  const smallestSide = Math.min(viewfinderWidth, viewfinderHeight);
  const maxSafeSize = Math.max(160, smallestSide - 32);
  const minUsefulSize = Math.min(260, maxSafeSize);
  const preferredSize = smallestSide * 0.78;
  const size = Math.round(Math.max(minUsefulSize, Math.min(520, preferredSize, maxSafeSize)));
  return { width: size, height: size };
}

function isCameraSecureContext() {
  if (typeof window === "undefined") return true;
  return window.isSecureContext || ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

async function assertCameraCanOpen(t: typeof copy.en | typeof copy.ar) {
  if (!isCameraSecureContext()) throw new Error(t.secureCamera);
  if (!navigator.mediaDevices?.getUserMedia) throw new Error(t.cameraUnsupported);

  const stream = await navigator.mediaDevices.getUserMedia({
    video: scannerVideoConstraints,
    audio: false,
  });
  stream.getTracks().forEach((track) => track.stop());
}

function getCameraErrorMessage(error: unknown, t: typeof copy.en | typeof copy.ar) {
  if (!isCameraSecureContext()) return t.secureCamera;
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return t.cameraBlocked;
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return t.cameraMissing;
    if (error.name === "NotReadableError") return t.cameraBusy;
  }
  return error instanceof Error ? error.message : t.cameraUnsupported;
}

function ParentQrScannerDialog({
  open,
  onOpenChange,
  disabled,
  parentName,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  parentName: string;
  onSubmit: (payload: string) => Promise<string>;
}) {
  const language = useDashboardLanguage();
  const t = copy[language];
  const scannerElementId = `parent-link-qr-${useId().replace(/:/g, "")}`;
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const jsQrLoopRef = useRef<number | null>(null);
  const jsQrLastAttemptRef = useRef(0);
  const activeRef = useRef(false);
  const lastScanRef = useRef({ payload: "", at: 0 });
  const [cameraActive, setCameraActive] = useState(false);
  const [manualPayload, setManualPayload] = useState("");
  const [status, setStatus] = useState<ScanStatus>({
    type: "idle",
    message: t.readyToScan,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const stopJsQrLoop = useCallback(() => {
    if (jsQrLoopRef.current !== null) {
      window.cancelAnimationFrame(jsQrLoopRef.current);
      jsQrLoopRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(async () => {
    activeRef.current = false;
    stopJsQrLoop();
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        if (scanner.isScanning !== false) await scanner.stop();
      } catch {
        // Scanner may already be stopped by the browser.
      }
      try {
        scanner.clear();
      } catch {
        // Keep cleanup best-effort.
      }
    }
    setCameraActive(false);
  }, [stopJsQrLoop]);

  const submitPayload = useCallback(
    async (rawValue: string) => {
      const payload = rawValue.trim();
      if (!payload || disabled || isSubmitting) return;

      const now = Date.now();
      if (lastScanRef.current.payload === payload && now - lastScanRef.current.at < 3500) return;
      lastScanRef.current = { payload, at: now };

      setIsSubmitting(true);
      setStatus({ type: "idle", message: t.qrDetected });
      try {
        const message = await onSubmit(payload);
        setManualPayload("");
        setStatus({ type: "success", message });
      } catch (error) {
        setStatus({
          type: "error",
          message: getApiMessage(error, t.actionFailed),
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [disabled, isSubmitting, onSubmit, t],
  );

  const startCamera = useCallback(async () => {
    if (disabled || cameraActive) return;

    try {
      await assertCameraCanOpen(t);
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(scannerElementId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      }) as unknown as Html5QrcodeInstance;
      scannerRef.current = scanner;
      activeRef.current = true;
      await scanner.start(
        scannerVideoConstraints,
        {
          fps: 15,
          qrbox: getScannerBox,
          aspectRatio: 1,
          disableFlip: false,
          videoConstraints: scannerVideoConstraints,
        },
        (decodedText) => {
          if (activeRef.current) void submitPayload(decodedText);
        },
      );
      setCameraActive(true);
      setStatus({ type: "idle", message: t.cameraScanning });
    } catch (error) {
      await stopCamera();
      setStatus({ type: "error", message: getCameraErrorMessage(error, t) });
    }
  }, [cameraActive, disabled, scannerElementId, stopCamera, submitPayload, t]);

  useEffect(() => {
    if (!cameraActive || disabled) {
      stopJsQrLoop();
      return;
    }

    let canvas: HTMLCanvasElement | null = null;
    let context: CanvasRenderingContext2D | null = null;
    let jsQr: JsQrFunction | null = null;
    let nativeDetector: NativeBarcodeDetector | null = null;
    let nativeDetecting = false;
    let cancelled = false;

    const scanFrame = () => {
      if (cancelled || !activeRef.current || !jsQr) return;

      const now = Date.now();
      if (now - jsQrLastAttemptRef.current >= 180) {
        jsQrLastAttemptRef.current = now;
        const root = document.getElementById(scannerElementId);
        const video = root?.querySelector("video");

        if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          if (nativeDetector && !nativeDetecting) {
            nativeDetecting = true;
            void nativeDetector
              .detect(video)
              .then((codes) => {
                if (cancelled || !activeRef.current) return;
                const detected = codes.find((code) => code.rawValue)?.rawValue;
                if (detected) {
                  setStatus({ type: "idle", message: t.qrDetected });
                  void submitPayload(detected);
                }
              })
              .catch(() => {
                nativeDetector = null;
              })
              .finally(() => {
                nativeDetecting = false;
              });
          }

          const sourceWidth = video.videoWidth || video.clientWidth;
          const sourceHeight = video.videoHeight || video.clientHeight;

          if (sourceWidth > 0 && sourceHeight > 0) {
            const maxDecodeWidth = 960;
            const scale = Math.min(1, maxDecodeWidth / sourceWidth);
            const width = Math.max(1, Math.round(sourceWidth * scale));
            const height = Math.max(1, Math.round(sourceHeight * scale));

            canvas ??= document.createElement("canvas");
            context ??= canvas.getContext("2d", { willReadFrequently: true });

            if (context) {
              canvas.width = width;
              canvas.height = height;
              context.drawImage(video, 0, 0, width, height);

              try {
                const imageData = context.getImageData(0, 0, width, height);
                const result = jsQr(imageData.data, width, height, {
                  inversionAttempts: "attemptBoth",
                });

                if (result?.data) {
                  setStatus({ type: "idle", message: t.qrDetected });
                  void submitPayload(result.data);
                }
              } catch {
                // Canvas reads can fail briefly while the camera is warming up.
              }
            }
          }
        }
      }

      jsQrLoopRef.current = window.requestAnimationFrame(scanFrame);
    };

    void import("jsqr")
      .then((module) => {
        if (cancelled) return;
        jsQr = (module.default ?? module) as JsQrFunction;
        const BarcodeDetectorClass = (
          window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }
        ).BarcodeDetector;
        nativeDetector = BarcodeDetectorClass
          ? new BarcodeDetectorClass({ formats: ["qr_code"] })
          : null;
        scanFrame();
      })
      .catch(() => {
        if (!cancelled) setStatus({ type: "idle", message: t.cameraScanning });
      });

    return () => {
      cancelled = true;
      stopJsQrLoop();
    };
  }, [cameraActive, disabled, scannerElementId, stopJsQrLoop, submitPayload, t.cameraScanning, t.qrDetected]);

  useEffect(() => {
    let cancelled = false;

    if (open) {
      const timer = window.setTimeout(() => {
        if (cancelled) return;
        setStatus({ type: "idle", message: t.readyToScan });
        void startCamera();
      }, 0);

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    } else {
      const timer = window.setTimeout(() => {
        if (!cancelled) void stopCamera();
      }, 0);

      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }
  }, [open, startCamera, stopCamera, t.readyToScan]);

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  const statusClass =
    status.type === "success"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
      : status.type === "error"
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : "border-border/50 bg-muted/10 text-muted-foreground";
  const StatusIcon =
    status.type === "success" ? CheckCircle2 : status.type === "error" ? XCircle : ScanQrCode;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-24px)] max-w-md overflow-y-auto sm:max-w-lg md:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanQrCode className="h-5 w-5 text-primary" />
            {t.scannerTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2 text-sm font-semibold text-muted-foreground">
            {parentName}
          </div>

          <div className="relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-lg border border-border/50 bg-background md:max-w-[520px]">
            <div
              id={scannerElementId}
              className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
            />
            {!cameraActive && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                <ScanQrCode className="h-12 w-12" />
              </div>
            )}
            {cameraActive && (
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 rounded-lg border-2 border-primary/80 shadow-[0_0_0_999px_rgba(0,0,0,0.20)]"
                style={{
                  height: "min(78%, 360px)",
                  transform: "translate(-50%, -50%)",
                  width: "min(78%, 360px)",
                }}
              />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={() => {
                if (cameraActive) void stopCamera();
                else void startCamera();
              }}
            >
              {cameraActive ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
              {cameraActive ? t.stopCamera : t.startCamera}
            </Button>
          </div>

          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submitPayload(manualPayload);
            }}
          >
            <Input
              value={manualPayload}
              disabled={disabled || isSubmitting}
              onChange={(event) => setManualPayload(event.target.value)}
              placeholder={t.manualPlaceholder}
            />
            <Button
              type="submit"
              size="sm"
              disabled={disabled || isSubmitting || !manualPayload.trim()}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            </Button>
          </form>

          <p className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${statusClass}`}>
            <StatusIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{status.message}</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ParentManagementPage({ role }: { role: ParentManagementRole }) {
  const language = useDashboardLanguage();
  const router = useRouter();
  const t = copy[language];
  const [search, setSearch] = useState("");
  const [parentUserId, setParentUserId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [relation, setRelation] = useState("guardian");
  const [isPrimary, setIsPrimary] = useState(false);
  const [canViewProgress, setCanViewProgress] = useState(true);
  const [canViewPayments, setCanViewPayments] = useState(true);
  const [canMessageCoach, setCanMessageCoach] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [addParentOpen, setAddParentOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [parentForm, setParentForm] = useState(initialParentForm);

  const permissionLabels = useMemo(
    () =>
      [
        ["canViewProgress", t.progress],
        ["canViewPayments", t.payments],
        ["canMessageCoach", t.coachChat],
      ] as const,
    [t.coachChat, t.payments, t.progress],
  );

  const queryArgs = useMemo(
    () => ({
      role,
      page: 1,
      limit: 100,
      search: search.trim() || undefined,
    }),
    [role, search],
  );

  const { data: linksData, isLoading: linksLoading } = useGetManagedParentLinksQuery(queryArgs);
  const { data: parentsData, isLoading: parentsLoading } = useGetManagedParentAccountsQuery(queryArgs);
  const { data: playersData, isLoading: playersLoading } = useGetManagedLinkablePlayersQuery(queryArgs);
  const [createParent, createParentState] = useCreateManagedParentAccountMutation();
  const [createLink, createState] = useCreateManagedParentLinkMutation();
  const [linkByQr, qrState] = useLinkManagedParentByQrMutation();
  const [updateLink] = useUpdateManagedParentLinkMutation();
  const [deleteLink, deleteState] = useDeleteManagedParentLinkMutation();

  const parents = parentsData?.data ?? [];
  const players = playersData?.data ?? [];
  const links = linksData?.data ?? [];
  const isBusy = linksLoading || parentsLoading || playersLoading;
  const selectedParent = parents.find((parent) => parent.id === parentUserId) ?? null;
  const selectedParentLabel = selectedParent
    ? parentLabel(selectedParent, t.parentFallback)
    : t.chooseParentFirst;

  const linkBody = useMemo(
    () => ({
      parentUserId,
      relation,
      isPrimary,
      canViewProgress,
      canViewPayments,
      canMessageCoach,
    }),
    [
      canMessageCoach,
      canViewPayments,
      canViewProgress,
      isPrimary,
      parentUserId,
      relation,
    ],
  );

  function setPermission(key: PermissionKey, checked: boolean) {
    if (key === "canViewProgress") setCanViewProgress(checked);
    if (key === "canViewPayments") setCanViewPayments(checked);
    if (key === "canMessageCoach") setCanMessageCoach(checked);
  }

  async function handleCreateParent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    try {
      const created = await createParent({ role, body: parentForm }).unwrap();
      setParentUserId(created.id);
      setRelation(created.relationship || parentForm.relationship);
      setParentForm(initialParentForm);
      setAddParentOpen(false);
      setNotice({ type: "success", text: t.createParentSuccess });
    } catch (error) {
      setNotice({ type: "error", text: getApiMessage(error, t.actionFailed) });
    }
  }

  async function handleManualLink() {
    if (!parentUserId || !playerId) return;
    setNotice(null);
    try {
      await createLink({
        role,
        body: {
          ...linkBody,
          playerId,
        },
      }).unwrap();
      setPlayerId("");
      setIsPrimary(false);
      setNotice({ type: "success", text: t.createSuccess });
    } catch (error) {
      setNotice({ type: "error", text: getApiMessage(error, t.actionFailed) });
    }
  }

  const handleQrLink = useCallback(
    async (payload: string) => {
      if (!parentUserId) throw new Error(t.chooseParentFirst);
      const link = await linkByQr({
        role,
        body: {
          ...linkBody,
          payload,
        },
      }).unwrap();
      setNotice({ type: "success", text: t.qrSuccess });
      return `${link.player_name || t.player}: ${t.qrSuccess}`;
    },
    [
      linkBody,
      linkByQr,
      parentUserId,
      role,
      t,
    ],
  );

  async function toggle(link: AdminParentLink, key: PermissionKey) {
    setNotice(null);
    try {
      await updateLink({
        role,
        parentLinkId: link.id,
        body: {
          [key]: !link[
            key === "canViewProgress"
              ? "can_view_progress"
              : key === "canViewPayments"
                ? "can_view_payments"
                : "can_message_coach"
          ],
        },
      }).unwrap();
      setNotice({ type: "success", text: t.updateSuccess });
    } catch (error) {
      setNotice({ type: "error", text: getApiMessage(error, t.actionFailed) });
    }
  }

  async function makePrimary(link: AdminParentLink) {
    setNotice(null);
    try {
      await updateLink({
        role,
        parentLinkId: link.id,
        body: { isPrimary: !link.is_primary },
      }).unwrap();
      setNotice({ type: "success", text: t.updateSuccess });
    } catch (error) {
      setNotice({ type: "error", text: getApiMessage(error, t.actionFailed) });
    }
  }

  async function removeLink(linkId: string) {
    if (!window.confirm(t.removeConfirm)) return;
    setNotice(null);
    try {
      await deleteLink({ role, parentLinkId: linkId }).unwrap();
      setNotice({ type: "success", text: t.removeSuccess });
    } catch (error) {
      setNotice({ type: "error", text: getApiMessage(error, t.actionFailed) });
    }
  }

  return (
    <div className="space-y-6" dir={language === "ar" ? "rtl" : "ltr"}>
      <PageHeader
        title={t.title}
        description={t.description}
        breadcrumbs={[
          { label: t.dashboard, href: role === "admin" ? "/admin/dashboard" : "/coach/home" },
          { label: t.title },
        ]}
        actions={
          <Dialog open={addParentOpen} onOpenChange={setAddParentOpen}>
            <DialogTrigger asChild>
              <Button type="button">
                <UserPlus className="h-4 w-4" />
                {t.addParent}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t.addParentTitle}</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={handleCreateParent}>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">{t.fullName}</label>
                  <Input
                    required
                    value={parentForm.fullName}
                    onChange={(event) => setParentForm((form) => ({ ...form, fullName: event.target.value }))}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">{t.username}</label>
                    <Input
                      required
                      value={parentForm.username}
                      onChange={(event) => setParentForm((form) => ({ ...form, username: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold">{t.password}</label>
                    <Input
                      required
                      type="password"
                      value={parentForm.password}
                      onChange={(event) => setParentForm((form) => ({ ...form, password: event.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">{t.phone}</label>
                  <Input
                    required
                    value={parentForm.phone}
                    onChange={(event) => setParentForm((form) => ({ ...form, phone: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">{t.address}</label>
                  <Textarea
                    required
                    value={parentForm.address}
                    onChange={(event) => setParentForm((form) => ({ ...form, address: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold">{t.relationship}</label>
                  <select
                    value={parentForm.relationship}
                    onChange={(event) => setParentForm((form) => ({ ...form, relationship: event.target.value }))}
                    className="goalix-native-select h-11 w-full px-3 text-sm font-semibold"
                  >
                    {relationshipOptions.map(([value, en, ar]) => (
                      <option key={value} value={value}>
                        {language === "ar" ? ar : en}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" className="w-full" disabled={createParentState.isLoading}>
                  {createParentState.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {t.save}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-lg border px-4 py-3 text-sm font-bold ${
            notice.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/30 bg-rose-500/10 text-rose-300"
          }`}
        >
          {notice.text}
        </div>
      )}

      <Card className="border-border/50 bg-card">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t.search}
              className="h-10 w-full bg-transparent text-sm font-semibold outline-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-3 text-center text-sm md:w-[420px]">
            <div className="rounded-lg bg-muted/20 p-3">
              <strong className="block text-xl">{parentsData?.pagination.total ?? parents.length}</strong>
              <span className="text-muted-foreground">{t.parents}</span>
            </div>
            <div className="rounded-lg bg-muted/20 p-3">
              <strong className="block text-xl">{playersData?.pagination.total ?? players.length}</strong>
              <span className="text-muted-foreground">{t.players}</span>
            </div>
            <div className="rounded-lg bg-muted/20 p-3">
              <strong className="block text-xl">{linksData?.pagination.total ?? links.length}</strong>
              <span className="text-muted-foreground">{t.links}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Link2 className="h-4 w-4 text-primary" />
              {t.create}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">{t.parentAccount}</label>
              <select
                value={parentUserId}
                onChange={(event) => setParentUserId(event.target.value)}
                className="goalix-native-select h-11 w-full px-3 text-sm font-semibold"
              >
                <option value="">{t.chooseParent}</option>
                {parents.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parentLabel(parent, t.parentFallback)} ({parent.linked_players_count ?? 0})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold">{t.player}</label>
              <select
                value={playerId}
                onChange={(event) => setPlayerId(event.target.value)}
                className="goalix-native-select h-11 w-full px-3 text-sm font-semibold"
              >
                <option value="">{t.choosePlayer}</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.full_name} {player.group_name ? `- ${player.group_name}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold">{t.relationship}</label>
                <select
                  value={relation}
                  onChange={(event) => setRelation(event.target.value)}
                  className="goalix-native-select h-11 w-full px-3 text-sm font-semibold"
                >
                  {relationshipOptions.map(([value, en, ar]) => (
                    <option key={value} value={value}>
                      {language === "ar" ? ar : en}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(event) => setIsPrimary(event.target.checked)}
                />
                {t.primaryChild}
              </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {permissionLabels.map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 p-3 text-sm font-semibold"
                >
                  <input
                    type="checkbox"
                    checked={
                      key === "canViewProgress"
                        ? canViewProgress
                        : key === "canViewPayments"
                          ? canViewPayments
                          : canMessageCoach
                    }
                    onChange={(event) => setPermission(key, event.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                disabled={!parentUserId || qrState.isLoading}
                onClick={() => setScannerOpen(true)}
              >
                {qrState.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanQrCode className="h-4 w-4" />}
                {t.scanAndLink}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!parentUserId || !playerId || createState.isLoading}
                onClick={handleManualLink}
              >
                {createState.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                {t.linkSelected}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Users className="h-4 w-4 text-primary" />
              {t.activeLinks}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isBusy ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.loading}
              </div>
            ) : (
              links.map((link) => (
                <article key={link.id} className="rounded-lg border border-border/40 bg-muted/20 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-primary">
                        <UserRound className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="font-bold">{link.parent_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {link.parent_email || link.parent_phone || t.noContact} {t.linkedTo}{" "}
                          <strong>{link.player_name}</strong>
                        </p>
                        <p className="mt-1 text-xs font-semibold text-muted-foreground">
                          {relationLabel(link.relation, language)} {link.is_primary ? `- ${t.primary}` : ""}{" "}
                          {link.group_name ? `- ${link.group_name}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={link.is_primary ? "default" : "outline"}
                        size="sm"
                        onClick={() => makePrimary(link)}
                      >
                        {t.primary}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={deleteState.isLoading}
                        onClick={() => removeLink(link.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {t.remove}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {permissionLabels.map(([key, label]) => {
                      const enabled =
                        key === "canViewProgress"
                          ? link.can_view_progress
                          : key === "canViewPayments"
                            ? link.can_view_payments
                            : link.can_message_coach;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggle(link, key)}
                          className={`flex min-h-11 items-center justify-between rounded-lg border px-3 text-sm font-bold ${
                            enabled
                              ? "border-primary/30 bg-primary/10 text-primary"
                              : "border-border/40 bg-background/40 text-muted-foreground"
                          }`}
                        >
                          <span>{label}</span>
                          <ShieldCheck className="h-4 w-4" />
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))
            )}

            {!isBusy && !links.length && (
              <div className="rounded-lg border border-dashed border-border/40 p-8 text-center text-muted-foreground">
                {t.empty}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Users className="h-4 w-4 text-primary" />
            {t.parents}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {parents.map((parent) => (
            <button
              key={parent.id}
              type="button"
              onClick={() => router.push(`/${role}/parents/${parent.id}`)}
              className="rounded-lg border border-border/40 bg-muted/20 p-4 text-left transition hover:border-primary/50 hover:bg-primary/10"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary">
                  <UserRound className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate font-bold">{parentLabel(parent, t.parentFallback)}</h3>
                  <p className="truncate text-sm text-muted-foreground">{parent.phone || parent.username || t.noContact}</p>
                  <p className="mt-1 text-xs font-semibold text-muted-foreground">
                    {parent.linked_players_count ?? 0} {t.players}
                  </p>
                </div>
              </div>
            </button>
          ))}
          {!parents.length && (
            <div className="rounded-lg border border-dashed border-border/40 p-8 text-center text-muted-foreground md:col-span-2 xl:col-span-3">
              {t.empty}
            </div>
          )}
        </CardContent>
      </Card>

      <ParentQrScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        disabled={!parentUserId || qrState.isLoading}
        parentName={selectedParentLabel}
        onSubmit={handleQrLink}
      />
    </div>
  );
}
