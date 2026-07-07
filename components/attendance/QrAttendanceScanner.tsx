"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  ScanQrCode,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useScanMatchAttendanceQrMutation,
  useScanTrainingAttendanceQrMutation,
} from "@/lib/store/api/calendarApi";

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

type QrAttendanceScannerProps = {
  mode: "training" | "match";
  id: string;
  disabled?: boolean;
  onScanSuccess?: () => void;
};

type ScanStatus =
  | { type: "idle"; message: string }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

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

const isCameraSecureContext = () => {
  if (typeof window === "undefined") return true;
  return window.isSecureContext || ["localhost", "127.0.0.1"].includes(window.location.hostname);
};

const scannerVideoConstraints: MediaTrackConstraints = {
  facingMode: { ideal: "environment" },
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 24, max: 30 },
};

const getScannerBox = (viewfinderWidth: number, viewfinderHeight: number) => {
  const smallestSide = Math.min(viewfinderWidth, viewfinderHeight);
  const maxSafeSize = Math.max(160, smallestSide - 32);
  const minUsefulSize = Math.min(260, maxSafeSize);
  const preferredSize = smallestSide * 0.78;
  const size = Math.round(Math.max(minUsefulSize, Math.min(520, preferredSize, maxSafeSize)));

  return { width: size, height: size };
};

const getCameraErrorMessage = (error: unknown) => {
  if (!isCameraSecureContext()) {
    return "Camera requires HTTPS on phones. Open the site with HTTPS, or use localhost on this computer.";
  }

  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Camera permission is blocked by the browser. Allow camera access for this site and try again.";
    }
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") {
      return "No usable camera was found on this device.";
    }
    if (error.name === "NotReadableError") {
      return "The camera is busy in another app or tab. Close it and try again.";
    }
  }

  return error instanceof Error
    ? error.message
    : "Could not start the camera. Paste the player code instead.";
};

const assertCameraCanOpen = async () => {
  if (!isCameraSecureContext()) {
    throw new Error(
      "Camera requires HTTPS on phones. Open the site with HTTPS, or use localhost on this computer.",
    );
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera scanning is not supported by this browser.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: scannerVideoConstraints,
    audio: false,
  });
  stream.getTracks().forEach((track) => track.stop());
};

export function QrAttendanceScanner({
  mode,
  id,
  disabled = false,
  onScanSuccess,
}: QrAttendanceScannerProps) {
  const scannerElementId = `qr-attendance-${useId().replace(/:/g, "")}`;
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const activeRef = useRef(false);
  const jsQrLoopRef = useRef<number | null>(null);
  const jsQrLastAttemptRef = useRef(0);
  const lastScanRef = useRef({ payload: "", at: 0 });
  const [cameraActive, setCameraActive] = useState(false);
  const [manualPayload, setManualPayload] = useState("");
  const [status, setStatus] = useState<ScanStatus>({
    type: "idle",
    message: "Ready for QR attendance.",
  });
  const [scanTraining, trainingState] = useScanTrainingAttendanceQrMutation();
  const [scanMatch, matchState] = useScanMatchAttendanceQrMutation();
  const isSubmitting = trainingState.isLoading || matchState.isLoading;

  const stopCamera = useCallback(async () => {
    activeRef.current = false;
    if (jsQrLoopRef.current !== null) {
      window.cancelAnimationFrame(jsQrLoopRef.current);
      jsQrLoopRef.current = null;
    }
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        if (scanner.isScanning !== false) {
          await scanner.stop();
        }
      } catch {
        // The scanner may already be stopped by the browser.
      }
      try {
        scanner.clear();
      } catch {
        // Keep cleanup best-effort.
      }
    }
    setCameraActive(false);
  }, []);

  const stopJsQrLoop = useCallback(() => {
    if (jsQrLoopRef.current !== null) {
      window.cancelAnimationFrame(jsQrLoopRef.current);
      jsQrLoopRef.current = null;
    }
  }, []);

  const submitPayload = useCallback(
    async (rawValue: string) => {
      const payload = rawValue.trim();
      if (!payload || disabled || isSubmitting) return;

      const now = Date.now();
      if (
        lastScanRef.current.payload === payload &&
        now - lastScanRef.current.at < 3000
      ) {
        return;
      }
      lastScanRef.current = { payload, at: now };

      setStatus({ type: "idle", message: "Marking attendance..." });
      try {
        const result =
          mode === "training"
            ? await scanTraining({ eventId: id, payload }).unwrap()
            : await scanMatch({ matchId: id, payload }).unwrap();
        setManualPayload("");
        setStatus({
          type: "success",
          message: `${result.playerName} ${result.alreadyMarked ? "was already present" : "marked present"}.`,
        });
        onScanSuccess?.();
      } catch (error) {
        setStatus({
          type: "error",
          message: getApiMessage(error, "Could not mark QR attendance."),
        });
      }
    },
    [
      disabled,
      id,
      isSubmitting,
      mode,
      onScanSuccess,
      scanMatch,
      scanTraining,
    ],
  );

  const startCamera = useCallback(async () => {
    if (disabled || cameraActive) return;

    try {
      await assertCameraCanOpen();
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
          aspectRatio: 16 / 9,
          disableFlip: false,
          videoConstraints: scannerVideoConstraints,
        },
        (decodedText) => {
          setStatus({ type: "idle", message: "QR detected. Marking attendance..." });
          void submitPayload(decodedText);
        },
      );
      setCameraActive(true);
      setStatus({ type: "idle", message: "Camera is scanning." });
    } catch (error) {
      await stopCamera();
      setStatus({
        type: "error",
        message: getCameraErrorMessage(error),
      });
    }
  }, [cameraActive, disabled, scannerElementId, stopCamera, submitPayload]);

  useEffect(() => {
    if (!cameraActive || disabled) {
      stopJsQrLoop();
      return;
    }

    let canvas: HTMLCanvasElement | null = null;
    let context: CanvasRenderingContext2D | null = null;
    let jsQr: JsQrFunction | null = null;
    let cancelled = false;

    const scanFrame = () => {
      if (cancelled || !activeRef.current || !jsQr) return;

      const now = Date.now();
      if (now - jsQrLastAttemptRef.current >= 180) {
        jsQrLastAttemptRef.current = now;
        const root = document.getElementById(scannerElementId);
        const video = root?.querySelector("video");

        if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
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
                  setStatus({ type: "idle", message: "QR detected. Marking attendance..." });
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
        scanFrame();
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ type: "idle", message: "Camera is scanning." });
        }
      });

    return () => {
      cancelled = true;
      stopJsQrLoop();
    };
  }, [cameraActive, disabled, scannerElementId, stopJsQrLoop, submitPayload]);

  useEffect(() => {
    if (!disabled || !cameraActive) return;

    const timer = window.setTimeout(() => {
      void stopCamera();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [cameraActive, disabled, stopCamera]);

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
    status.type === "success"
      ? CheckCircle2
      : status.type === "error"
        ? XCircle
        : ScanQrCode;

  return (
    <Card className="border-border/50 bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            <ScanQrCode className="h-4 w-4 text-primary" />
            QR Attendance
          </span>
          <Badge variant={cameraActive ? "success" : "secondary"}>
            {cameraActive ? "Scanning" : "Standby"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative h-[340px] overflow-hidden rounded-md border border-border/50 bg-background sm:h-[420px] xl:h-[460px]">
          <div
            id={scannerElementId}
            className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
          />
          {!cameraActive && (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <ScanQrCode className="h-10 w-10" />
            </div>
          )}
          {cameraActive && (
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 rounded-lg border-2 border-primary/80 shadow-[0_0_0_999px_rgba(0,0,0,0.20)]"
              style={{
                height: "min(72vw, calc(100% - 48px), 520px)",
                transform: "translate(-50%, -50%)",
                width: "min(72vw, calc(100% - 48px), 520px)",
              }}
            />
          )}
          {status.type === "success" && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-emerald-500/10">
              <div className="relative grid h-20 w-20 place-items-center rounded-full bg-emerald-400 text-emerald-950">
                <span className="absolute h-full w-full rounded-full bg-emerald-300/60 animate-ping" />
                <CheckCircle2 className="relative h-10 w-10" />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="gap-2"
            disabled={disabled}
            onClick={() => {
              if (cameraActive) void stopCamera();
              else void startCamera();
            }}
          >
            {cameraActive ? (
              <CameraOff className="h-4 w-4" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {cameraActive ? "Stop" : "Start"}
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
            placeholder="QR payload, player code, or ID"
          />
          <Button
            type="submit"
            size="sm"
            disabled={disabled || isSubmitting || !manualPayload.trim()}
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </Button>
        </form>

        <p className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${statusClass}`}>
          <StatusIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{status.message}</span>
        </p>
      </CardContent>
    </Card>
  );
}
