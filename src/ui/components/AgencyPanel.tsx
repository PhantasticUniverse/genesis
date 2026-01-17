/**
 * Agency Panel Component
 * UI for sensorimotor creature control and obstacle placement
 */

import { useState, useCallback, useEffect } from "react";
import type {
  Engine,
  Creature,
  TrackerState,
  ObstaclePattern,
} from "../../core/engine";

interface AgencyPanelProps {
  engine: Engine | null;
}

interface CreatureInfo {
  id: number;
  mass: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function AgencyPanel({ engine }: AgencyPanelProps) {
  const [obstaclePattern, setObstaclePattern] =
    useState<ObstaclePattern>("none");
  const [targetX, setTargetX] = useState(400);
  const [targetY, setTargetY] = useState(100);
  const [motorInfluence, setMotorInfluence] = useState(0.3);
  const [isAgencyMode, setIsAgencyMode] = useState(false);
  const [showObstacles, setShowObstacles] = useState(false);
  const [creatures, setCreatures] = useState<CreatureInfo[]>([]);
  const [largestCreature, setLargestCreature] = useState<CreatureInfo | null>(
    null,
  );

  // Setup creature tracking callback
  useEffect(() => {
    if (!engine || !isAgencyMode) return;

    const callback = (
      creatureList: Creature[],
      largest: Creature | null,
      _tracker: TrackerState,
    ) => {
      setCreatures(
        creatureList.slice(0, 5).map((c) => ({
          id: c.id,
          mass: c.mass,
          x: c.centroidX,
          y: c.centroidY,
          vx: c.velocityX,
          vy: c.velocityY,
        })),
      );
      setLargestCreature(
        largest
          ? {
              id: largest.id,
              mass: largest.mass,
              x: largest.centroidX,
              y: largest.centroidY,
              vx: largest.velocityX,
              vy: largest.velocityY,
            }
          : null,
      );
    };

    engine.onCreatureUpdate(callback);

    return () => {
      engine.onCreatureUpdate(null);
    };
  }, [engine, isAgencyMode]);

  const handleEnableAgency = useCallback(() => {
    if (!engine) return;
    setIsAgencyMode(true);
    // Enable creature tracking
    engine.enableTracking({
      threshold: 0.05,
      minMass: 10,
      updateInterval: 5, // Update every 5 frames
    });
    // Enable sensorimotor mode
    engine.enableSensorimotor();
  }, [engine]);

  const handleDisableAgency = useCallback(() => {
    if (!engine) return;
    setIsAgencyMode(false);
    engine.disableTracking();
    engine.disableSensorimotor();
    setCreatures([]);
    setLargestCreature(null);
  }, [engine]);

  const handleSetObstacles = useCallback(
    (pattern: ObstaclePattern) => {
      if (!engine) return;
      setObstaclePattern(pattern);
      engine.setObstacles(pattern);
    },
    [engine],
  );

  const handleSetTarget = useCallback(() => {
    if (!engine) return;
    engine.setTargetGradient(targetX, targetY);
  }, [engine, targetX, targetY]);

  const handleMotorInfluenceChange = useCallback(
    (value: number) => {
      setMotorInfluence(value);
      if (engine && isAgencyMode) {
        engine.setSensorimotorParams({ motorInfluence: value });
      }
    },
    [engine, isAgencyMode],
  );

  const handleShowObstaclesChange = useCallback(
    (show: boolean) => {
      setShowObstacles(show);
      if (engine) {
        engine.setShowObstacles(show);
      }
    },
    [engine],
  );

  return (
    <div className="mt-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-zinc-300">Sensorimotor Agency</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded ${isAgencyMode ? "bg-blue-600" : "bg-zinc-700"}`}
        >
          {isAgencyMode ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Enable/Disable */}
      <div className="flex gap-2 mb-4">
        {!isAgencyMode ? (
          <button
            onClick={handleEnableAgency}
            disabled={!engine}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
          >
            Enable Agency
          </button>
        ) : (
          <button
            onClick={handleDisableAgency}
            className="px-3 py-1.5 text-sm rounded bg-zinc-600 hover:bg-zinc-700 text-white transition-colors"
          >
            Disable
          </button>
        )}
      </div>

      {/* Obstacle Pattern */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-zinc-500">Obstacle Pattern</label>
          <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showObstacles}
              onChange={(e) => handleShowObstaclesChange(e.target.checked)}
              disabled={!isAgencyMode}
              className="w-3 h-3 rounded border-zinc-600 bg-zinc-800 text-orange-500 focus:ring-orange-500 focus:ring-offset-0 disabled:opacity-50"
            />
            <span className={showObstacles ? "text-orange-400" : ""}>
              Show Obstacles
            </span>
          </label>
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            ["none", "walls", "ring", "maze", "random"] as ObstaclePattern[]
          ).map((pattern) => (
            <button
              key={pattern}
              onClick={() => handleSetObstacles(pattern)}
              disabled={!isAgencyMode}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                obstaclePattern === pattern
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              } disabled:opacity-50`}
            >
              {pattern.charAt(0).toUpperCase() + pattern.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Target Position */}
      <div className="mb-4">
        <label className="text-xs text-zinc-500 block mb-1">
          Target Position
        </label>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            value={targetX}
            onChange={(e) => setTargetX(Number(e.target.value))}
            disabled={!isAgencyMode}
            className="w-20 px-2 py-1 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-300 disabled:opacity-50"
            placeholder="X"
          />
          <input
            type="number"
            value={targetY}
            onChange={(e) => setTargetY(Number(e.target.value))}
            disabled={!isAgencyMode}
            className="w-20 px-2 py-1 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-300 disabled:opacity-50"
            placeholder="Y"
          />
          <button
            onClick={handleSetTarget}
            disabled={!isAgencyMode}
            className="px-2 py-1 text-xs rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 disabled:opacity-50"
          >
            Set Target
          </button>
        </div>
      </div>

      {/* Motor Influence */}
      <div className="mb-4">
        <label className="text-xs text-zinc-500 block mb-1">
          Motor Influence: {motorInfluence.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={motorInfluence}
          onChange={(e) => handleMotorInfluenceChange(Number(e.target.value))}
          disabled={!isAgencyMode}
          className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
        />
      </div>

      {/* Creature Tracking Display */}
      {isAgencyMode && (
        <div className="mb-4 p-3 bg-zinc-800 rounded">
          <h4 className="text-xs font-medium text-zinc-400 mb-2">
            Creature Tracking
          </h4>
          {largestCreature ? (
            <div className="space-y-1">
              <div className="text-xs text-green-400">
                Primary Creature #{largestCreature.id}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-zinc-400">
                <span>
                  Mass:{" "}
                  <span className="text-zinc-200">
                    {largestCreature.mass.toFixed(1)}
                  </span>
                </span>
                <span>
                  Pos:{" "}
                  <span className="text-zinc-200">
                    ({largestCreature.x.toFixed(0)},{" "}
                    {largestCreature.y.toFixed(0)})
                  </span>
                </span>
                <span>
                  Vel:{" "}
                  <span className="text-zinc-200">
                    ({largestCreature.vx.toFixed(2)},{" "}
                    {largestCreature.vy.toFixed(2)})
                  </span>
                </span>
                <span>
                  Speed:{" "}
                  <span className="text-zinc-200">
                    {Math.sqrt(
                      largestCreature.vx ** 2 + largestCreature.vy ** 2,
                    ).toFixed(2)}
                  </span>
                </span>
              </div>
              {creatures.length > 1 && (
                <div className="mt-2 text-xs text-zinc-500">
                  +{creatures.length - 1} other creature
                  {creatures.length > 2 ? "s" : ""} detected
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-zinc-500">No creatures detected</div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-zinc-600 mt-4">
        <p>Enables creature sensing and navigation:</p>
        <ul className="mt-1 space-y-0.5 text-zinc-500">
          <li>• Gradient sensing for chemotaxis</li>
          <li>• Proximity detection for obstacles</li>
          <li>• Motor fields for movement</li>
          <li>• Pheromone trails for signaling</li>
        </ul>
      </div>

      {/* Status indicator */}
      {isAgencyMode && (
        <div className="mt-4 p-2 bg-blue-900/30 border border-blue-800 rounded text-xs text-blue-400">
          Sensorimotor mode active. Set obstacles and targets to influence
          creature behavior.
        </div>
      )}
    </div>
  );
}
