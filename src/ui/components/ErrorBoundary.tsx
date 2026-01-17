/**
 * Error Boundary Component
 * Catches JavaScript errors in child components and displays a fallback UI
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  name?: string; // Optional name for debugging
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error details
    console.error(
      `[ErrorBoundary${this.props.name ? `: ${this.props.name}` : ""}] Caught error:`,
      error,
    );
    console.error("Error info:", errorInfo);

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // Custom fallback
      if (typeof fallback === "function") {
        return fallback(error, this.handleReset);
      }
      if (fallback) {
        return fallback;
      }

      // Default fallback
      return (
        <DefaultErrorFallback error={error} onReset={this.handleReset} />
      );
    }

    return children;
  }
}

/**
 * Default error fallback component
 */
interface DefaultErrorFallbackProps {
  error: Error;
  onReset: () => void;
}

function DefaultErrorFallback({
  error,
  onReset,
}: DefaultErrorFallbackProps): ReactNode {
  return (
    <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg
            className="w-5 h-5 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-medium text-red-400">
            Something went wrong
          </h3>
          <p className="mt-1 text-sm text-red-300/70">{error.message}</p>
          <button
            onClick={onReset}
            className="mt-3 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-500 rounded transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Panel-level error boundary with inline recovery
 * Use this to wrap individual panels so they can fail independently
 */
interface PanelErrorBoundaryProps {
  children: ReactNode;
  panelName: string;
}

export function PanelErrorBoundary({
  children,
  panelName,
}: PanelErrorBoundaryProps): ReactNode {
  return (
    <ErrorBoundary
      name={panelName}
      fallback={(error, reset) => (
        <div className="mt-6 p-4 bg-zinc-900 rounded-lg border border-red-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <h3 className="text-sm font-medium text-zinc-300">{panelName}</h3>
            </div>
            <button
              onClick={reset}
              className="px-2 py-1 text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
            >
              Retry
            </button>
          </div>
          <p className="mt-2 text-xs text-red-400/70">Error: {error.message}</p>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Top-level error boundary for catastrophic failures
 * Displays a full-page error with reload option
 */
interface AppErrorBoundaryProps {
  children: ReactNode;
}

export function AppErrorBoundary({
  children,
}: AppErrorBoundaryProps): ReactNode {
  return (
    <ErrorBoundary
      name="App"
      fallback={(error, reset) => (
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-900/30 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-zinc-400 mb-6">
              An unexpected error occurred. This is likely a bug in the
              application.
            </p>
            <div className="bg-zinc-900 rounded-lg p-4 mb-6 text-left">
              <p className="text-xs font-mono text-red-400 break-all">
                {error.message}
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={reset}
                className="px-4 py-2 text-sm font-medium text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Try again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-500 rounded-lg transition-colors"
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
