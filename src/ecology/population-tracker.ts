/**
 * Population Tracker
 *
 * Tracks population statistics over time for ecosystem analysis:
 * - Total mass and density per species
 * - Spatial distribution (centroid, spread)
 * - Time series for plotting
 * - Ecosystem health metrics
 */

import type {
  PopulationStats,
  PopulationTimeSeries,
  EcosystemState,
  EcosystemHealth,
  PhasePoint,
  Species,
} from "./types";

/**
 * Configuration for population tracking
 */
export interface TrackerConfig {
  speciesIds: string[];
  historyLength: number; // How many steps to keep
  sampleInterval: number; // Sample every N steps
  rollingWindowSize: number; // For moving average
}

const DEFAULT_CONFIG: TrackerConfig = {
  speciesIds: [],
  historyLength: 1000,
  sampleInterval: 1,
  rollingWindowSize: 50,
};

/**
 * Population Tracker class
 */
export class PopulationTracker {
  private config: TrackerConfig;
  private history: Map<string, PopulationTimeSeries> = new Map();
  private phaseHistory: PhasePoint[] = [];
  private currentStep = 0;
  private gridWidth = 0;
  private gridHeight = 0;

  constructor(config: Partial<TrackerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize time series for each species
    for (const id of this.config.speciesIds) {
      this.history.set(id, {
        speciesId: id,
        steps: [],
        populations: [],
        means: [],
      });
    }
  }

  /**
   * Set grid dimensions
   */
  setGridSize(width: number, height: number): void {
    this.gridWidth = width;
    this.gridHeight = height;
  }

  /**
   * Add a species to track
   */
  addSpecies(id: string): void {
    if (!this.history.has(id)) {
      this.history.set(id, {
        speciesId: id,
        steps: [],
        populations: [],
        means: [],
      });
    }
  }

  /**
   * Update with new population data from a simulation step
   */
  update(step: number, populations: Map<string, Float32Array>): void {
    this.currentStep = step;

    // Only sample at configured interval
    if (step % this.config.sampleInterval !== 0) {
      return;
    }

    // Calculate stats for each species
    for (const [speciesId, data] of populations.entries()) {
      const series = this.history.get(speciesId);
      if (!series) continue;

      // Calculate total population
      const totalMass = data.reduce((sum, val) => sum + val, 0);

      // Add to history
      series.steps.push(step);
      series.populations.push(totalMass);

      // Calculate rolling mean
      const windowStart = Math.max(
        0,
        series.populations.length - this.config.rollingWindowSize,
      );
      const window = series.populations.slice(windowStart);
      const mean = window.reduce((a, b) => a + b, 0) / window.length;
      series.means.push(mean);

      // Trim history if too long
      if (series.steps.length > this.config.historyLength) {
        series.steps.shift();
        series.populations.shift();
        series.means.shift();
      }
    }

    // Update phase space history (for predator-prey)
    if (populations.size >= 2) {
      const ids = Array.from(populations.keys());
      const preyData = populations.get(ids[0]);
      const predatorData = populations.get(ids[1]);

      if (preyData && predatorData) {
        const preyTotal = preyData.reduce((sum, val) => sum + val, 0);
        const predatorTotal = predatorData.reduce((sum, val) => sum + val, 0);

        this.phaseHistory.push({
          step,
          preyDensity: preyTotal,
          predatorDensity: predatorTotal,
        });

        // Trim phase history
        if (this.phaseHistory.length > this.config.historyLength) {
          this.phaseHistory.shift();
        }
      }
    }
  }

  /**
   * Get detailed stats for a species at current step
   */
  getStats(speciesId: string, data: Float32Array): PopulationStats {
    let totalMass = 0;
    let maxDensity = 0;
    let occupiedCells = 0;
    let sumX = 0;
    let sumY = 0;

    const threshold = 0.01;

    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      totalMass += val;

      if (val > maxDensity) maxDensity = val;

      if (val > threshold) {
        occupiedCells++;
        const x = i % this.gridWidth;
        const y = Math.floor(i / this.gridWidth);
        sumX += x * val;
        sumY += y * val;
      }
    }

    const meanDensity = totalMass / data.length;
    const centroidX = totalMass > 0 ? sumX / totalMass : this.gridWidth / 2;
    const centroidY = totalMass > 0 ? sumY / totalMass : this.gridHeight / 2;

    // Calculate spread (standard deviation from centroid)
    let spreadSum = 0;
    if (totalMass > 0) {
      for (let i = 0; i < data.length; i++) {
        const val = data[i];
        if (val > threshold) {
          const x = i % this.gridWidth;
          const y = Math.floor(i / this.gridWidth);
          const dx = x - centroidX;
          const dy = y - centroidY;
          spreadSum += val * (dx * dx + dy * dy);
        }
      }
    }
    const spreadRadius = totalMass > 0 ? Math.sqrt(spreadSum / totalMass) : 0;

    return {
      speciesId,
      totalMass,
      meanDensity,
      maxDensity,
      occupiedCells,
      centroidX,
      centroidY,
      spreadRadius,
    };
  }

  /**
   * Get ecosystem state
   */
  getEcosystemState(
    step: number,
    populations: Map<string, Float32Array>,
  ): EcosystemState {
    const populationStats: PopulationStats[] = [];
    let totalBiomass = 0;

    for (const [speciesId, data] of populations.entries()) {
      const stats = this.getStats(speciesId, data);
      populationStats.push(stats);
      totalBiomass += stats.totalMass;
    }

    // Calculate Shannon diversity
    const diversity = this.calculateDiversity(populationStats, totalBiomass);

    // Calculate stability (coefficient of variation of total biomass)
    const stability = this.calculateStability();

    return {
      step,
      timestamp: Date.now(),
      populations: populationStats,
      totalBiomass,
      diversity,
      stability,
    };
  }

  /**
   * Calculate Shannon diversity index
   * H' = -Σ(pi * ln(pi)) where pi is proportion of species i
   */
  private calculateDiversity(
    stats: PopulationStats[],
    totalBiomass: number,
  ): number {
    if (totalBiomass === 0) return 0;

    let diversity = 0;
    for (const s of stats) {
      const proportion = s.totalMass / totalBiomass;
      if (proportion > 0) {
        diversity -= proportion * Math.log(proportion);
      }
    }

    return diversity;
  }

  /**
   * Calculate stability (inverse of coefficient of variation)
   */
  private calculateStability(): number {
    // Use total biomass from all species
    const allPopulations: number[] = [];

    for (const series of this.history.values()) {
      for (let i = 0; i < series.populations.length; i++) {
        if (!allPopulations[i]) allPopulations[i] = 0;
        allPopulations[i] += series.populations[i];
      }
    }

    if (allPopulations.length < 2) return 1;

    const mean =
      allPopulations.reduce((a, b) => a + b, 0) / allPopulations.length;
    if (mean === 0) return 0;

    const variance =
      allPopulations.reduce((sum, val) => sum + (val - mean) ** 2, 0) /
      allPopulations.length;
    const cv = Math.sqrt(variance) / mean;

    // Return stability as 1 / (1 + CV) so higher = more stable
    return 1 / (1 + cv);
  }

  /**
   * Get ecosystem health metrics
   */
  getHealth(populations: Map<string, Float32Array>): EcosystemHealth {
    const stats: PopulationStats[] = [];
    let totalBiomass = 0;

    for (const [speciesId, data] of populations.entries()) {
      const s = this.getStats(speciesId, data);
      stats.push(s);
      totalBiomass += s.totalMass;
    }

    // Biodiversity: number of species with significant population
    const biodiversity = stats.filter((s) => s.totalMass > 0.01).length;

    // Evenness: how equal the populations are (Pielou's J)
    const diversity = this.calculateDiversity(stats, totalBiomass);
    const maxDiversity = Math.log(stats.length);
    const evenness = maxDiversity > 0 ? diversity / maxDiversity : 0;

    // Productivity: recent biomass change
    let productivity = 0;
    for (const series of this.history.values()) {
      if (series.populations.length >= 10) {
        const recent = series.populations.slice(-10);
        const older = series.populations.slice(-20, -10);
        if (older.length > 0) {
          const recentMean = recent.reduce((a, b) => a + b, 0) / recent.length;
          const olderMean = older.reduce((a, b) => a + b, 0) / older.length;
          productivity += (recentMean - olderMean) / Math.max(olderMean, 0.01);
        }
      }
    }
    productivity /= Math.max(this.history.size, 1);

    // Resilience and stability from history
    const stability = this.calculateStability();
    const resilience = stability; // Simplified - could be more sophisticated

    return {
      biodiversity,
      evenness,
      productivity,
      resilience,
      stability,
    };
  }

  /**
   * Get time series for a species
   */
  getTimeSeries(speciesId: string): PopulationTimeSeries | null {
    return this.history.get(speciesId) ?? null;
  }

  /**
   * Get all time series
   */
  getAllTimeSeries(): PopulationTimeSeries[] {
    return Array.from(this.history.values());
  }

  /**
   * Get phase space trajectory
   */
  getPhaseTrajectory(): PhasePoint[] {
    return this.phaseHistory;
  }

  /**
   * Get recent phase points
   */
  getRecentPhase(count: number = 100): PhasePoint[] {
    return this.phaseHistory.slice(-count);
  }

  /**
   * Reset all history
   */
  reset(): void {
    this.currentStep = 0;
    this.phaseHistory = [];
    for (const series of this.history.values()) {
      series.steps = [];
      series.populations = [];
      series.means = [];
    }
  }

  /**
   * Export history as JSON
   */
  exportHistory(): object {
    return {
      config: this.config,
      currentStep: this.currentStep,
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      timeSeries: Object.fromEntries(this.history),
      phaseHistory: this.phaseHistory,
    };
  }

  /**
   * Import history from JSON
   */
  importHistory(data: {
    config?: Partial<TrackerConfig>;
    currentStep?: number;
    gridWidth?: number;
    gridHeight?: number;
    timeSeries?: Record<string, PopulationTimeSeries>;
    phaseHistory?: PhasePoint[];
  }): void {
    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }
    if (data.currentStep !== undefined) {
      this.currentStep = data.currentStep;
    }
    if (data.gridWidth !== undefined) {
      this.gridWidth = data.gridWidth;
    }
    if (data.gridHeight !== undefined) {
      this.gridHeight = data.gridHeight;
    }
    if (data.timeSeries) {
      this.history = new Map(Object.entries(data.timeSeries));
    }
    if (data.phaseHistory) {
      this.phaseHistory = data.phaseHistory;
    }
  }
}

/**
 * Create a population tracker for a set of species
 */
export function createPopulationTracker(
  species: Species[],
  config: Partial<TrackerConfig> = {},
): PopulationTracker {
  return new PopulationTracker({
    ...config,
    speciesIds: species.map((s) => s.id),
  });
}
