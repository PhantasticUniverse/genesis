/**
 * WebGPU Compatibility Check Component
 * Displays user-friendly guidance when WebGPU is not available
 */

import { useState, useEffect } from "react";
import { isWebGPUAvailable } from "../../compute/webgpu/context";

interface BrowserInfo {
  name: string;
  minVersion: string;
  url: string;
  icon: string;
}

const SUPPORTED_BROWSERS: BrowserInfo[] = [
  {
    name: "Google Chrome",
    minVersion: "113+",
    url: "https://www.google.com/chrome/",
    icon: "chrome",
  },
  {
    name: "Microsoft Edge",
    minVersion: "113+",
    url: "https://www.microsoft.com/edge",
    icon: "edge",
  },
  {
    name: "Safari",
    minVersion: "18+",
    url: "https://www.apple.com/safari/",
    icon: "safari",
  },
  {
    name: "Firefox",
    minVersion: "121+",
    url: "https://www.mozilla.org/firefox/",
    icon: "firefox",
  },
];

export interface WebGPUCheckResult {
  available: boolean;
  reason?: "not_supported" | "no_adapter" | "unknown";
}

/**
 * Check WebGPU availability with detailed error info
 * Includes a timeout to prevent indefinite hanging when GPU is partially available
 */
export async function checkWebGPUSupport(): Promise<WebGPUCheckResult> {
  // Check if navigator.gpu exists
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    return { available: false, reason: "not_supported" };
  }

  try {
    // Try to get adapter with timeout (5 seconds)
    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 5000)
    );

    const adapterPromise = navigator.gpu.requestAdapter({
      powerPreference: "high-performance",
    });

    const adapter = await Promise.race([adapterPromise, timeoutPromise]);

    if (!adapter) {
      return { available: false, reason: "no_adapter" };
    }

    return { available: true };
  } catch (e) {
    if (e instanceof Error && e.message === "timeout") {
      return { available: false, reason: "no_adapter" };
    }
    return { available: false, reason: "unknown" };
  }
}

/**
 * Detect current browser info
 */
function detectBrowser(): { name: string; version: string } | null {
  const ua = navigator.userAgent;

  // Chrome
  const chromeMatch = ua.match(/Chrome\/(\d+)/);
  if (chromeMatch && !ua.includes("Edg/")) {
    return { name: "Chrome", version: chromeMatch[1] };
  }

  // Edge
  const edgeMatch = ua.match(/Edg\/(\d+)/);
  if (edgeMatch) {
    return { name: "Edge", version: edgeMatch[1] };
  }

  // Firefox
  const firefoxMatch = ua.match(/Firefox\/(\d+)/);
  if (firefoxMatch) {
    return { name: "Firefox", version: firefoxMatch[1] };
  }

  // Safari
  const safariMatch = ua.match(/Version\/(\d+).*Safari/);
  if (safariMatch) {
    return { name: "Safari", version: safariMatch[1] };
  }

  return null;
}

interface WebGPUCompatibilityModalProps {
  onDismiss?: () => void;
  checkResult: WebGPUCheckResult;
}

export function WebGPUCompatibilityModal({
  onDismiss,
  checkResult,
}: WebGPUCompatibilityModalProps) {
  const browser = detectBrowser();

  const getErrorMessage = () => {
    switch (checkResult.reason) {
      case "not_supported":
        return "WebGPU is not supported in your browser.";
      case "no_adapter":
        return "WebGPU is available but no compatible GPU was found.";
      default:
        return "WebGPU initialization failed.";
    }
  };

  const getHelpText = () => {
    if (checkResult.reason === "no_adapter") {
      return (
        <>
          <p>This may be due to:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Outdated graphics drivers</li>
            <li>Hardware that doesn't support WebGPU</li>
            <li>WebGPU being disabled in browser settings</li>
          </ul>
          <p className="mt-3">
            Try updating your graphics drivers or using a different browser.
          </p>
        </>
      );
    }

    if (browser) {
      const minVersions: Record<string, number> = {
        Chrome: 113,
        Edge: 113,
        Firefox: 121,
        Safari: 18,
      };

      const minVersion = minVersions[browser.name];
      const currentVersion = parseInt(browser.version);

      if (minVersion && currentVersion < minVersion) {
        return (
          <p>
            You're using{" "}
            <strong>
              {browser.name} {browser.version}
            </strong>
            , but WebGPU requires{" "}
            <strong>
              {browser.name} {minVersion}+
            </strong>
            . Please update your browser.
          </p>
        );
      }
    }

    return (
      <p>
        GENESIS requires WebGPU for GPU-accelerated cellular automata
        simulation. Please use a supported browser.
      </p>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-xl border border-zinc-700 max-w-lg w-full shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-900/50 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                WebGPU Not Available
              </h2>
              <p className="text-sm text-zinc-400">{getErrorMessage()}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <div className="text-sm text-zinc-300 mb-6">{getHelpText()}</div>

          {/* Supported Browsers */}
          <div className="mb-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">
              Supported Browsers
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {SUPPORTED_BROWSERS.map((b) => (
                <a
                  key={b.name}
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-zinc-700 flex items-center justify-center">
                    <BrowserIcon name={b.icon} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">
                      {b.name}
                    </div>
                    <div className="text-xs text-zinc-500">{b.minVersion}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Additional Help */}
          <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
            <p className="text-xs text-zinc-400">
              WebGPU is a modern graphics API that enables high-performance GPU
              computation in the browser. It's required for GENESIS's real-time
              cellular automata simulation.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-700 flex justify-end gap-3">
          <a
            href="https://caniuse.com/webgpu"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Check Browser Support
          </a>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded text-sm text-white transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Simple browser icon component
 */
function BrowserIcon({ name }: { name: string }) {
  // Simple colored circles as placeholders for browser icons
  const colors: Record<string, string> = {
    chrome: "bg-gradient-to-br from-red-500 via-yellow-500 to-green-500",
    edge: "bg-gradient-to-br from-blue-400 to-green-400",
    safari: "bg-gradient-to-br from-blue-400 to-blue-600",
    firefox: "bg-gradient-to-br from-orange-500 to-yellow-400",
  };

  return (
    <div className={`w-5 h-5 rounded-full ${colors[name] || "bg-zinc-600"}`} />
  );
}

/**
 * Hook to check WebGPU support on mount
 */
export function useWebGPUCheck() {
  const [result, setResult] = useState<WebGPUCheckResult | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkWebGPUSupport().then((r) => {
      setResult(r);
      setChecking(false);
    });
  }, []);

  return { result, checking };
}
