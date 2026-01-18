/**
 * Adaptive Quality Store
 *
 * Manages quality settings and auto-adjusts based on performance:
 * - FPS monitoring
 * - Quality preset management
 * - Memory budget tracking
 * - Auto-quality suggestions
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type QualityLevel = "performance" | "balanced" | "quality" | "ultra";

export interface QualityConfig {
  gridSize: number;
  targetFps: number;
  fftThreshold: number;
  creatureTrackingInterval: number;
  analysisInterval: number;
  precision: "f32" | "f16";
}

export interface QualityState {
  // Current settings
  currentLevel: QualityLevel;
  config: QualityConfig;

  // Performance tracking
  currentFps: number;
  avgFps: number;
  fpsHistory: number[];
  memoryUsage: number;

  // Auto-quality
  autoQuality: boolean;
  suggestedLevel: QualityLevel | null;
  suggestionDismissed: boolean;

  // Actions
  setQualityLevel: (level: QualityLevel) => void;
  setAutoQuality: (enabled: boolean) => void;
  updateFps: (fps: number) => void;
  updateMemory: (bytes: number) => void;
  dismissSuggestion: () => void;
  acceptSuggestion: () => void;
}

const QUALITY_CONFIGS: Record<QualityLevel, QualityConfig> = {
  performance: {
    gridSize: 256,
    targetFps: 60,
    fftThreshold: 12,
    creatureTrackingInterval: 10,
    analysisInterval: 30,
    precision: "f16",
  },
  balanced: {
    gridSize: 512,
    targetFps: 60,
    fftThreshold: 16,
    creatureTrackingInterval: 5,
    analysisInterval: 15,
    precision: "f32",
  },
  quality: {
    gridSize: 1024,
    targetFps: 30,
    fftThreshold: 16,
    creatureTrackingInterval: 5,
    analysisInterval: 10,
    precision: "f32",
  },
  ultra: {
    gridSize: 2048,
    targetFps: 30,
    fftThreshold: 14,
    creatureTrackingInterval: 10,
    analysisInterval: 20,
    precision: "f32",
  },
};

const QUALITY_ORDER: QualityLevel[] = [
  "performance",
  "balanced",
  "quality",
  "ultra",
];

const FPS_HISTORY_SIZE = 60;
const LOW_FPS_THRESHOLD = 0.8; // 80% of target
const HIGH_FPS_THRESHOLD = 1.5; // 150% of target
const SUGGESTION_FRAMES = 60; // Need 60 consecutive frames to trigger suggestion

export const useQualityStore = create<QualityState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentLevel: "balanced",
      config: QUALITY_CONFIGS.balanced,
      currentFps: 60,
      avgFps: 60,
      fpsHistory: [],
      memoryUsage: 0,
      autoQuality: false,
      suggestedLevel: null,
      suggestionDismissed: false,

      // Set quality level
      setQualityLevel: (level) => {
        set({
          currentLevel: level,
          config: QUALITY_CONFIGS[level],
          suggestedLevel: null,
          suggestionDismissed: false,
        });
      },

      // Toggle auto-quality
      setAutoQuality: (enabled) => {
        set({
          autoQuality: enabled,
          suggestedLevel: null,
          suggestionDismissed: false,
        });
      },

      // Update FPS measurement
      updateFps: (fps) => {
        const state = get();
        const history = [...state.fpsHistory, fps].slice(-FPS_HISTORY_SIZE);
        const avgFps = history.reduce((a, b) => a + b, 0) / history.length;

        let suggestedLevel = state.suggestedLevel;

        // Auto-quality logic
        if (state.autoQuality && !state.suggestionDismissed) {
          const targetFps = state.config.targetFps;
          const currentIdx = QUALITY_ORDER.indexOf(state.currentLevel);

          // Check if we need to suggest a change
          if (history.length >= SUGGESTION_FRAMES) {
            if (avgFps < targetFps * LOW_FPS_THRESHOLD && currentIdx > 0) {
              // Suggest lower quality
              suggestedLevel = QUALITY_ORDER[currentIdx - 1];
            } else if (
              avgFps > targetFps * HIGH_FPS_THRESHOLD &&
              currentIdx < QUALITY_ORDER.length - 1
            ) {
              // Suggest higher quality
              suggestedLevel = QUALITY_ORDER[currentIdx + 1];
            } else {
              suggestedLevel = null;
            }
          }
        }

        set({
          currentFps: fps,
          avgFps,
          fpsHistory: history,
          suggestedLevel,
        });
      },

      // Update memory usage
      updateMemory: (bytes) => {
        set({ memoryUsage: bytes });
      },

      // Dismiss the current suggestion
      dismissSuggestion: () => {
        set({
          suggestedLevel: null,
          suggestionDismissed: true,
        });
      },

      // Accept the suggestion
      acceptSuggestion: () => {
        const state = get();
        if (state.suggestedLevel) {
          set({
            currentLevel: state.suggestedLevel,
            config: QUALITY_CONFIGS[state.suggestedLevel],
            suggestedLevel: null,
            suggestionDismissed: false,
          });
        }
      },
    }),
    {
      name: "genesis-quality-settings",
      partialize: (state) => ({
        currentLevel: state.currentLevel,
        autoQuality: state.autoQuality,
      }),
    },
  ),
);

/**
 * Get memory budget for a grid size
 */
export function getMemoryBudget(gridSize: number): number {
  // Estimate based on typical buffer usage
  // Main state + staging + FFT intermediates + kernel
  const baseBuffers = 4; // Double-buffered state + staging
  const fftBuffers = 4; // FFT requires complex intermediates
  const bytesPerPixel = 4; // Float32
  const totalPixels = gridSize * gridSize;

  return totalPixels * bytesPerPixel * (baseBuffers + fftBuffers);
}

/**
 * Check if a grid size is safe for the device
 */
export function isGridSizeSafe(gridSize: number): {
  safe: boolean;
  warning?: string;
} {
  const memoryNeeded = getMemoryBudget(gridSize);

  // Check device memory if available
  if (typeof navigator !== "undefined" && "deviceMemory" in navigator) {
    const deviceMemory =
      ((navigator as { deviceMemory?: number }).deviceMemory ?? 4) *
      1024 *
      1024 *
      1024;
    const memoryRatio = memoryNeeded / deviceMemory;

    if (memoryRatio > 0.5) {
      return {
        safe: false,
        warning: "Grid size may exceed available GPU memory",
      };
    }
    if (memoryRatio > 0.25) {
      return {
        safe: true,
        warning: "Large grid size - may impact performance",
      };
    }
  }

  // Default warnings for large sizes
  if (gridSize >= 4096) {
    return {
      safe: false,
      warning: "Very large grid - requires high-end GPU",
    };
  }
  if (gridSize >= 2048) {
    return {
      safe: true,
      warning: "Large grid - ensure adequate GPU memory",
    };
  }

  return { safe: true };
}

/**
 * Detect recommended quality level for the device
 */
export function detectRecommendedQuality(): QualityLevel {
  // Check for device hints
  if (typeof navigator !== "undefined") {
    // Check device memory
    if ("deviceMemory" in navigator) {
      const memory = (navigator as { deviceMemory?: number }).deviceMemory ?? 4;
      if (memory >= 8) return "quality";
      if (memory >= 4) return "balanced";
      return "performance";
    }

    // Check for mobile
    if (/Mobile|Android|iPhone/i.test(navigator.userAgent)) {
      return "performance";
    }
  }

  return "balanced";
}

/**
 * Quality suggestion component props
 */
export interface QualitySuggestionProps {
  suggestedLevel: QualityLevel;
  currentLevel: QualityLevel;
  avgFps: number;
  targetFps: number;
  onAccept: () => void;
  onDismiss: () => void;
}
