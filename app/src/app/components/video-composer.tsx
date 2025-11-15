"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CTA_SCENE,
  INTRO_SCENE,
  RESOLUTION_SCENES,
  TOTAL_DURATION_SECONDS,
  type ResolutionScene,
} from "../data/resolutions";

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

type Scene =
  | {
      type: "intro";
      duration: number;
    }
  | (ResolutionScene & { type: "resolution" })
  | {
      type: "cta";
      duration: number;
    };

type TimelineScene = Scene & {
  start: number;
  end: number;
};

const SCENES: Scene[] = [
  { type: "intro", duration: INTRO_SCENE.duration },
  ...RESOLUTION_SCENES.map((scene) => ({ ...scene, type: "resolution" as const })),
  { type: "cta", duration: CTA_SCENE.duration },
];

const TIMELINE: TimelineScene[] = (() => {
  let cursor = 0;
  return SCENES.map((scene) => {
    const start = cursor;
    const end = cursor + scene.duration;
    cursor = end;
    return { ...scene, start, end };
  });
})();

const TOTAL_DURATION_MS = TOTAL_DURATION_SECONDS * 1000;

export function VideoComposer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const progressAtPauseRef = useRef(0);

  const [progressMs, setProgressMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const totalDurationMs = useMemo(() => TOTAL_DURATION_MS, []);

  const supportsRecording = useMemo(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return false;
    }
    const canvas = document.createElement("canvas");
    const hasCapture = typeof canvas.captureStream === "function";
    return (
      typeof window.MediaRecorder !== "undefined" &&
      typeof HTMLCanvasElement !== "undefined" &&
      hasCapture
    );
  }, []);

  const renderFrame = useCallback(
    (ms: number) => {
      const ctx = contextRef.current;
      const canvas = canvasRef.current;
      if (!ctx || !canvas) {
        return;
      }
      const seconds = ms / 1000;
      const globalProgress = seconds / TOTAL_DURATION_SECONDS;
      const timelineScene =
        TIMELINE.find((scene) => seconds >= scene.start && seconds < scene.end) ??
        TIMELINE[TIMELINE.length - 1];
      const localSeconds = Math.min(
        timelineScene.end - timelineScene.start,
        Math.max(0, seconds - timelineScene.start),
      );
      const localProgress =
        timelineScene.end === timelineScene.start
          ? 0
          : localSeconds / (timelineScene.end - timelineScene.start);

      switch (timelineScene.type) {
        case "intro":
          drawIntro(ctx, localProgress);
          break;
        case "resolution":
          drawResolution(ctx, timelineScene, localProgress);
          break;
        case "cta":
          drawCta(ctx, localProgress);
          break;
      }

      drawTimelineOverlay(ctx, globalProgress, seconds);
    },
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    const dpr = window.devicePixelRatio ?? 1;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    canvas.style.width = `${CANVAS_WIDTH}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;
    context.scale(dpr, dpr);
    contextRef.current = context;
    renderFrame(0);
  }, [renderFrame]);

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      return;
    }

    function tick(now: number) {
      if (startTimeRef.current === null) {
        startTimeRef.current = now - progressAtPauseRef.current;
      }
      const elapsed = now - startTimeRef.current;
      const clamped = Math.min(elapsed, totalDurationMs);
      setProgressMs(clamped);
      renderFrame(clamped);

      if (clamped >= totalDurationMs) {
        setIsPlaying(false);
        if (
          recorderRef.current &&
          recorderRef.current.state === "recording"
        ) {
          recorderRef.current.stop();
        }
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isPlaying, totalDurationMs, renderFrame]);

  useEffect(() => {
    if (!isPlaying) {
      progressAtPauseRef.current = progressMs;
    }
  }, [isPlaying, progressMs]);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [recordedUrl]);

  const currentScene = useMemo(() => {
    const seconds = progressMs / 1000;
    return (
      TIMELINE.find((scene) => seconds >= scene.start && seconds < scene.end) ??
      TIMELINE[TIMELINE.length - 1]
    );
  }, [progressMs]);

  function handlePlay() {
    if (isRecording) {
      return;
    }
    if (progressMs >= totalDurationMs) {
      setProgressMs(0);
      progressAtPauseRef.current = 0;
    }
    setIsPlaying(true);
    startTimeRef.current = null;
  }

  function handlePause() {
    setIsPlaying(false);
  }

  function handleReset() {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    setIsPlaying(false);
    setIsRecording(false);
    setProgressMs(0);
    progressAtPauseRef.current = 0;
    startTimeRef.current = null;
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    renderFrame(0);
  }

  function handleRecord() {
    if (!supportsRecording || isRecording) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const stream = canvas.captureStream(30);
    const options: MediaRecorderOptions = {
      mimeType: selectMimeType(),
      videoBitsPerSecond: 6_000_000,
    };
    const recorder = new MediaRecorder(stream, options);
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);
      setIsRecording(false);
      setIsPlaying(false);
      setProgressMs(totalDurationMs);
      progressAtPauseRef.current = totalDurationMs;
      chunksRef.current = [];
    };

    setRecordedUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });

    recorderRef.current = recorder;
    setIsRecording(true);
    setProgressMs(0);
    progressAtPauseRef.current = 0;
    startTimeRef.current = null;
    setIsPlaying(true);
    recorder.start();
  }

  const progressRatio = Math.min(1, progressMs / totalDurationMs);
  const formattedProgress = formatTime(progressMs / 1000);
  const formattedTotal = formatTime(TOTAL_DURATION_SECONDS);

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/60 bg-slate-900/40 shadow-2xl shadow-slate-900/40 backdrop-blur">
        <canvas
          ref={canvasRef}
          className="block h-auto w-full"
          aria-label="Tech resolutions video canvas"
        />
        {isRecording ? (
          <div className="pointer-events-none absolute right-6 top-6 flex items-center gap-2 rounded-full bg-rose-500/90 px-4 py-1 text-sm font-semibold text-white shadow-lg">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            Recording
          </div>
        ) : null}
        {recordedUrl ? (
          <div className="absolute inset-x-0 bottom-6 flex justify-center">
            <a
              href={recordedUrl}
              download="tech-resolutions-2025.webm"
              className="rounded-full bg-emerald-500 px-6 py-2 text-sm font-semibold text-emerald-50 shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-400"
            >
              Download render
            </a>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800/50 bg-slate-900/60 p-5 shadow-inner shadow-black/30 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 p-[2px]">
            <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-slate-950">
              <span className="text-lg font-semibold text-sky-400">
                {(currentScene.type === "resolution"
                  ? RESOLUTION_SCENES.findIndex(
                      (scene) => scene.id === currentScene.id,
                    ) + 1
                  : 0
                )
                  .toString()
                  .padStart(2, "0")}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">
              Now Showing
            </p>
            <p className="text-lg font-semibold text-slate-50">
              {getSceneLabel(currentScene)}
            </p>
            <p className="text-sm text-slate-400">
              {formattedProgress} / {formattedTotal}
            </p>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 md:max-w-xl md:flex-row md:items-center md:gap-6">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-150"
              style={{ width: `${progressRatio * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-3">
            {!isPlaying ? (
              <button
                type="button"
                onClick={handlePlay}
                className="rounded-full bg-sky-500 px-5 py-2 text-sm font-semibold text-sky-950 shadow-lg shadow-sky-500/40 transition hover:bg-sky-400"
              >
                {progressMs > 0 ? "Resume" : "Play preview"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePause}
                className="rounded-full bg-slate-800 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
              >
                Pause
              </button>
            )}
            <button
              type="button"
              onClick={handleReset}
              className="rounded-full border border-slate-700 px-5 py-2 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleRecord}
              disabled={!supportsRecording || isRecording}
              className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {supportsRecording ? "Render video" : "Recording unavailable"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function drawIntro(ctx: CanvasRenderingContext2D, progress: number) {
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  gradient.addColorStop(0, INTRO_SCENE.gradient[0]);
  gradient.addColorStop(1, INTRO_SCENE.gradient[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.45;
  drawOrb(ctx, CANVAS_WIDTH * 0.28, CANVAS_HEIGHT * 0.42, 160, progress, INTRO_SCENE.accent);
  drawOrb(ctx, CANVAS_WIDTH * 0.72, CANVAS_HEIGHT * 0.62, 210, progress * 0.7, "#60a5fa");
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 12; i += 1) {
    const width = CANVAS_WIDTH * 0.04;
    const height = CANVAS_HEIGHT * (0.14 + i * 0.003);
    const x =
      ((i + progress * 2) % 12) * (CANVAS_WIDTH / 12) -
      width +
      Math.sin(progress * Math.PI * 2 + i) * 12;
    const y = CANVAS_HEIGHT * 0.12 + i * 12;
    ctx.fillRect(x, y, width, height);
  }

  ctx.fillStyle = "rgba(148, 163, 184, 0.3)";
  ctx.fillRect(
    CANVAS_WIDTH * 0.14,
    CANVAS_HEIGHT * 0.7,
    CANVAS_WIDTH * 0.72,
    2,
  );

  ctx.fillStyle = "#e2e8f0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 72px \"Geist\", \"Inter\", \"Segoe UI\", sans-serif";
  ctx.fillText(INTRO_SCENE.title, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.36);

  ctx.font = "500 30px \"Geist\", \"Inter\", \"Segoe UI\", sans-serif";
  ctx.fillStyle = "#94a3b8";
  drawWrappedText(
    ctx,
    INTRO_SCENE.subtitle,
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT * 0.47,
    CANVAS_WIDTH * 0.62,
    42,
    "center",
  );

  ctx.font = "600 36px \"Geist\", \"Inter\", \"Segoe UI\", sans-serif";
  ctx.fillStyle = INTRO_SCENE.accent;
  ctx.fillText(INTRO_SCENE.tagline, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.6);
}

function drawResolution(
  ctx: CanvasRenderingContext2D,
  scene: ResolutionScene,
  progress: number,
) {
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  gradient.addColorStop(0, scene.gradient[0]);
  gradient.addColorStop(1, scene.gradient[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  drawMotionGrid(ctx, progress, scene.accent);

  ctx.save();
  ctx.translate(CANVAS_WIDTH * 0.09, CANVAS_HEIGHT * 0.16);
  ctx.fillStyle = "rgba(226, 232, 240, 0.96)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "700 64px \"Geist\", \"Inter\", \"Segoe UI\", sans-serif";
  ctx.fillText(scene.title, 0, 0);

  ctx.font = "500 28px \"Geist\", \"Inter\", \"Segoe UI\", sans-serif";
  ctx.fillStyle = "rgba(226, 232, 240, 0.8)";
  drawWrappedText(ctx, scene.subtitle, 0, 92, CANVAS_WIDTH * 0.42, 38, "left");

  ctx.font = "500 26px \"Geist\", \"Inter\", \"Segoe UI\", sans-serif";
  scene.bullets.forEach((bullet, index) => {
    const appear = easeInOutCubic(
      Math.min(1, Math.max(0, progress * 1.4 - index * 0.2)),
    );
    if (appear <= 0) {
      return;
    }
    ctx.globalAlpha = appear;
    drawWrappedText(
      ctx,
      `• ${bullet}`,
      0,
      170 + index * 74,
      CANVAS_WIDTH * 0.48,
      38,
      "left",
    );
    ctx.globalAlpha = 1;
  });
  ctx.restore();

  drawMetricCard(ctx, scene, progress);
}

function drawCta(ctx: CanvasRenderingContext2D, progress: number) {
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  gradient.addColorStop(0, CTA_SCENE.gradient[0]);
  gradient.addColorStop(1, CTA_SCENE.gradient[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 4; i += 1) {
    const offset = progress * 60;
    ctx.fillStyle = i % 2 === 0 ? CTA_SCENE.accent : "#4f46e5";
    roundedRect(
      ctx,
      CANVAS_WIDTH * (0.12 + i * 0.18) - offset,
      CANVAS_HEIGHT * 0.18 + i * 36,
      CANVAS_WIDTH * 0.22,
      CANVAS_HEIGHT * 0.68,
      28,
    );
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.translate(CANVAS_WIDTH * 0.1, CANVAS_HEIGHT * 0.2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "700 68px \"Geist\", \"Inter\", \"Segoe UI\", sans-serif";
  ctx.fillText(CTA_SCENE.title, 0, 0);

  ctx.font = "500 32px \"Geist\", \"Inter\", \"Segoe UI\", sans-serif";
  ctx.fillStyle = "rgba(226, 232, 240, 0.86)";
  drawWrappedText(
    ctx,
    CTA_SCENE.subtitle,
    0,
    96,
    CANVAS_WIDTH * 0.42,
    44,
    "left",
  );

  ctx.font = "500 28px \"Geist\", \"Inter\", \"Segoe UI\", sans-serif";
  CTA_SCENE.bullets.forEach((bullet, index) => {
    const appear = easeInOutCubic(
      Math.min(1, Math.max(0, progress * 1.8 - index * 0.25)),
    );
    if (appear <= 0) {
      return;
    }
    ctx.globalAlpha = appear;
    drawWrappedText(
      ctx,
      `• ${bullet}`,
      0,
      176 + index * 64,
      CANVAS_WIDTH * 0.44,
      40,
      "left",
    );
    ctx.globalAlpha = 1;
  });
  ctx.restore();

  ctx.fillStyle = CTA_SCENE.accent;
  ctx.font = "600 36px \"Geist\", \"Inter\", \"Segoe UI\", sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    CTA_SCENE.action,
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT * (0.76 + 0.08 * Math.sin(progress * Math.PI)),
  );
}

function drawTimelineOverlay(
  ctx: CanvasRenderingContext2D,
  globalProgress: number,
  seconds: number,
) {
  const trackWidth = CANVAS_WIDTH * 0.7;
  const trackX = (CANVAS_WIDTH - trackWidth) / 2;
  const trackY = CANVAS_HEIGHT - 84;
  const trackHeight = 12;

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
  roundedRect(
    ctx,
    trackX - 18,
    trackY - 28,
    trackWidth + 36,
    trackHeight + 80,
    24,
  );
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(71, 85, 105, 0.6)";
  ctx.fillRect(trackX, trackY, trackWidth, trackHeight);

  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(trackX, trackY, trackWidth * globalProgress, trackHeight);

  ctx.fillStyle = "rgba(226, 232, 240, 0.45)";
  TIMELINE.forEach((scene, index) => {
    const markerX = trackX + (scene.start / TOTAL_DURATION_SECONDS) * trackWidth;
    ctx.fillRect(markerX, trackY - 10, 2, trackHeight + 20);
    if (scene.type === "resolution") {
      ctx.font = "500 18px \"Geist\", \"Inter\", \"Segoe UI\", sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = "rgba(203, 213, 225, 0.7)";
      ctx.fillText(
        index.toString().padStart(2, "0"),
        markerX + 20,
        trackY - 12,
      );
    }
  });

  ctx.font = "600 24px \"Geist\", \"Inter\", \"Segoe UI\", sans-serif";
  ctx.fillStyle = "rgba(226, 232, 240, 0.8)";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(formatTime(seconds), trackX + trackWidth, trackY + trackHeight + 36);
}

function drawMotionGrid(
  ctx: CanvasRenderingContext2D,
  progress: number,
  accent: string,
) {
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  const cell = 120;
  const offset = (progress * 60) % cell;
  for (let x = -cell * 2; x < CANVAS_WIDTH + cell * 2; x += cell) {
    ctx.beginPath();
    ctx.moveTo(x + offset, 0);
    ctx.lineTo(x + offset, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let y = -cell; y < CANVAS_HEIGHT + cell; y += cell) {
    ctx.beginPath();
    ctx.moveTo(0, y + offset);
    ctx.lineTo(CANVAS_WIDTH, y + offset);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMetricCard(
  ctx: CanvasRenderingContext2D,
  scene: ResolutionScene,
  progress: number,
) {
  const width = CANVAS_WIDTH * 0.26;
  const height = CANVAS_HEIGHT * 0.48;
  const x = CANVAS_WIDTH - width - CANVAS_WIDTH * 0.1;
  const y = CANVAS_HEIGHT * 0.2;
  const appear = easeInOutCubic(Math.min(1, progress * 1.3));

  ctx.save();
  ctx.globalAlpha = 0.75 * appear;
  ctx.fillStyle = "rgba(15, 23, 42, 0.72)";
  roundedRect(ctx, x, y, width, height, 32);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = `${scene.accent}CC`;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = appear;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  ctx.font = "500 18px \"Geist\", \"Inter\", \"Segoe UI\", sans-serif";
  ctx.fillStyle = "rgba(148, 163, 184, 0.9)";
  ctx.fillText(scene.metric.label.toUpperCase(), x + width / 2, y + 36);

  ctx.font = "700 72px \"Geist\", \"Inter\", \"Segoe UI\", sans-serif";
  ctx.fillStyle = scene.accent;
  ctx.fillText(scene.metric.value, x + width / 2, y + 80);

  ctx.font = "500 22px \"Geist\", \"Inter\", \"Segoe UI\", sans-serif";
  ctx.fillStyle = "rgba(226, 232, 240, 0.85)";
  drawWrappedText(
    ctx,
    scene.metric.caption,
    x + width / 2,
    y + 172,
    width * 0.78,
    32,
    "center",
  );

  ctx.font = "500 18px \"Geist\", \"Inter\", \"Segoe UI\", sans-serif";
  ctx.fillStyle = "rgba(148, 163, 184, 0.8)";
  ctx.fillText("Momentum Meter", x + width / 2, y + height - 60);

  const barWidth = width * 0.72;
  const barHeight = 10;
  const barX = x + (width - barWidth) / 2;
  const barY = y + height - 34;
  ctx.fillStyle = "rgba(71, 85, 105, 0.6)";
  ctx.fillRect(barX, barY, barWidth, barHeight);
  ctx.fillStyle = scene.accent;
  ctx.fillRect(barX, barY, barWidth * Math.min(1, 0.5 + progress * 0.5), barHeight);
  ctx.restore();
}

function drawOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  baseRadius: number,
  progress: number,
  color: string,
) {
  const radius = baseRadius * (0.85 + Math.sin(progress * Math.PI * 2) * 0.1);
  const gradient = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
  gradient.addColorStop(0, `${color}CC`);
  gradient.addColorStop(1, `${color}00`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  align: CanvasTextAlign,
) {
  const words = text.split(" ");
  let line = "";
  const lines: string[] = [];

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;
    if (testWidth > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  });
  if (line) {
    lines.push(line);
  }

  ctx.textAlign = align;

  lines.forEach((content, index) => {
    ctx.fillText(content, x, y + index * lineHeight);
  });
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function formatTime(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const secs = (total % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function getSceneLabel(scene: TimelineScene) {
  switch (scene.type) {
    case "intro":
      return "Intro • North Star";
    case "cta":
      return "Call to Action • Momentum";
    default:
      return `${scene.title}`;
  }
}

function selectMimeType() {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "video/webm";
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
