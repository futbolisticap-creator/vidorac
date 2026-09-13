"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { useAnalyzerDiagnostics } from "./analyzer-diagnostics";

type Props = { children: ReactNode; onError: (error: unknown, source?: string, componentStack?: string) => void; onReset: () => void };
type State = { failed: boolean };

class AnalyzerErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError(error, "react-analyzer-boundary", info.componentStack ?? undefined);
    if (process.env.NODE_ENV === "development") {
      console.error("Analyzer render failure", error, info.componentStack);
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="analysis-wait-card mx-auto mt-8 max-w-4xl" role="alert">
        <div>
          <h2>Something went wrong while processing this link.</h2>
          <p>Try again without reloading the page.</p>
        </div>
        <button
          type="button"
          className="analysis-retry-button"
          onClick={() => {
            this.props.onReset();
            this.setState({ failed: false });
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}

export default function AnalyzerBoundary({ children }: { children: ReactNode }) {
  const diagnostics = useAnalyzerDiagnostics();
  return <AnalyzerErrorBoundary onError={diagnostics.captureError} onReset={diagnostics.resetAttempt}>{children}</AnalyzerErrorBoundary>;
}
