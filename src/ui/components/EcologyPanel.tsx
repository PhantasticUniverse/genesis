/**
 * Ecology Panel Component
 * Controls for multi-species ecosystem simulation
 */

import { useState, useCallback } from "react";
import type { Engine } from "../../core/engine";
import { MULTICHANNEL_PRESETS } from "../../core/channels";

interface EcologyPanelProps {
  engine: Engine | null;
}

// Preset descriptions for UI
const PRESET_INFO: Record<string, { description: string; icon: string }> = {
  single: {
    description: "Standard Lenia organism",
    icon: "O",
  },
  "two-species": {
    description: "Two competing species that inhibit each other",
    icon: "AB",
  },
  "predator-prey": {
    description: "Classic predator-prey dynamics with population cycles",
    icon: "PH",
  },
  "food-chain": {
    description: "Three-level ecosystem: plants, herbivores, predators",
    icon: "3L",
  },
  symbiosis: {
    description: "Two species that mutually benefit each other",
    icon: "++",
  },
  "creature-food": {
    description: "Creature that consumes diffusing food source",
    icon: "CF",
  },
  pheromone: {
    description: "Creature leaving chemical trails",
    icon: "Ph",
  },
};

export function EcologyPanel({ engine }: EcologyPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("single");
  const [isEnabled, setIsEnabled] = useState(false);
  const [pheromoneRate, setPheromoneRate] = useState(0);

  const activatePreset = useCallback(
    (presetName: string) => {
      if (!engine) return;

      const config = MULTICHANNEL_PRESETS[presetName];
      if (!config) return;

      setSelectedPreset(presetName);
      setIsEnabled(true);

      // Enable multi-channel mode in engine
      engine.enableMultiChannel(config);

      // Reset pheromone rate for pheromone preset
      if (presetName === "pheromone") {
        setPheromoneRate(0.1);
        engine.setEcologyParams({
          pheromoneSource: 0,
          pheromoneTarget: 2,
          pheromoneRate: 0.1,
        });
      } else {
        setPheromoneRate(0);
      }
    },
    [engine],
  );

  const disableEcology = useCallback(() => {
    if (!engine) return;
    engine.disableMultiChannel();
    setIsEnabled(false);
    setSelectedPreset("single");
  }, [engine]);

  const updatePheromoneRate = useCallback(
    (rate: number) => {
      if (!engine) return;
      setPheromoneRate(rate);
      engine.setEcologyParams({ pheromoneRate: rate });
    },
    [engine],
  );

  if (!engine) return null;

  const currentConfig = MULTICHANNEL_PRESETS[selectedPreset];

  return (
    <div className="mt-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-emerald-400">
            Multi-Species Ecology
          </h3>
          {isEnabled && (
            <span className="px-1.5 py-0.5 text-xs bg-emerald-600 rounded">
              {currentConfig?.channels.length || 1} Species
            </span>
          )}
        </div>
        <span className="text-zinc-500">{isExpanded ? "−" : "+"}</span>
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Description */}
          <p className="text-xs text-zinc-500">
            Simulate multiple interacting species with predator-prey dynamics,
            competition, symbiosis, and chemical signaling.
          </p>

          {/* Enable Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-zinc-400">Enable Ecology Mode</label>
            <button
              onClick={() =>
                isEnabled ? disableEcology() : activatePreset(selectedPreset)
              }
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                isEnabled
                  ? "bg-emerald-600 text-white"
                  : "bg-zinc-700 text-zinc-400"
              }`}
            >
              {isEnabled ? "ON" : "OFF"}
            </button>
          </div>

          {/* Preset Selection */}
          <div className="space-y-2">
            <label className="text-sm text-zinc-400">Ecosystem Preset</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(PRESET_INFO).map(([name, info]) => (
                <button
                  key={name}
                  onClick={() => activatePreset(name)}
                  className={`p-2 rounded text-left transition-all ${
                    selectedPreset === name && isEnabled
                      ? "bg-emerald-600/20 border border-emerald-500"
                      : "bg-zinc-800 border border-zinc-700 hover:border-zinc-600"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-xs px-1.5 py-0.5 rounded ${
                        selectedPreset === name && isEnabled
                          ? "bg-emerald-600 text-white"
                          : "bg-zinc-700 text-zinc-400"
                      }`}
                    >
                      {info.icon}
                    </span>
                    <span className="text-sm text-zinc-300 capitalize">
                      {name.replace(/-/g, " ")}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                    {info.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Species Color Legend */}
          {isEnabled && currentConfig && currentConfig.channels.length > 1 && (
            <div className="space-y-2">
              <label className="text-sm text-zinc-400">Species Legend</label>
              <div className="flex flex-wrap gap-2">
                {currentConfig.channels.map((channel, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 rounded"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: `rgb(${channel.color[0]}, ${channel.color[1]}, ${channel.color[2]})`,
                      }}
                    />
                    <span className="text-xs text-zinc-300">
                      {channel.name}
                    </span>
                    {channel.decayRate > 0 && (
                      <span className="text-xs text-zinc-500">(decay)</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pheromone Control (for pheromone preset) */}
          {isEnabled && selectedPreset === "pheromone" && (
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <label className="text-zinc-400">Pheromone Emission</label>
                <span className="font-mono text-zinc-500">
                  {pheromoneRate.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.3"
                step="0.01"
                value={pheromoneRate}
                onChange={(e) =>
                  updatePheromoneRate(parseFloat(e.target.value))
                }
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <p className="text-xs text-zinc-600">
                How much chemical trail creatures leave behind
              </p>
            </div>
          )}

          {/* Interaction Summary */}
          {isEnabled && currentConfig && (
            <div className="mt-4 p-3 bg-zinc-800 rounded text-xs">
              <div className="text-zinc-400 mb-2">Active Interactions:</div>
              <div className="space-y-1 text-zinc-500">
                {currentConfig.interactions
                  .slice(0, 4)
                  .map((interaction, idx) => {
                    const source =
                      currentConfig.channels[interaction.sourceChannel]?.name ||
                      `Ch${interaction.sourceChannel}`;
                    const target =
                      currentConfig.channels[interaction.targetChannel]?.name ||
                      `Ch${interaction.targetChannel}`;
                    const effect =
                      interaction.weight > 0 ? "helps" : "inhibits";
                    return (
                      <div key={idx} className="flex items-center gap-1">
                        <span className="text-emerald-400">{source}</span>
                        <span>{effect}</span>
                        <span className="text-emerald-400">{target}</span>
                        <span className="text-zinc-600">
                          ({interaction.interactionType || "lenia"})
                        </span>
                      </div>
                    );
                  })}
                {currentConfig.interactions.length > 4 && (
                  <div className="text-zinc-600">
                    +{currentConfig.interactions.length - 4} more...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="mt-4 p-3 bg-emerald-900/20 border border-emerald-800 rounded text-xs text-emerald-400">
            <strong>Tip:</strong> Click and drag on the canvas to add organisms.
            Different species will be placed based on mouse position or selected
            channel.
          </div>
        </div>
      )}
    </div>
  );
}
