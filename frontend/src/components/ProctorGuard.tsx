"use client";

/**
 * Browser-based proctoring. Captures integrity signals during a monitored quiz:
 *  - tab switches / window blur (always available)
 *  - missing face / multiple faces via the experimental FaceDetector API
 *    (Chromium); gracefully degrades to tab/blur-only when unsupported.
 * Events are batched and POSTed to /api/v1/proctor/events.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { LuShieldCheck, LuShieldAlert, LuVideoOff } from "react-icons/lu";
import { logProctorEvents } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

type ProctorEventType =
  | "tab_hidden"
  | "window_blur"
  | "no_face"
  | "multiple_faces"
  | "looking_away"
  | "fullscreen_exit";

interface PendingEvent {
  type: ProctorEventType;
  detail?: string;
  at: string;
}

// Minimal typing for the experimental FaceDetector API.
interface FaceDetectorLike {
  detect: (source: CanvasImageSource) => Promise<Array<unknown>>;
}
declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;
  }
}

export function ProctorGuard({
  sessionId,
  context,
  enabled = true,
  onWarning,
}: {
  sessionId: string;
  context: string;
  enabled?: boolean;
  onWarning?: (count: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const queueRef = useRef<PendingEvent[]>([]);
  const warningsRef = useRef(0);

  const [warnings, setWarnings] = useState(0);
  const [camActive, setCamActive] = useState(false);
  const [faceStatus, setFaceStatus] = useState<"ok" | "none" | "multiple" | "unknown">("unknown");
  const [status, setStatus] = useState<string>("Initializing…");

  const pushEvent = useCallback(
    (type: ProctorEventType, detail?: string) => {
      queueRef.current.push({ type, detail, at: new Date().toISOString() });
      warningsRef.current += 1;
      setWarnings(warningsRef.current);
      onWarning?.(warningsRef.current);
    },
    [onWarning],
  );

  // Flush queued events to the backend on an interval.
  useEffect(() => {
    if (!enabled) return;
    const flush = async () => {
      if (!queueRef.current.length) return;
      const events = queueRef.current.splice(0, queueRef.current.length);
      try {
        await logProctorEvents({ session_id: sessionId, context, events });
      } catch {
        // Re-queue on failure so signals aren't lost.
        queueRef.current.unshift(...events);
      }
    };
    const interval = setInterval(flush, 8000);
    return () => {
      clearInterval(interval);
      void flush();
    };
  }, [enabled, sessionId, context]);

  // Tab/visibility + window blur detection (always available).
  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.hidden) pushEvent("tab_hidden", "Tab/app switched away during exam");
    };
    const onBlur = () => pushEvent("window_blur", "Exam window lost focus");
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled, pushEvent]);

  // Webcam + face detection.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let detectInterval: ReturnType<typeof setInterval> | null = null;

    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("Camera not available — monitoring tab activity only.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCamActive(true);

        if (typeof window.FaceDetector === "function") {
          const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 5 });
          setStatus("Face monitoring active.");
          detectInterval = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const faces = await detector.detect(videoRef.current);
              if (faces.length === 0) {
                setFaceStatus("none");
                pushEvent("no_face", "No face detected in frame");
              } else if (faces.length > 1) {
                setFaceStatus("multiple");
                pushEvent("multiple_faces", `${faces.length} faces detected`);
              } else {
                setFaceStatus("ok");
              }
            } catch {
              /* ignore transient detection errors */
            }
          }, 5000);
        } else {
          setStatus("Camera on. Face detection unsupported on this browser — tab activity is still monitored.");
        }
      } catch {
        setStatus("Camera permission denied — monitoring tab activity only.");
      }
    })();

    return () => {
      cancelled = true;
      if (detectInterval) clearInterval(detectInterval);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [enabled, pushEvent]);

  if (!enabled) return null;

  return (
    <div className="rounded-xl border border-border-default bg-surface p-3">
      <div className="flex items-center gap-3">
        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-surface-3">
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          {!camActive && (
            <span className="absolute inset-0 flex items-center justify-center text-subtle">
              <LuVideoOff className="h-5 w-5" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {warnings === 0 ? (
              <Badge variant="success">
                <LuShieldCheck className="h-3.5 w-3.5" /> Monitored
              </Badge>
            ) : (
              <Badge variant="warning">
                <LuShieldAlert className="h-3.5 w-3.5" /> {warnings} flag{warnings > 1 ? "s" : ""}
              </Badge>
            )}
            {faceStatus === "none" && <Badge variant="danger">No face</Badge>}
            {faceStatus === "multiple" && <Badge variant="danger">Multiple faces</Badge>}
          </div>
          <p className={cn("mt-1 truncate text-xs text-muted")}>{status}</p>
        </div>
      </div>
    </div>
  );
}

export default ProctorGuard;
