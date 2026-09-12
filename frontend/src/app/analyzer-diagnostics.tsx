"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { normalizeDiagnosticError, sanitizeDiagnosticText } from "./diagnostic-utils";

export type AnalyzerStage =
  | "idle"
  | "url-parsing"
  | "platform-detection"
  | "capability-check"
  | "request-start"
  | "request-waiting"
  | "response-parsing"
  | "rendering-result"
  | "download-preparation";

type DiagnosticState = {
  stage: AnalyzerStage;
  platform: string;
  urlType: string;
  requestStarted: boolean;
  responseStatus: string;
  lastError: string;
  errorName: string;
  errorMessage: string;
  stack: string;
  unhandledRejection: string;
};

type DiagnosticContextValue = {
  enabled: boolean;
  setStage: (stage: AnalyzerStage) => void;
  setUrlContext: (platform: string, urlType: string) => void;
  markRequestStarted: () => void;
  setResponseStatus: (status: number | string) => void;
  captureError: (error: unknown, source?: string) => void;
  resetAttempt: () => void;
};

const initialState: DiagnosticState = {
  stage: "idle",
  platform: "not detected",
  urlType: "not detected",
  requestStarted: false,
  responseStatus: "not received",
  lastError: "none",
  errorName: "none",
  errorMessage: "none",
  stack: "none",
  unhandledRejection: "none",
};

const noOp = () => undefined;
const subscribeToLocation = () => noOp;
const DiagnosticsContext = createContext<DiagnosticContextValue>({
  enabled: false,
  setStage: noOp,
  setUrlContext: noOp,
  markRequestStarted: noOp,
  setResponseStatus: noOp,
  captureError: noOp,
  resetAttempt: noOp,
});

function DiagnosticsPanel({ state }: { state: DiagnosticState }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const build = process.env.NEXT_PUBLIC_BUILD_COMMIT || "local-development";
  const browser = typeof navigator === "undefined" ? "unavailable" : navigator.userAgent;
  const viewport = typeof window === "undefined" ? "unavailable" : `${window.innerWidth} × ${window.innerHeight}`;
  const online = typeof navigator === "undefined" ? "unknown" : String(navigator.onLine);
  const report = [
    `Build: ${build}`,
    `Browser: ${browser}`,
    `Viewport: ${viewport}`,
    `Online: ${online}`,
    `Platform detected: ${state.platform}`,
    `URL type: ${state.urlType}`,
    `Analyzer stage: ${state.stage}`,
    `API request started: ${state.requestStarted}`,
    `API response status: ${state.responseStatus}`,
    `Last error: ${state.lastError}`,
    `Error name: ${state.errorName}`,
    `Error message: ${state.errorMessage}`,
    `Stack: ${state.stack}`,
    `Unhandled rejection: ${state.unhandledRejection}`,
  ].map((line) => sanitizeDiagnosticText(line)).join("\n");
  const canCopy = typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function";

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(report);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <details className="mx-auto mt-5 max-w-4xl rounded-xl border border-cyan-300/20 bg-[#07101d] p-3 text-left text-xs text-white/70">
      <summary className="cursor-pointer font-semibold text-cyan-200">Vidorac Diagnostics</summary>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 font-mono leading-5 selection:bg-cyan-300/25">{report}</pre>
      {canCopy && (
        <button type="button" onClick={copyReport} className="analysis-retry-button mt-3">
          {copyState === "copied" ? "Diagnostic report copied" : "Copy diagnostic report"}
        </button>
      )}
      {copyState === "failed" && <p className="mt-2 text-white/50">Clipboard access failed. Select and copy the report above.</p>}
    </details>
  );
}

export function AnalyzerDiagnosticsProvider({ children }: { children: ReactNode }) {
  const enabled = useSyncExternalStore(
    subscribeToLocation,
    () => new URLSearchParams(window.location.search).get("debug") === "1",
    () => false,
  );
  const [state, setState] = useState(initialState);

  const setStage = useCallback((stage: AnalyzerStage) => {
    if (enabled) setState((current) => ({ ...current, stage }));
  }, [enabled]);
  const setUrlContext = useCallback((platform: string, urlType: string) => {
    if (enabled) setState((current) => ({ ...current, platform, urlType }));
  }, [enabled]);
  const markRequestStarted = useCallback(() => {
    if (enabled) setState((current) => ({ ...current, requestStarted: true, responseStatus: "waiting" }));
  }, [enabled]);
  const setResponseStatus = useCallback((status: number | string) => {
    if (enabled) setState((current) => ({ ...current, responseStatus: String(status) }));
  }, [enabled]);
  const captureError = useCallback((error: unknown, source = "analyzer") => {
    if (!enabled) return;
    const normalized = normalizeDiagnosticError(error);
    setState((current) => ({
      ...current,
      lastError: source,
      errorName: sanitizeDiagnosticText(normalized.name, 120),
      errorMessage: sanitizeDiagnosticText(normalized.message),
      stack: sanitizeDiagnosticText(normalized.stack),
      unhandledRejection: source === "unhandledrejection" ? sanitizeDiagnosticText(normalized.message) : current.unhandledRejection,
    }));
  }, [enabled]);
  const resetAttempt = useCallback(() => {
    if (enabled) setState(initialState);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onError = (event: ErrorEvent) => captureError(event.error ?? event.message, "window.onerror");
    const onUnhandledRejection = (event: PromiseRejectionEvent) => captureError(event.reason, "unhandledrejection");
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, [captureError, enabled]);

  const value = useMemo(() => ({ enabled, setStage, setUrlContext, markRequestStarted, setResponseStatus, captureError, resetAttempt }), [captureError, enabled, markRequestStarted, resetAttempt, setResponseStatus, setStage, setUrlContext]);
  return <DiagnosticsContext.Provider value={value}>{children}{enabled && <DiagnosticsPanel state={state} />}</DiagnosticsContext.Provider>;
}

export function useAnalyzerDiagnostics(): DiagnosticContextValue {
  return useContext(DiagnosticsContext);
}
