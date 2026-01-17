/**
 * Canvas Component - Observatory Portal
 * WebGPU canvas with bioluminescent portal styling
 */

import { forwardRef } from "react";

interface CanvasProps {
  width?: number;
  height?: number;
  className?: string;
  isRunning?: boolean;
}

export const Canvas = forwardRef<HTMLCanvasElement, CanvasProps>(
  ({ width = 512, height = 512, className = "", isRunning = false }, ref) => {
    return (
      <div
        className={`observatory-portal ${isRunning ? "running" : ""} ${className}`}
      >
        {/* Corner Brackets */}
        <div className="portal-bracket top-left" />
        <div className="portal-bracket top-right" />
        <div className="portal-bracket bottom-left" />
        <div className="portal-bracket bottom-right" />

        {/* Inner Frame */}
        <div className="relative rounded-lg overflow-hidden bg-genesis-void">
          {/* Canvas */}
          <canvas
            ref={ref}
            width={width}
            height={height}
            className="block"
            style={{
              imageRendering: "pixelated",
            }}
          />

          {/* Scan Line Effect (only when running) */}
          {isRunning && <div className="portal-scanline" />}

          {/* Status Bar */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-1.5 bg-gradient-to-t from-genesis-void/90 to-transparent">
            <div className="flex items-center gap-2">
              <span className={`status-dot ${isRunning ? "running" : ""}`} />
              <span className="text-xs font-mono tracking-wider text-zinc-400">
                {isRunning ? "OBSERVING" : "PAUSED"}
              </span>
            </div>
            <span className="text-xs font-mono text-zinc-600">
              {width}x{height}
            </span>
          </div>
        </div>
      </div>
    );
  },
);

Canvas.displayName = "Canvas";
