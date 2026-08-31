"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

/**
 * In-app camera QR scanner, so paying or opening a split doesn't depend on
 * the phone's own camera app recognizing the code. Decodes locally with
 * jsQR (no upload, no network call) and only ever navigates same-origin —
 * a scanned QR that resolves to some other domain is refused, not followed.
 */
export function ScanQRModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualLink, setManualLink] = useState("");

  const go = useCallback(
    (value: string) => {
      let path: string;
      try {
        const url = new URL(value, window.location.origin);
        if (url.origin !== window.location.origin) {
          setError("Ese QR no es de Bill Split.");
          return;
        }
        path = url.pathname + url.search;
      } catch {
        setError("Eso no parece un link válido.");
        return;
      }
      onClose();
      router.push(path);
    },
    [onClose, router]
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        go(code.data);
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    async function start() {
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch {
        if (!cancelled) {
          setError(
            "No se pudo acceder a la cámara. Revisa los permisos del navegador, o pega el link abajo."
          );
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, go]);

  return (
    <Modal open={open} onClose={onClose} title="Scan a QR">
      <div className="flex flex-col gap-4">
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-surface">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-white/80" />
        </div>
        <canvas ref={canvasRef} className="hidden" />

        <p className="text-center text-sm text-muted">
          Apunta la cámara al código QR del split.
        </p>

        {error && (
          <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <span className="text-sm font-medium text-foreground">O pega el link</span>
          <div className="flex gap-2">
            <Input
              placeholder="https://..."
              value={manualLink}
              onChange={(e) => setManualLink(e.target.value)}
              className="flex-1"
            />
            <Button onClick={() => go(manualLink)} disabled={!manualLink}>
              Ir
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
