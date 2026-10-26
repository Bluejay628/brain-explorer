import { Component, type ReactNode } from "react";

/** If one page crashes, show a friendly message instead of a blank site; the menu keeps working. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Page crashed:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="panel empty" role="alert">
        <p>Something went wrong on this page.</p>
        <p className="small faint" style={{ marginTop: 4 }}>{this.state.error.message}</p>
        <button className="btn" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>Reload the page</button>
      </div>
    );
  }
}
