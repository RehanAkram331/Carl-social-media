"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  ImageIcon,
  Sparkles,
  MessageSquare,
  CheckCircle2,
  Share2,
  X,
  AlertCircle,
  Loader2,
  ArrowRight,
  Wand2,
  Send,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Stage =
  | "idle"
  | "submitting"
  | "editing_image"
  | "writing_copy"
  | "awaiting_approval"
  | "publishing"
  | "done"
  | "error";

interface WorkflowStatus {
  stage: Stage;
  message: string;
  editedImageUrl?: string;
  generatedCopy?: string;
  slackMessageTs?: string;
  postUrl?: string;
  error?: string;
}

// ─── Workflow stages metadata ─────────────────────────────────────────────────

const STAGES: { key: Stage; label: string; icon: React.ReactNode }[] = [
  { key: "submitting", label: "Uploading", icon: <Upload size={14} /> },
  { key: "editing_image", label: "AI Editing", icon: <Wand2 size={14} /> },
  { key: "writing_copy", label: "Writing Copy", icon: <Sparkles size={14} /> },
  {
    key: "awaiting_approval",
    label: "Slack Approval",
    icon: <MessageSquare size={14} />,
  },
  { key: "publishing", label: "Publishing", icon: <Share2 size={14} /> },
  { key: "done", label: "Live!", icon: <CheckCircle2 size={14} /> },
];

const STAGE_ORDER: Stage[] = [
  "submitting",
  "editing_image",
  "writing_copy",
  "awaiting_approval",
  "publishing",
  "done",
];

function stageIndex(s: Stage) {
  return STAGE_ORDER.indexOf(s);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<WorkflowStatus>({
    stage: "idle",
    message: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Image handling ──────────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    setImage(file);
    const url = URL.createObjectURL(file);
    setPreview(url);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!image || !description.trim()) return;

    setStatus({ stage: "submitting", message: "Uploading your image…" });

    const fd = new FormData();
    fd.append("image", image);
    fd.append("description", description);

    try {
      console.log("submitting",fd);
      const res = await fetch("/api/submit", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setStatus({
          stage: "error",
          message: "Submission failed",
          error: data.error || "Unknown error",
        });
        return;
      }

      // n8n can either return a final status directly OR a jobId to poll
      if (data.jobId) {
        startPolling(data.jobId);
      } else {
        // n8n returned final payload immediately
        applyN8nPayload(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setStatus({ stage: "error", message: "Network error", error: msg });
    }
  };

  // ── Polling (optional — only used if n8n returns a jobId) ───────────────────

  const startPolling = (jobId: string) => {
    setStatus({ stage: "editing_image", message: "AI is editing your image…" });

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/status/${jobId}`);
        if (!res.ok) return;
        const data = await res.json();
        applyN8nPayload(data);
        if (data.stage === "done" || data.stage === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // keep polling
      }
    }, 3000);
  };

  const applyN8nPayload = (data: Partial<WorkflowStatus> & { stage?: Stage }) => {
    setStatus((prev) => ({
      ...prev,
      ...data,
      stage: data.stage ?? prev.stage,
      message: data.message ?? prev.message,
    }));
  };

  // ── Reset ───────────────────────────────────────────────────────────────────

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setImage(null);
    setPreview(null);
    setDescription("");
    setStatus({ stage: "idle", message: "" });
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const isRunning =
    status.stage !== "idle" &&
    status.stage !== "done" &&
    status.stage !== "error";
  const isDone = status.stage === "done";
  const isError = status.stage === "error";
  const currentStageIdx = stageIndex(status.stage);

  return (
    <main className="min-h-screen flex flex-col items-center justify-start px-4 py-12 md:py-20">
      {/* ── Header ── */}
      <header className="w-full max-w-2xl mb-12 animate-slide-up">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <Share2 size={15} color="white" />
          </div>
          <span
            className="text-xs font-medium tracking-widest uppercase"
            style={{ color: "var(--muted)" }}
          >
            Social Post Studio
          </span>
        </div>
        <h1
          className="font-serif text-5xl md:text-6xl leading-tight"
          style={{ color: "var(--ink)" }}
        >
          From image to
          <br />
          <em>live post</em> in minutes.
        </h1>
        <p className="mt-3 text-base" style={{ color: "var(--muted)" }}>
          Upload an image, add context — and let the workflow handle the
          rest: AI editing, copywriting, Slack approval, and GHL publishing.
        </p>
      </header>

      {/* ── Card ── */}
      <section
        className="w-full max-w-2xl rounded-2xl border overflow-hidden animate-slide-up"
        style={{
          background: "white",
          borderColor: "var(--border)",
          animationDelay: "80ms",
          boxShadow: "0 4px 40px rgba(0,0,0,0.06)",
        }}
      >
        {/* ─ Stage progress bar ─ */}
        {isRunning && (
          <div
            className="border-b px-6 py-4"
            style={{ borderColor: "var(--border)", background: "var(--cream)" }}
          >
            <div className="flex items-center justify-between gap-2">
              {STAGES.map((s, i) => {
                const done = currentStageIdx > i;
                const active = currentStageIdx === i;
                return (
                  <div key={s.key} className="flex items-center gap-1.5 min-w-0">
                    <div
                      className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-300 shrink-0 ${
                        done
                          ? "text-white"
                          : active
                          ? "text-white"
                          : "text-gray-400"
                      }`}
                      style={{
                        background: done
                          ? "var(--success)"
                          : active
                          ? "var(--accent)"
                          : "var(--border)",
                      }}
                    >
                      {s.icon}
                    </div>
                    <span
                      className="text-xs hidden sm:block truncate"
                      style={{
                        color: active
                          ? "var(--ink)"
                          : done
                          ? "var(--success)"
                          : "var(--muted)",
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      {s.label}
                    </span>
                    {i < STAGES.length - 1 && (
                      <div
                        className="hidden sm:block flex-1 h-px mx-1"
                        style={{
                          background: done ? "var(--success)" : "var(--border)",
                          minWidth: 12,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <p
              className="mt-3 text-sm flex items-center gap-2"
              style={{ color: "var(--muted)" }}
            >
              <Loader2 size={14} className="animate-spin shrink-0" />
              {status.message}
            </p>
          </div>
        )}

        {/* ─ Success banner ─ */}
        {isDone && (
          <div
            className="border-b px-6 py-4 flex items-start gap-3"
            style={{
              borderColor: "#b7dfc9",
              background: "#f0faf4",
            }}
          >
            <CheckCircle2
              size={20}
              className="mt-0.5 shrink-0"
              style={{ color: "var(--success)" }}
            />
            <div className="flex-1">
              <p
                className="font-semibold text-sm"
                style={{ color: "var(--success)" }}
              >
                Post published successfully!
              </p>
              {status.postUrl && (
                <a
                  href={status.postUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm underline mt-0.5 inline-block"
                  style={{ color: "var(--success)" }}
                >
                  View live post →
                </a>
              )}
            </div>
          </div>
        )}

        {/* ─ Error banner ─ */}
        {isError && (
          <div
            className="border-b px-6 py-4 flex items-start gap-3"
            style={{
              borderColor: "#f5c6c0",
              background: "#fff5f3",
            }}
          >
            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0"
              style={{ color: "var(--accent)" }}
            />
            <div className="flex-1">
              <p
                className="font-semibold text-sm"
                style={{ color: "var(--accent)" }}
              >
                Something went wrong
              </p>
              <p className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>
                {status.error}
              </p>
            </div>
          </div>
        )}

        <div className="p-6 md:p-8 space-y-6">
          {/* ─ Drop zone ─ */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--ink)" }}
            >
              Image
            </label>

            {!preview ? (
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className="relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200"
                style={{
                  minHeight: 220,
                  borderColor: isDragging ? "var(--accent)" : "var(--border)",
                  background: isDragging ? "#fff8f6" : "var(--cream)",
                }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-200"
                  style={{
                    background: isDragging ? "var(--accent)" : "var(--border)",
                    transform: isDragging ? "scale(1.1)" : "scale(1)",
                  }}
                >
                  <ImageIcon
                    size={24}
                    color={isDragging ? "white" : "var(--muted)"}
                  />
                </div>
                <p
                  className="font-medium text-sm"
                  style={{ color: "var(--ink)" }}
                >
                  Drop your image here
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  or{" "}
                  <span style={{ color: "var(--accent)" }}>
                    click to browse
                  </span>{" "}
                  — JPG, PNG, WEBP
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full object-cover"
                  style={{ maxHeight: 320 }}
                />
                {/* Edited image overlay */}
                {status.editedImageUrl && (
                  <div className="absolute inset-0 flex flex-col">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={status.editedImageUrl}
                      alt="AI-edited preview"
                      className="w-full h-full object-cover"
                    />
                    <div
                      className="absolute top-3 left-3 text-xs font-medium px-2 py-1 rounded-full"
                      style={{ background: "var(--success)", color: "white" }}
                    >
                      ✦ AI Edited
                    </div>
                  </div>
                )}
                {!isRunning && !isDone && (
                  <button
                    onClick={reset}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center transition-opacity"
                    style={{ background: "rgba(0,0,0,0.6)" }}
                  >
                    <X size={14} color="white" />
                  </button>
                )}
                <div
                  className="absolute bottom-0 inset-x-0 px-3 py-2 text-xs"
                  style={{
                    background: "rgba(255,255,255,0.85)",
                    color: "var(--muted)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  {image?.name} · {(image ? image.size / 1024 : 0).toFixed(0)} KB
                </div>
              </div>
            )}
          </div>

          {/* ─ Description ─ */}
          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: "var(--ink)" }}
            >
              Context & brief
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isRunning || isDone}
              placeholder="Describe what this post is about, the tone you want, target audience, campaign goals, relevant hashtags…"
              rows={4}
              className="w-full rounded-xl border px-4 py-3 text-sm resize-none focus:outline-none transition-all duration-200"
              style={{
                borderColor: "var(--border)",
                background: isRunning || isDone ? "var(--cream)" : "white",
                color: "var(--ink)",
                lineHeight: 1.6,
              }}
            />
          </div>

          {/* ─ Generated copy preview ─ */}
          {status.generatedCopy && (
            <div
              className="rounded-xl border p-4 animate-slide-up"
              style={{
                borderColor: "#d4e8ff",
                background: "#f4f9ff",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} style={{ color: "#3b7dd8" }} />
                <span
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "#3b7dd8" }}
                >
                  AI-Generated Copy
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>
                {status.generatedCopy}
              </p>
            </div>
          )}

          {/* ─ Slack approval note ─ */}
          {status.stage === "awaiting_approval" && (
            <div
              className="rounded-xl border p-4 flex items-start gap-3 animate-slide-up"
              style={{
                borderColor: "#e8d9ff",
                background: "#faf5ff",
              }}
            >
              <MessageSquare
                size={18}
                className="mt-0.5 shrink-0"
                style={{ color: "#7c3aed" }}
              />
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "#7c3aed" }}
                >
                  Awaiting Slack approval
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                  A message was sent to your approval channel. Once approved
                  there, publishing will begin automatically.
                </p>
                {status.slackMessageTs && (
                  <p
                    className="text-xs mt-1 font-mono"
                    style={{ color: "var(--muted)" }}
                  >
                    Message ID: {status.slackMessageTs}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ─ Workflow diagram (idle state) ─ */}
          {status.stage === "idle" && (
            <div
              className="rounded-xl border p-4"
              style={{ borderColor: "var(--border)", background: "var(--cream)" }}
            >
              <p
                className="text-xs font-semibold uppercase tracking-wide mb-3"
                style={{ color: "var(--muted)" }}
              >
                What happens next
              </p>
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { icon: <Wand2 size={12} />, label: "AI edits image" },
                  { icon: <Sparkles size={12} />, label: "Writes copy" },
                  { icon: <MessageSquare size={12} />, label: "Slack approval" },
                  { icon: <Share2 size={12} />, label: "Posts via GHL" },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium"
                      style={{
                        background: "white",
                        color: "var(--ink)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <span style={{ color: "var(--accent)" }}>{step.icon}</span>
                      {step.label}
                    </div>
                    {i < 3 && (
                      <ArrowRight size={12} style={{ color: "var(--border)" }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─ Action buttons ─ */}
          <div className="flex gap-3">
            {(isDone || isError) && (
              <button
                onClick={reset}
                className="flex-1 px-5 py-3 rounded-xl border text-sm font-medium transition-all duration-200 hover:opacity-80"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--muted)",
                  background: "white",
                }}
              >
                Start over
              </button>
            )}

            {!isDone && !isRunning && (
              <button
                onClick={handleSubmit}
                disabled={!image || !description.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{
                  background:
                    !image || !description.trim()
                      ? "var(--border)"
                      : "var(--accent)",
                  color:
                    !image || !description.trim() ? "var(--muted)" : "white",
                  cursor:
                    !image || !description.trim() ? "not-allowed" : "pointer",
                }}
              >
                <Send size={15} />
                {isError ? "Retry" : "Launch workflow"}
              </button>
            )}

            {isRunning && (
              <button
                disabled
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold"
                style={{ background: "var(--border)", color: "var(--muted)" }}
              >
                <Loader2 size={15} className="animate-spin" />
                Working…
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-10 text-xs" style={{ color: "var(--muted)" }}>
        Powered by n8n · Slack · GHL
      </footer>
    </main>
  );
}
