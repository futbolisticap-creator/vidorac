"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export default class AnalyzerBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV === "development") {
      console.error("Analyzer render failure", error, info.componentStack);
    }
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="analysis-wait-card mx-auto mt-8 max-w-4xl" role="alert">
        <div>
          <h2>The analyzer encountered an unexpected problem</h2>
          <p>You can reset it and try another public link without reloading the page.</p>
        </div>
        <button
          type="button"
          className="analysis-retry-button"
          onClick={() => this.setState({ failed: false })}
        >
          Reset analyzer
        </button>
      </div>
    );
  }
}
