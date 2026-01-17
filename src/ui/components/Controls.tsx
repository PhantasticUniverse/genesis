/**
 * Controls Component
 * Control panel for discrete and continuous CA
 */

import { useState } from "react";
import {
  useSimulationStore,
  PRESET_RULES,
  CONTINUOUS_PRESET_NAMES,
} from "../stores/simulation-store";
import type { Engine, ColormapName, BoundaryMode } from "../../core/engine";
import { COLORMAP_IDS } from "../../core/engine";
import { useEngineControls } from "../hooks/useEngine";
import type { CAParadigm } from "../../core/types";
import { CONTINUOUS_PRESETS } from "../../compute/webgpu/continuous-pipeline";

type PatternType =
  | "random"
  | "glider"
  | "blinker"
  | "center-blob"
  | "lenia-seed";

// Human-readable colormap names
const COLORMAP_NAMES: Record<ColormapName, string> = {
  grayscale: "Grayscale",
  classic: "Classic Green",
  viridis: "Viridis",
  plasma: "Plasma",
  inferno: "Inferno",
  fire: "Fire",
  ocean: "Ocean",
  rainbow: "Rainbow",
  neon: "Neon",
  turbo: "Turbo",
  earth: "Earth",
  magma: "Magma",
};

// Human-readable boundary mode names
const BOUNDARY_MODE_NAMES: Record<BoundaryMode, string> = {
  periodic: "Periodic (Toroidal)",
  clamped: "Clamped (Edge)",
  reflected: "Reflected (Mirror)",
  zero: "Zero (Absorbing)",
};

// All boundary modes
const BOUNDARY_MODES: BoundaryMode[] = [
  "periodic",
  "clamped",
  "reflected",
  "zero",
];

interface ControlsProps {
  engine: Engine | null;
}

export function Controls({ engine }: ControlsProps) {
  const { running, step, fps, paradigm, discreteRule, showStats, setParadigm } =
    useSimulationStore();
  const { toggle, stepOnce, reset, setRule } = useEngineControls(engine);
  const [currentPattern, setCurrentPattern] = useState<PatternType>("random");

  const handleParadigmChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newParadigm = e.target.value as CAParadigm;
    setParadigm(newParadigm);
    engine?.setParadigm(newParadigm);

    // Reset with appropriate pattern
    if (newParadigm === "continuous") {
      // Apply default Lenia preset parameters
      engine?.setContinuousPreset("lenia-orbium");
      setCurrentPattern("lenia-seed");
      reset("lenia-seed");
    } else {
      setCurrentPattern("random");
      reset("random");
    }
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = PRESET_RULES[e.target.value];
    if (preset) {
      setRule(preset);
    }
  };

  const handleContinuousPresetChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const presetName = e.target.value as keyof typeof CONTINUOUS_PRESETS;
    engine?.setContinuousPreset(presetName);
    setCurrentPattern("lenia-seed");
    reset("lenia-seed");
  };

  const handlePatternChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pattern = e.target.value as PatternType;
    setCurrentPattern(pattern);
    reset(pattern);
  };

  const handleColormapChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    engine?.setColormap(e.target.value as ColormapName);
  };

  const handleBoundaryModeChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    engine?.setBoundaryMode(e.target.value as BoundaryMode);
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
      {/* Stats */}
      {showStats && (
        <div className="flex gap-4 text-sm text-zinc-400">
          <span>
            Step:{" "}
            <span className="text-green-400 font-mono">
              {step.toLocaleString()}
            </span>
          </span>
          <span>
            FPS: <span className="text-green-400 font-mono">{fps}</span>
          </span>
        </div>
      )}

      {/* Playback Controls */}
      <div className="flex gap-2">
        <button
          onClick={toggle}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            running
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
        >
          {running ? "Stop" : "Start"}
        </button>

        <button
          onClick={() => stepOnce()}
          disabled={running}
          className="px-4 py-2 rounded font-medium bg-zinc-700 hover:bg-zinc-600 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Step
        </button>

        <button
          onClick={() => reset(currentPattern)}
          className="px-4 py-2 rounded font-medium bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Paradigm Selector */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500 uppercase tracking-wide">
          Mode
        </label>
        <select
          onChange={handleParadigmChange}
          value={paradigm}
          className="px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="discrete">Discrete (Game of Life)</option>
          <option value="continuous">Continuous (Lenia)</option>
        </select>
      </div>

      {/* Presets - Different based on paradigm */}
      <div className="flex gap-4">
        {paradigm === "discrete" ? (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500 uppercase tracking-wide">
              Rule
            </label>
            <select
              onChange={handlePresetChange}
              defaultValue="game-of-life"
              className="px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <optgroup label="Classic">
                <option value="game-of-life">Game of Life (B3/S23)</option>
                <option value="highlife">HighLife (B36/S23)</option>
                <option value="seeds">Seeds (B2/S)</option>
                <option value="day-and-night">Day & Night</option>
              </optgroup>
              <optgroup label="Patterns">
                <option value="maze">Maze (B3/S12345)</option>
                <option value="mazectric">Mazectric (B3/S1234)</option>
                <option value="coral">Coral (B3/S45678)</option>
                <option value="stains">Stains</option>
              </optgroup>
              <optgroup label="Chaotic">
                <option value="diamoeba">Diamoeba</option>
                <option value="amoeba">Amoeba (B357/S1358)</option>
                <option value="morley">Morley (B368/S245)</option>
                <option value="gnarl">Gnarl (B1/S1)</option>
              </optgroup>
              <optgroup label="Expansive">
                <option value="life-without-death">Life w/o Death</option>
                <option value="coagulations">Coagulations</option>
                <option value="assimilation">Assimilation</option>
                <option value="walled-cities">Walled Cities</option>
              </optgroup>
              <optgroup label="Special">
                <option value="replicator">Replicator (B1357/S1357)</option>
                <option value="2x2">2x2 (B36/S125)</option>
                <option value="anneal">Anneal</option>
              </optgroup>
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500 uppercase tracking-wide">
              Preset
            </label>
            <select
              onChange={handleContinuousPresetChange}
              defaultValue="lenia-orbium"
              className="px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {Object.entries(CONTINUOUS_PRESET_NAMES).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 uppercase tracking-wide">
            Pattern
          </label>
          <select
            onChange={handlePatternChange}
            defaultValue={paradigm === "discrete" ? "random" : "lenia-seed"}
            className="px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {paradigm === "discrete" ? (
              <>
                <option value="random">Random</option>
                <option value="glider">Glider</option>
                <option value="blinker">Blinker</option>
                <option value="center-blob">Center Blob</option>
              </>
            ) : (
              <>
                <option value="lenia-seed">Lenia Seed</option>
                <option value="center-blob">Center Blob</option>
                <option value="random">Random</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Colormap Selector */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-500 uppercase tracking-wide">
          Colormap
        </label>
        <select
          onChange={handleColormapChange}
          defaultValue="viridis"
          className="px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          {(Object.keys(COLORMAP_IDS) as ColormapName[]).map((key) => (
            <option key={key} value={key}>
              {COLORMAP_NAMES[key]}
            </option>
          ))}
        </select>
      </div>

      {/* Boundary Mode Selector (continuous only) */}
      {paradigm === "continuous" && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 uppercase tracking-wide">
            Boundary
          </label>
          <select
            onChange={handleBoundaryModeChange}
            defaultValue="periodic"
            className="px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {BOUNDARY_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {BOUNDARY_MODE_NAMES[mode]}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Current Rule Display */}
      <div className="text-xs text-zinc-500 font-mono">
        {paradigm === "discrete"
          ? `B${discreteRule.birth.join("")}/S${discreteRule.survival.join("")}`
          : "Continuous CA (Lenia/SmoothLife)"}
      </div>
    </div>
  );
}
