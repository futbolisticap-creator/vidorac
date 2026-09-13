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
import { API_BASE_URL } from "./api-config";
import { normalizeDiagnosticError, sanitizeDiagnosticText } from "./diagnostic-utils";

export type AnalyzerStage =
  | "idle"
  | "url-parsing"
  | "platform-detection"
  | "capability-check"
  | "request-start"
  | "request-waiting"
  | "fetch-failed"
  | "response-reading"
  | "json-parsing"
  | "schema-validation"
  | "http-error"
  | "rendering-result"
  | "result-rendered"
  | "render-failed"
  | "download-preparation";

type CheckResult = "not attempted" | "success" | "failed";

type DiagnosticState = {
  stage: AnalyzerStage;
  previousStage: string;
  platform: string;
  urlType: string;
  requestId: string;
  requestHost: string;
  requestStarted: boolean;
  requestCompleted: boolean;
  requestDuration: string;
  responseStatus: string;
  responseContentType: string;
  responsePreview: string;
  jsonParse: CheckResult;
  schemaValidation: CheckResult;
  lastError: string;
  errorName: string;
  errorMessage: string;
  stack: string;
  componentStack: string;
  unhandledRejection: string;
  healthReachable: string;
  healthStatus: string;
  healthLatency: string;
  healthError: string;
};

type DiagnosticContextValue = {
  enabled: boolean;
  setStage: (stage: AnalyzerStage) => void;
  setUrlContext: (platform: string, urlType: string) => void;
  beginRequest: (requestId: string, requestHost: string) => void;
  completeRequest: (status: number | string, durationMs: number, contentType?: string) => void;
  setResponseStatus: (status: number | string) => void;
  setResponseBody: (contentType: string, preview: string) => void;
  setJsonParse: (result: CheckResult) => void;
  setSchemaValidation: (result: CheckResult) => void;
  captureError: (error: unknown, source?: string, componentStack?: string) => void;
  resetAttempt: () => void;
};

const SESSION_STAGE_KEY = "vidorac_debug_stage";

const initialState: DiagnosticState = {
  stage: "idle",
  previousStage: "none",
  platform: "not detected",
  urlType: "not detected",
  requestId: "not generated",
  requestHost: "not started",
  requestStarted: false,
  requestCompleted: false,
  requestDuration: "not available",
  responseStatus: "not received",
  responseContentType: "not received",
  responsePreview: "not received",
  jsonParse: "not attempted",
  schemaValidation: "not attempted",
  lastError: "none",
  errorName: "none",
  errorMessage: "none",
  stack: "none",
  componentStack: "none",
  unhandledRejection: "none",
  healthReachable: "not checked",
  healthStatus: "not checked",
  healthLatency: "not checked",
  healthError: "none",
};

function getInitialState(): DiagnosticState {
  if (typeof window === "undefined") return initialState;
  try {
    return { ...initialState, previousStage: sessionStorage.getItem(SESSION_STAGE_KEY) || "none" };
  } catch {
    return initialState;
  }
}

const noOp = () => undefined;
const subscribeToLocation = () => noOp;
const DiagnosticsContext = createContext<DiagnosticContextValue>({
  enabled: false,
  setStage: noOp,
  setUrlContext: noOp,
  beginRequest: noOp,
  completeRequest: noOp,
  setResponseStatus: noOp,
  setResponseBody: noOp,
  setJsonParse: noOp,
  setSchemaValidation: noOp,
  captureError: noOp,
  resetAttempt: noOp,
});

function elapsed(startedAt: number): number {
  const now = typeof performance === "undefined" ? Date.now() : performance.now();
  return Math.max(0, Math.round(now - startedAt));
}

function DiagnosticsPanel({ state, setState }: { state: DiagnosticState; setState: React.Dispatch<React.SetStateAction<DiagnosticState>> }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [checkingApi, setCheckingApi] = useState(false);
  const build = process.env.NEXT_PUBLIC_BUILD_COMMIT || "local-development";
  const browser = typeof navigator === "undefined" ? "unavailable" : navigator.userAgent;
  const browserPlatform = typeof navigator === "undefined" ? "unavailable" : navigator.platform || "not reported";
  const viewport = typeof window === "undefined" ? "unavailable" : `${window.innerWidth} × ${window.innerHeight}`;
  const online = typeof navigator === "undefined" ? "unknown" : String(navigator.onLine);
  const report = [
    `Build: ${build}`,
    `Browser: ${browser}`,
    `Browser platform: ${browserPlatform}`,
    `Viewport: ${viewport}`,
    `Online: ${online}`,
    `Platform detected: ${state.platform}`,
    `URL type: ${state.urlType}`,
    `Analyzer stage: ${state.stage}`,
    `Last stage before reload: ${state.previousStage}`,
    `Diagnostic request ID: ${state.requestId}`,
    `API request host: ${state.requestHost}`,
    `Analyze request started: ${state.requestStarted}`,
    `Analyze request completed: ${state.requestCompleted}`,
    `Analyze duration: ${state.requestDuration}`,
    `API response status: ${state.responseStatus}`,
    `Response Content-Type: ${state.responseContentType}`,
    `Response preview: ${state.responsePreview}`,
    `JSON parse: ${state.jsonParse}`,
    `Schema validation: ${state.schemaValidation}`,
    `Backend health reachable: ${state.healthReachable}`,
    `Backend health status: ${state.healthStatus}`,
    `Backend health latency: ${state.healthLatency}`,
    `Backend health error: ${state.healthError}`,
    `Last error: ${state.lastError}`,
    `Error name: ${state.errorName}`,
    `Error message: ${state.errorMessage}`,
    `Stack: ${state.stack}`,
    `React component stack: ${state.componentStack}`,
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

  async function checkApi() {
    setCheckingApi(true);
    const startedAt = typeof performance === "undefined" ? Date.now() : performance.now();
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`, { cache: "no-store" });
      setState((current) => ({
        ...current,
        healthReachable: "YES",
        healthStatus: String(response.status),
        healthLatency: `${elapsed(startedAt)} ms`,
        healthError: response.ok ? "none" : `HTTP ${response.status}`,
      }));
    } catch (error) {
      const normalized = normalizeDiagnosticError(error);
      setState((current) => ({
        ...current,
        healthReachable: "NO",
        healthStatus: "no response",
        healthLatency: `${elapsed(startedAt)} ms`,
        healthError: sanitizeDiagnosticText(normalized.message),
      }));
    } finally {
      setCheckingApi(false);
    }
  }

  return (
    <details className="mx-auto mt-5 max-w-4xl rounded-xl border border-cyan-300/20 bg-[#07101d] p-3 text-left text-xs text-white/70">
      <summary className="cursor-pointer font-semibold text-cyan-200">Vidorac Diagnostics</summary>
      <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 font-mono leading-5 selection:bg-cyan-300/25">{report}</pre>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={checkApi} disabled={checkingApi} className="analysis-retry-button">
          {checkingApi ? "Checking API…" : "Check API"}
        </button>
        {canCopy && (
          <button type="button" onClick={copyReport} className="analysis-retry-button">
            {copyState === "copied" ? "Diagnostic report copied" : "Copy diagnostic report"}
          </button>
        )}
      </div>
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
  const [state, setState] = useState(getInitialState);

  const setStage = useCallback((stage: AnalyzerStage) => {
    if (!enabled) return;
    setState((current) => ({ ...current, stage }));
    try {
      sessionStorage.setItem(SESSION_STAGE_KEY, stage);
    } catch {
      // Diagnostics must never break analysis when storage is unavailable.
    }
  }, [enabled]);
  const setUrlContext = useCallback((platform: string, urlType: string) => {
    if (enabled) setState((current) => ({ ...current, platform, urlType }));
  }, [enabled]);
  const beginRequest = useCallback((requestId: string, requestHost: string) => {
    if (enabled) setState((current) => ({
      ...current,
      requestId,
      requestHost,
      requestStarted: true,
      requestCompleted: false,
      requestDuration: "waiting",
      responseStatus: "waiting",
    }));
  }, [enabled]);
  const completeRequest = useCallback((status: number | string, durationMs: number, contentType = "not reported") => {
    if (enabled) setState((current) => ({
      ...current,
      requestCompleted: true,
      requestDuration: `${Math.max(0, Math.round(durationMs))} ms`,
      responseStatus: String(status),
      responseContentType: contentType || "not reported",
    }));
  }, [enabled]);
  const setResponseBody = useCallback((contentType: string, preview: string) => {
    if (enabled) setState((current) => ({ ...current, responseContentType: contentType || "not reported", responsePreview: preview }));
  }, [enabled]);
  const setResponseStatus = useCallback((status: number | string) => {
    if (enabled) setState((current) => ({ ...current, responseStatus: String(status) }));
  }, [enabled]);
  const setJsonParse = useCallback((result: CheckResult) => {
    if (enabled) setState((current) => ({ ...current, jsonParse: result }));
  }, [enabled]);
  const setSchemaValidation = useCallback((result: CheckResult) => {
    if (enabled) setState((current) => ({ ...current, schemaValidation: result }));
  }, [enabled]);
  const captureError = useCallback((error: unknown, source = "analyzer", componentStack?: string) => {
    if (!enabled) return;
    const normalized = normalizeDiagnosticError(error);
    setState((current) => ({
      ...current,
      stage: source === "react-analyzer-boundary" ? "render-failed" : current.stage,
      lastError: source,
      errorName: sanitizeDiagnosticText(normalized.name, 120),
      errorMessage: sanitizeDiagnosticText(normalized.message),
      stack: sanitizeDiagnosticText(normalized.stack),
      componentStack: componentStack ? sanitizeDiagnosticText(componentStack) : current.componentStack,
      unhandledRejection: source === "unhandledrejection" ? sanitizeDiagnosticText(normalized.message) : current.unhandledRejection,
    }));
    if (source === "react-analyzer-boundary") {
      try {
        sessionStorage.setItem(SESSION_STAGE_KEY, "render-failed");
      } catch {
        // Diagnostics must not turn a render failure into another failure.
      }
    }
  }, [enabled]);
  const resetAttempt = useCallback(() => {
    if (!enabled) return;
    let previousStage = "none";
    try {
      previousStage = sessionStorage.getItem(SESSION_STAGE_KEY) || "none";
    } catch {
      // Keep the safe fallback.
    }
    setState({ ...initialState, previousStage });
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

  const value = useMemo(() => ({ enabled, setStage, setUrlContext, beginRequest, completeRequest, setResponseStatus, setResponseBody, setJsonParse, setSchemaValidation, captureError, resetAttempt }), [beginRequest, captureError, completeRequest, enabled, resetAttempt, setJsonParse, setResponseBody, setResponseStatus, setSchemaValidation, setStage, setUrlContext]);
  return <DiagnosticsContext.Provider value={value}>{children}{enabled && <DiagnosticsPanel state={state} setState={setState} />}</DiagnosticsContext.Provider>;
}

export function useAnalyzerDiagnostics(): DiagnosticContextValue {
  return useContext(DiagnosticsContext);
}
