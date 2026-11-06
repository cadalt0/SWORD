"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { motion } from "motion/react";
import { CameraOff, ImageUp, ScanLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { parseWalletPayUri } from "@/lib/shared/paylink";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "./kit";

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
type DetectorClass = new (options: { formats: string[] }) => Detector;

/// What a scanned code points to: a Sword pay link, or a plain address to send to.
export type ScanTarget =
  | { kind: "order"; merchant: string; order: string; chainId?: number }
  /// A plain address, or a wallet payment request with an exact amount (decimal USDT).
  | { kind: "address"; address: string; amount?: string };

/// Reads a scanned text as a pay link or an address. Undefined when it is neither.
export function parseScan(text: string): ScanTarget | undefined {
  const value = text.trim();
  const request = parseWalletPayUri(value);
  if (request) return { kind: "address", address: request.to, amount: (Number(request.amount) / 1e6).toString() };
  try {
    const url = new URL(value);
    const merchant = url.searchParams.get("merchant");
    const order = url.searchParams.get("order");
    const chain = url.searchParams.get("chain");
    if (merchant && order) return { kind: "order", merchant, order, chainId: chain ? Number(chain) : undefined };
  } catch {
    // not a URL
  }
  const address = value.replace(/^ethereum:/i, "").split(/[@?]/)[0];
  if (/^0x[0-9a-fA-F]{40}$/.test(address)) return { kind: "address", address };
  return undefined;
}

/// Decodes a QR code from image pixels.
function decodePixels(canvas: HTMLCanvasElement): string | undefined {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return undefined;
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(data.data, data.width, data.height, { inversionAttempts: "dontInvert" })?.data;
}

/// Scans a QR code with the device camera. Asks for camera permission when opened.
export function QrScanner({ open, onOpenChange, onResult }: { open: boolean; onOpenChange: (v: boolean) => void; onResult: (target: ScanTarget) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"starting" | "scanning" | "denied" | "unsupported">("starting");
  const [hint, setHint] = useState<string | undefined>();

  /// Accepts a decoded text if it is something we can act on.
  function accept(text: string): boolean {
    const target = parseScan(text);
    if (!target) {
      setHint("That code is not a Sword pay link or an address.");
      return false;
    }
    onResult(target);
    onOpenChange(false);
    return true;
  }

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | undefined;
    let frame = 0;
    let stopped = false;

    async function start() {
      setHint(undefined);
      setState("starting");
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch {
        if (!stopped) setState("denied");
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      setState("scanning");

      const Native = (globalThis as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
      const detector = Native ? new Native({ formats: ["qr_code"] }) : undefined;

      const tick = async () => {
        if (stopped || !video.videoWidth) {
          if (!stopped) frame = requestAnimationFrame(tick);
          return;
        }
        let text: string | undefined;
        try {
          if (detector) {
            text = (await detector.detect(video))[0]?.rawValue;
          } else if (canvasRef.current) {
            const canvas = canvasRef.current;
            const scale = Math.min(1, 640 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            canvas.getContext("2d", { willReadFrequently: true })?.drawImage(video, 0, 0, canvas.width, canvas.height);
            text = decodePixels(canvas);
          }
        } catch {
          // a frame that fails to decode is skipped
        }
        if (text && accept(text)) return;
        if (!stopped) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    void start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // restart only when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /// Decodes a QR code from a chosen image, for devices without a camera.
  async function fromFile(file: File) {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    const text = decodePixels(canvas);
    if (!text) setHint("No QR code found in that image.");
    else accept(text);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-sm">
        <DialogHeader className="p-5 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="size-4" /> Scan to pay
          </DialogTitle>
          <DialogDescription>Point your camera at a Sword pay QR, or an address QR.</DialogDescription>
        </DialogHeader>

        <div className="relative mx-5 aspect-square overflow-hidden rounded-3xl bg-black">
          <video ref={videoRef} playsInline muted className="size-full object-cover" />
          <canvas ref={canvasRef} className="hidden" />

          {state === "scanning" && (
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute inset-8 rounded-2xl shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]" />
              {[
                "left-8 top-8 border-l-4 border-t-4 rounded-tl-2xl",
                "right-8 top-8 border-r-4 border-t-4 rounded-tr-2xl",
                "left-8 bottom-8 border-l-4 border-b-4 rounded-bl-2xl",
                "right-8 bottom-8 border-r-4 border-b-4 rounded-br-2xl",
              ].map((c) => (
                <span key={c} className={`absolute size-10 border-white ${c}`} />
              ))}
              <motion.span
                className="absolute inset-x-10 h-0.5 rounded-full bg-[linear-gradient(90deg,transparent,oklch(0.8_0.15_290),transparent)] shadow-[0_0_12px_oklch(0.8_0.15_290)]"
                initial={{ top: "14%" }}
                animate={{ top: ["14%", "84%", "14%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          )}

          {state === "starting" && (
            <div className="absolute inset-0 grid place-items-center text-sm text-white/70">
              <span className="inline-flex items-center gap-2">
                <Spinner /> Waiting for camera permission…
              </span>
            </div>
          )}

          {(state === "denied" || state === "unsupported") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
              <span className="grid size-12 place-items-center rounded-2xl bg-white/10">
                <CameraOff className="size-5" />
              </span>
              <p className="text-sm font-medium">{state === "denied" ? "Camera access is blocked" : "Camera not available"}</p>
              <p className="text-xs text-white/60">
                {state === "denied"
                  ? "Allow camera access for this site in your browser settings, then try again."
                  : "This browser can't use the camera here. The camera needs HTTPS or localhost."}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3 p-5">
          {hint && <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">{hint}</p>}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void fromFile(file);
              e.target.value = "";
            }}
          />
          <Button variant="outline" className="h-10 w-full rounded-xl" onClick={() => fileRef.current?.click()}>
            <ImageUp className="size-4" /> Upload a QR image
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
