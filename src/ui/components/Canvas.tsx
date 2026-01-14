/**
 * Canvas Component
 * WebGPU canvas for rendering the cellular automata
 */

import { forwardRef } from 'react';

interface CanvasProps {
  width?: number;
  height?: number;
  className?: string;
}

export const Canvas = forwardRef<HTMLCanvasElement, CanvasProps>(
  ({ width = 512, height = 512, className = '' }, ref) => {
    return (
      <canvas
        ref={ref}
        width={width}
        height={height}
        className={`border border-zinc-700 rounded-lg ${className}`}
        style={{
          imageRendering: 'pixelated',
        }}
      />
    );
  }
);

Canvas.displayName = 'Canvas';
