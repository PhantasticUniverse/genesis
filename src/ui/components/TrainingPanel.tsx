/**
 * Training Panel Component
 * UI for neural CA training with GPU-accelerated IMGEP
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  createTrainerState,
  runEpisode,
  updateTrainerState,
  getTrainingStats,
  createInitialParams,
  selectPrior,
  type TrainerState,
} from '../../training/imgep-trainer';
import {
  createGPUTrainer,
  type GPUTrainer,
  type GPUTrainerState,
} from '../../training/gpu-trainer';
import type { Engine } from '../../core/engine';

interface TrainingPanelProps {
  engine: Engine | null;
}

export function TrainingPanel({ engine }: TrainingPanelProps) {
  const [trainerState, setTrainerState] = useState<TrainerState | null>(null);
  const [gpuTrainer, setGpuTrainer] = useState<GPUTrainer | null>(null);
  const [useGPU, setUseGPU] = useState(true); // Default to GPU training
  const [isTraining, setIsTraining] = useState(false);
  const [stats, setStats] = useState({
    totalEpisodes: 0,
    currentDifficulty: 0.1,
    recentSuccessRate: 0,
    avgRecentLoss: 0,
  });
  const abortRef = useRef(false);

  // Cleanup GPU trainer on unmount
  useEffect(() => {
    return () => {
      gpuTrainer?.destroy();
    };
  }, [gpuTrainer]);

  // GPU Training handler
  const handleStartGPUTraining = useCallback(async () => {
    if (!engine) return;

    try {
      const device = engine.getDevice();

      // Check if GPU device is available
      if (!device) {
        console.error('WebGPU device not available. Please use CPU training mode.');
        setUseGPU(false);
        return;
      }

      const trainer = await createGPUTrainer(device, {
        width: 128,
        height: 128,
        stepsPerEpisode: 30,
        learningRate: 0.002,
      });

      setGpuTrainer(trainer);
      setIsTraining(true);

      // Set up update callback
      trainer.onUpdate((state: GPUTrainerState) => {
        setStats({
          totalEpisodes: state.currentStep,
          currentDifficulty: state.currentDifficulty,
          recentSuccessRate: state.successRate,
          avgRecentLoss: state.averageLoss,
        });
      });

      // Start training
      trainer.startTraining();
    } catch (e) {
      console.error('Failed to start GPU training:', e);
      setIsTraining(false);
    }
  }, [engine]);

  // CPU Training handler (fallback)
  const handleStartCPUTraining = useCallback(async () => {
    if (!engine) return;

    // Initialize trainer
    const state = createTrainerState({
      width: 64,
      height: 64,
      stepsPerEpisode: 30,
      gradientsPerEpisode: 50,
      learningRate: 0.002,
    });

    setTrainerState(state);
    setIsTraining(true);
    abortRef.current = false;

    // Create initial seed state
    const seedState = new Float32Array(64 * 64);
    // Place a blob in the center
    for (let y = 28; y < 36; y++) {
      for (let x = 28; x < 36; x++) {
        const dx = x - 32;
        const dy = y - 32;
        const r = Math.sqrt(dx * dx + dy * dy);
        seedState[y * 64 + x] = Math.max(0, 1 - r / 5);
      }
    }

    // Initialize parameters
    let params = createInitialParams(5);

    // Training loop
    while (!abortRef.current) {
      // Check for prior from history
      const prior = selectPrior(state, state.currentDifficulty);
      if (prior) {
        params = prior;
      }

      // Run episode
      const result = runEpisode(state, seedState, params);

      // Update state
      updateTrainerState(state, {
        params: result.updatedParams,
        startState: seedState,
        targetDistance: state.currentDifficulty,
        finalLoss: result.finalLoss,
        success: result.success,
      });

      // Use improved params for next episode
      params = result.updatedParams;

      // Update UI stats
      const newStats = getTrainingStats(state);
      setStats(newStats);

      // Allow UI to update
      await new Promise(resolve => setTimeout(resolve, 10));

      // Stop if we've reached max difficulty with high success
      if (newStats.currentDifficulty >= 0.8 && newStats.recentSuccessRate >= 0.9) {
        break;
      }
    }

    setIsTraining(false);
  }, [engine]);

  const handleStartTraining = useCallback(async () => {
    if (useGPU) {
      await handleStartGPUTraining();
    } else {
      await handleStartCPUTraining();
    }
  }, [useGPU, handleStartGPUTraining, handleStartCPUTraining]);

  const handleStopTraining = useCallback(() => {
    abortRef.current = true;
    if (gpuTrainer) {
      gpuTrainer.stopTraining();
    }
    setIsTraining(false);
  }, [gpuTrainer]);

  return (
    <div className="mt-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-zinc-300">Neural CA Training</h3>
        <span className={`text-xs px-2 py-0.5 rounded ${isTraining ? 'bg-orange-600' : 'bg-zinc-700'}`}>
          {isTraining ? 'Training' : 'Idle'}
        </span>
      </div>

      {/* GPU/CPU Toggle */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setUseGPU(true)}
          disabled={isTraining}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            useGPU
              ? 'bg-green-600 text-white'
              : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
          } disabled:opacity-50`}
        >
          GPU
        </button>
        <button
          onClick={() => setUseGPU(false)}
          disabled={isTraining}
          className={`px-2 py-1 text-xs rounded transition-colors ${
            !useGPU
              ? 'bg-yellow-600 text-white'
              : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
          } disabled:opacity-50`}
        >
          CPU
        </button>
        <span className="text-xs text-zinc-500">
          {useGPU ? '128×128 grid' : '64×64 grid'}
        </span>
      </div>

      {/* Control buttons */}
      <div className="flex gap-2 mb-4">
        {!isTraining ? (
          <button
            onClick={handleStartTraining}
            disabled={!engine}
            className="px-3 py-1.5 text-sm rounded bg-orange-600 hover:bg-orange-700 text-white transition-colors disabled:opacity-50"
          >
            Start {useGPU ? 'GPU' : 'CPU'} Training
          </button>
        ) : (
          <button
            onClick={handleStopTraining}
            className="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Stop
          </button>
        )}
      </div>

      {/* Training stats */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-4">
        <div className="p-2 bg-zinc-800 rounded">
          <div className="text-zinc-500">Episodes</div>
          <div className="text-zinc-300 font-mono">{stats.totalEpisodes}</div>
        </div>
        <div className="p-2 bg-zinc-800 rounded">
          <div className="text-zinc-500">Difficulty</div>
          <div className="text-zinc-300 font-mono">{(stats.currentDifficulty * 100).toFixed(0)}%</div>
        </div>
        <div className="p-2 bg-zinc-800 rounded">
          <div className="text-zinc-500">Success Rate</div>
          <div className={`font-mono ${stats.recentSuccessRate >= 0.7 ? 'text-green-400' : 'text-zinc-300'}`}>
            {(stats.recentSuccessRate * 100).toFixed(0)}%
          </div>
        </div>
        <div className="p-2 bg-zinc-800 rounded">
          <div className="text-zinc-500">Avg Loss</div>
          <div className="text-zinc-300 font-mono">{stats.avgRecentLoss.toFixed(4)}</div>
        </div>
      </div>

      {/* Difficulty progress bar */}
      <div className="mb-4">
        <div className="text-xs text-zinc-500 mb-1">Curriculum Progress</div>
        <div className="h-2 bg-zinc-700 rounded overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 transition-all duration-300"
            style={{ width: `${(stats.currentDifficulty / 0.8) * 100}%` }}
          />
        </div>
      </div>

      {/* Info */}
      <div className="text-xs text-zinc-600">
        <p>IMGEP training with adaptive curriculum:</p>
        <ul className="mt-1 space-y-0.5 text-zinc-500">
          <li>• Learns movement through gradient descent</li>
          <li>• Progressively increases target distance</li>
          <li>• Uses history for parameter initialization</li>
        </ul>
      </div>

      {/* GPU training status */}
      {useGPU ? (
        <div className="mt-4 p-2 bg-green-900/30 border border-green-800 rounded text-xs text-green-400">
          GPU-accelerated training enabled. Forward and backward passes run on WebGPU compute shaders.
        </div>
      ) : (
        <div className="mt-4 p-2 bg-yellow-900/30 border border-yellow-800 rounded text-xs text-yellow-400">
          CPU training mode. For faster training, enable GPU mode above.
        </div>
      )}
    </div>
  );
}
