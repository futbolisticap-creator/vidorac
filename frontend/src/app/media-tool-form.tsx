"use client";

import { DragEvent, FormEvent, useRef, useState } from "react";
import { API_BASE_URL } from "./api-config";

const MAX_FILE_SIZE = 1024 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ["mp4", "mov", "mkv", "webm", "avi", "m4v"];

export type ToolMode = "compress" | "convert" | "trim";
type Stage = "idle" | "selected" | "uploading" | "processing" | "success" | "error";

type ToolSuccess = {
  success: true;
  download_id: string;
  filename: string;
  content_type: string;
  original_size: number;
  output_size: number;
  saved_bytes?: number;
  saved_percent?: number;
  duration?: number;
  format?: string;
};

type ToolError = { success: false; detail: string };

const modeCopy = {
  compress: { endpoint: "compress", button: "Compress Video" },
  convert: { endpoint: "convert", button: "Convert" },
  trim: { endpoint: "trim", button: "Trim Video" },
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

function parseTime(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":");
  if (parts.length > 3 || parts.some((part) => part === "" || !Number.isFinite(Number(part)))) return null;
  const numbers = parts.map(Number);
  if (numbers.some((part) => part < 0)) return null;
  if (numbers.length === 1) return numbers[0];
  if (numbers.slice(1).some((part) => part >= 60)) return null;
  return numbers.reduce((total, part) => total * 60 + part, 0);
}

function triggerNativeDownload(result: ToolSuccess) {
  const anchor = document.createElement("a");
  anchor.href = `${API_BASE_URL}/api/download/${encodeURIComponent(result.download_id)}`;
  anchor.download = result.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export default function MediaToolForm({ mode }: { mode: ToolMode }) {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ToolSuccess | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [compression, setCompression] = useState("balanced");
  const [conversion, setConversion] = useState("mp4");
  const [start, setStart] = useState("00:00:05");
  const [end, setEnd] = useState("00:00:10");
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = stage === "uploading" || stage === "processing";

  function chooseFile(candidate: File | null) {
    if (!candidate) return;
    const extension = candidate.name.split(".").pop()?.toLowerCase();
    if (!extension || !ACCEPTED_EXTENSIONS.includes(extension)) {
      setError("Choose an MP4, MOV, MKV, WEBM, AVI or M4V video.");
      setStage("error");
      return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setError("This file exceeds Vidorac's 1 GB limit.");
      setStage("error");
      return;
    }
    setFile(candidate);
    setError(null);
    setResult(null);
    setStage("selected");
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (!busy) chooseFile(event.dataTransfer.files.item(0));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy) return;

    const formData = new FormData();
    formData.append("file", file);
    if (mode === "compress") formData.append("quality", compression);
    if (mode === "convert") formData.append("format", conversion);
    if (mode === "trim") {
      const startSeconds = parseTime(start);
      const endSeconds = parseTime(end);
      if (startSeconds === null || endSeconds === null || endSeconds <= startSeconds) {
        setError("Enter a valid start and end time.");
        setStage("error");
        return;
      }
      formData.append("start", String(startSeconds));
      formData.append("end", String(endSeconds));
    }

    setError(null);
    setResult(null);
    setStage("uploading");
    const processingTimer = window.setTimeout(() => setStage("processing"), 700);

    try {
      const response = await fetch(`${API_BASE_URL}/api/tools/${modeCopy[mode].endpoint}`, {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as ToolSuccess | ToolError;
      if (!response.ok || !data.success) {
        throw new Error("detail" in data ? data.detail : "Vidorac could not process this video.");
      }
      setResult(data);
      setStage("success");
      triggerNativeDownload(data);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Vidorac could not process this video.");
      setStage("error");
    } finally {
      window.clearTimeout(processingTimer);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="tool-card mx-auto mt-10 max-w-3xl rounded-3xl border border-white/[0.09] bg-[#0d111d]/90 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:p-7">
      <div
        onDragEnter={(event) => { event.preventDefault(); if (!busy) setIsDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false); }}
        onDrop={handleDrop}
        className={`relative flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-9 text-center transition ${isDragging ? "border-[#49baff] bg-[#1682ff]/12" : file ? "border-[#298eff]/30 bg-[#1682ff]/[0.06]" : "border-white/[0.13] bg-white/[0.025] hover:border-[#298eff]/35 hover:bg-[#1682ff]/[0.045]"}`}
      >
        <input
          ref={inputRef}
          id={`${mode}-file`}
          type="file"
          accept="video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v"
          disabled={busy}
          onChange={(event) => chooseFile(event.target.files?.item(0) ?? null)}
          className="sr-only"
        />
        <div className="flex size-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.045] text-[#73ccff]">
          <svg aria-hidden="true" className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
          </svg>
        </div>
        {file ? (
          <>
            <p className="mt-4 max-w-full truncate text-base font-semibold text-white/90">{file.name}</p>
            <p className="mt-1 text-sm text-white/40">{formatBytes(file.size)}</p>
            <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="mt-4 text-sm font-medium text-[#75caff] hover:text-[#a4deff] disabled:opacity-40">Choose another file</button>
          </>
        ) : (
          <>
            <p className="mt-4 text-lg font-semibold">Drag &amp; drop your video</p>
            <p className="mt-1 text-sm text-white/35">MP4, MOV, MKV, WEBM, AVI or M4V · Up to 1 GB</p>
            <button type="button" onClick={() => inputRef.current?.click()} className="mt-5 rounded-xl border border-[#258cff]/30 bg-[#1682ff]/10 px-4 py-2.5 text-sm font-semibold text-[#8dd7ff] transition hover:bg-[#1682ff]/20">Choose file</button>
          </>
        )}
      </div>

      <div className="mt-6 border-t border-white/[0.07] pt-6">
        {mode === "compress" && (
          <fieldset disabled={busy}>
            <legend className="text-sm font-semibold text-white/80">Compression level</legend>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[{ value: "light", label: "Light", note: "Best quality" }, { value: "balanced", label: "Balanced", note: "Recommended" }, { value: "strong", label: "Strong", note: "Smallest size" }].map((option) => (
                <label key={option.value} className={`cursor-pointer rounded-xl border p-3 text-center transition ${compression === option.value ? "border-[#2f9cff]/40 bg-[#1682ff]/15 text-[#a7e0ff]" : "border-white/[0.08] bg-white/[0.025] text-white/55 hover:border-white/15"}`}>
                  <input type="radio" name="compression" value={option.value} checked={compression === option.value} onChange={() => setCompression(option.value)} className="sr-only" />
                  <span className="block text-sm font-semibold">{option.label}</span>
                  <span className="mt-1 block text-xs font-normal text-white/30">{option.note}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {mode === "convert" && (
          <fieldset disabled={busy}>
            <legend className="text-sm font-semibold text-white/80">Convert to</legend>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {["mp4", "webm", "mp3"].map((format) => (
                <label key={format} className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-semibold uppercase transition ${conversion === format ? "border-[#2f9cff]/40 bg-[#1682ff]/15 text-[#a7e0ff]" : "border-white/[0.08] bg-white/[0.025] text-white/55 hover:border-white/15"}`}>
                  <input type="radio" name="conversion" value={format} checked={conversion === format} onChange={() => setConversion(format)} className="sr-only" />
                  {format}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {mode === "trim" && (
          <fieldset disabled={busy}>
            <legend className="text-sm font-semibold text-white/80">Clip range</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-white/50">Start
                <input value={start} onChange={(event) => setStart(event.target.value)} inputMode="decimal" placeholder="00:00:05" className="mt-2 w-full rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 py-3 text-base text-white outline-none transition placeholder:text-white/20 focus:border-[#2f9cff]/40" />
              </label>
              <label className="text-sm text-white/50">End
                <input value={end} onChange={(event) => setEnd(event.target.value)} inputMode="decimal" placeholder="00:00:10" className="mt-2 w-full rounded-xl border border-white/[0.09] bg-white/[0.035] px-4 py-3 text-base text-white outline-none transition placeholder:text-white/20 focus:border-[#2f9cff]/40" />
              </label>
            </div>
            <p className="mt-2 text-xs text-white/30">Use seconds or HH:MM:SS. Vidorac checks the real duration securely.</p>
          </fieldset>
        )}

        <button type="submit" disabled={!file || busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1478ff] to-[#1e56f5] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(20,120,255,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100">
          {busy && <span className="size-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />}
          {stage === "uploading" ? "Uploading..." : stage === "processing" ? "Processing..." : modeCopy[mode].button}
        </button>

        <div className="mt-4 min-h-6" aria-live="polite" aria-atomic="true">
          {busy && <p className="text-center text-sm text-[#7acfff]/70">{stage === "uploading" ? "Uploading your video securely..." : "Processing with FFmpeg. Keep this page open."}</p>}
          {error && stage === "error" && <p className="rounded-xl border border-red-400/15 bg-red-400/[0.06] px-4 py-3 text-sm text-red-300/90">{error}</p>}
          {result && stage === "success" && (
            <div className="result-card rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.055] p-4">
              <p className="font-semibold text-emerald-200">{mode === "compress" ? "Compression complete" : mode === "convert" ? "Conversion complete" : "Trim complete"}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <span><span className="block text-white/35">Original</span>{formatBytes(result.original_size)}</span>
                <span><span className="block text-white/35">Output</span>{formatBytes(result.output_size)}</span>
                {mode === "compress" && result.saved_percent !== undefined && <span><span className="block text-white/35">Saved</span>{result.saved_percent > 0 ? `${result.saved_percent}%` : "No reduction"}</span>}
                {mode === "trim" && result.duration !== undefined && <span><span className="block text-white/35">Duration</span>{result.duration.toFixed(1)}s</span>}
              </div>
              <p className="mt-3 text-xs text-emerald-200/55">Your download started automatically.</p>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
