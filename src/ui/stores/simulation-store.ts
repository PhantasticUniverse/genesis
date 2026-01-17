/**
 * Simulation Store
 * Zustand store for managing simulation state
 */

import { create } from "zustand";
import type { GridConfig, DiscreteRule, CAParadigm } from "../../core/types";
import { DEFAULT_GRID_CONFIG, GAME_OF_LIFE_RULE } from "../../core/types";

interface SimulationState {
  // Simulation status
  running: boolean;
  step: number;
  fps: number;

  // Configuration
  paradigm: CAParadigm;
  gridConfig: GridConfig;
  discreteRule: DiscreteRule;

  // UI state
  colormap: "matrix" | "heat" | "viridis" | "gray";
  showStats: boolean;

  // Actions
  setRunning: (running: boolean) => void;
  setStep: (step: number) => void;
  setFps: (fps: number) => void;
  setParadigm: (paradigm: CAParadigm) => void;
  setGridConfig: (config: Partial<GridConfig>) => void;
  setDiscreteRule: (rule: DiscreteRule) => void;
  setColormap: (colormap: "matrix" | "heat" | "viridis" | "gray") => void;
  toggleStats: () => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  // Initial state
  running: false,
  step: 0,
  fps: 0,
  paradigm: "discrete",
  gridConfig: DEFAULT_GRID_CONFIG,
  discreteRule: GAME_OF_LIFE_RULE,
  colormap: "matrix",
  showStats: true,

  // Actions
  setRunning: (running) => set({ running }),
  setStep: (step) => set({ step }),
  setFps: (fps) => set({ fps }),
  setParadigm: (paradigm) => set({ paradigm }),
  setGridConfig: (config) =>
    set((state) => ({
      gridConfig: { ...state.gridConfig, ...config },
    })),
  setDiscreteRule: (rule) => set({ discreteRule: rule }),
  setColormap: (colormap) => set({ colormap }),
  toggleStats: () => set((state) => ({ showStats: !state.showStats })),
}));

// Preset rules for discrete CA
export const PRESET_RULES: Record<string, DiscreteRule> = {
  // Classic Life-like
  "game-of-life": {
    birth: [3],
    survival: [2, 3],
    neighborhood: "moore",
    states: 2,
  },
  highlife: {
    birth: [3, 6],
    survival: [2, 3],
    neighborhood: "moore",
    states: 2,
  },
  seeds: { birth: [2], survival: [], neighborhood: "moore", states: 2 },
  "day-and-night": {
    birth: [3, 6, 7, 8],
    survival: [3, 4, 6, 7, 8],
    neighborhood: "moore",
    states: 2,
  },
  "life-without-death": {
    birth: [3],
    survival: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    neighborhood: "moore",
    states: 2,
  },
  diamoeba: {
    birth: [3, 5, 6, 7, 8],
    survival: [5, 6, 7, 8],
    neighborhood: "moore",
    states: 2,
  },
  replicator: {
    birth: [1, 3, 5, 7],
    survival: [1, 3, 5, 7],
    neighborhood: "moore",
    states: 2,
  },

  // More Life-like rules
  morley: {
    birth: [3, 6, 8],
    survival: [2, 4, 5],
    neighborhood: "moore",
    states: 2,
  },
  "2x2": {
    birth: [3, 6],
    survival: [1, 2, 5],
    neighborhood: "moore",
    states: 2,
  },
  maze: {
    birth: [3],
    survival: [1, 2, 3, 4, 5],
    neighborhood: "moore",
    states: 2,
  },
  mazectric: {
    birth: [3],
    survival: [1, 2, 3, 4],
    neighborhood: "moore",
    states: 2,
  },
  assimilation: {
    birth: [3, 4, 5],
    survival: [4, 5, 6, 7],
    neighborhood: "moore",
    states: 2,
  },
  coagulations: {
    birth: [3, 7, 8],
    survival: [2, 3, 5, 6, 7, 8],
    neighborhood: "moore",
    states: 2,
  },
  coral: {
    birth: [3],
    survival: [4, 5, 6, 7, 8],
    neighborhood: "moore",
    states: 2,
  },
  amoeba: {
    birth: [3, 5, 7],
    survival: [1, 3, 5, 8],
    neighborhood: "moore",
    states: 2,
  },
  "pseudo-life": {
    birth: [3, 5, 7],
    survival: [2, 3, 8],
    neighborhood: "moore",
    states: 2,
  },
  gnarl: { birth: [1], survival: [1], neighborhood: "moore", states: 2 },
  "long-life": {
    birth: [3, 4, 5],
    survival: [5],
    neighborhood: "moore",
    states: 2,
  },
  stains: {
    birth: [3, 6, 7, 8],
    survival: [2, 3, 5, 6, 7, 8],
    neighborhood: "moore",
    states: 2,
  },
  "walled-cities": {
    birth: [4, 5, 6, 7, 8],
    survival: [2, 3, 4, 5],
    neighborhood: "moore",
    states: 2,
  },

  // Von Neumann neighborhood rules
  vote: { birth: [4], survival: [3, 4], neighborhood: "vonneumann", states: 2 },
  anneal: {
    birth: [4, 6, 7, 8],
    survival: [3, 5, 6, 7, 8],
    neighborhood: "moore",
    states: 2,
  },
};

// Preset names for continuous CA
export const CONTINUOUS_PRESET_NAMES = {
  "lenia-orbium": "Lenia Orbium",
  "lenia-geminium": "Lenia Geminium",
  smoothlife: "SmoothLife",
  "gaussian-smooth": "Gaussian Smooth",
} as const;
