/**
 * Lotka-Volterra Population Dynamics
 *
 * Implements classic and extended predator-prey models:
 * - Classic Lotka-Volterra
 * - Logistic prey growth
 * - Holling Type II/III functional responses
 * - Rosenzweig-MacArthur model
 * - Beddington-DeAngelis with mutual interference
 */

import type {
  LotkaVolterraParams,
  RosenzweigMacArthurParams,
  FunctionalResponseType,
  PhasePoint,
} from "./types";

/**
 * Classic Lotka-Volterra equations (no carrying capacity)
 *
 * dH/dt = αH - βHP
 * dP/dt = δHP - γP
 *
 * where:
 * - H = prey density
 * - P = predator density
 * - α = prey growth rate
 * - β = predation rate
 * - δ = predator efficiency (conversion of prey to predator)
 * - γ = predator death rate
 */
export function classicLotkaVolterra(
  prey: number,
  predator: number,
  params: LotkaVolterraParams,
): { dPrey: number; dPredator: number } {
  const {
    preyGrowthRate,
    predationRate,
    predatorEfficiency,
    predatorDeathRate,
  } = params;

  const dPrey = preyGrowthRate * prey - predationRate * prey * predator;
  const dPredator =
    predatorEfficiency * predationRate * prey * predator -
    predatorDeathRate * predator;

  return { dPrey, dPredator };
}

/**
 * Logistic Lotka-Volterra (prey has carrying capacity)
 *
 * dH/dt = αH(1 - H/K) - βHP
 * dP/dt = δHP - γP
 */
export function logisticLotkaVolterra(
  prey: number,
  predator: number,
  params: LotkaVolterraParams,
): { dPrey: number; dPredator: number } {
  const {
    preyGrowthRate,
    preyCapacity,
    predationRate,
    predatorEfficiency,
    predatorDeathRate,
  } = params;

  // Logistic growth for prey
  const logisticGrowth =
    preyCapacity > 0
      ? preyGrowthRate * prey * (1 - prey / preyCapacity)
      : preyGrowthRate * prey;

  const dPrey = logisticGrowth - predationRate * prey * predator;
  const dPredator =
    predatorEfficiency * predationRate * prey * predator -
    predatorDeathRate * predator;

  return { dPrey, dPredator };
}

/**
 * Holling Type II functional response
 * f(H) = aH / (1 + ahH)
 *
 * Represents handling time - predators can only eat so fast
 */
export function hollingTypeII(
  preyDensity: number,
  attackRate: number,
  handlingTime: number,
): number {
  return (
    (attackRate * preyDensity) / (1 + attackRate * handlingTime * preyDensity)
  );
}

/**
 * Holling Type III functional response
 * f(H) = aH² / (1 + ahH²)
 *
 * Represents prey switching - low attack rate at low prey density
 */
export function hollingTypeIII(
  preyDensity: number,
  attackRate: number,
  handlingTime: number,
): number {
  const H2 = preyDensity * preyDensity;
  return (attackRate * H2) / (1 + attackRate * handlingTime * H2);
}

/**
 * Get functional response based on type
 */
export function functionalResponse(
  preyDensity: number,
  attackRate: number,
  handlingTime: number,
  responseType: FunctionalResponseType,
): number {
  switch (responseType) {
    case "linear":
      return attackRate * preyDensity;
    case "holling-ii":
      return hollingTypeII(preyDensity, attackRate, handlingTime);
    case "holling-iii":
      return hollingTypeIII(preyDensity, attackRate, handlingTime);
    default:
      return attackRate * preyDensity;
  }
}

/**
 * Rosenzweig-MacArthur model
 * Adds Holling Type II to logistic prey growth
 *
 * dH/dt = rH(1 - H/K) - aHP/(1 + ahH)
 * dP/dt = eaHP/(1 + ahH) - dP
 */
export function rosenzweigMacArthur(
  prey: number,
  predator: number,
  params: RosenzweigMacArthurParams,
): { dPrey: number; dPredator: number } {
  const {
    preyGrowthRate,
    preyCapacity,
    predationRate,
    handlingTime,
    predatorEfficiency,
    predatorDeathRate,
    predatorIntracompetition,
  } = params;

  // Logistic prey growth
  const logisticGrowth =
    preyCapacity > 0
      ? preyGrowthRate * prey * (1 - prey / preyCapacity)
      : preyGrowthRate * prey;

  // Holling Type II predation
  const consumption = hollingTypeII(prey, predationRate, handlingTime);

  // Predator intra-specific competition
  const competition = predatorIntracompetition * predator * predator;

  const dPrey = logisticGrowth - consumption * predator;
  const dPredator =
    predatorEfficiency * consumption * predator -
    predatorDeathRate * predator -
    competition;

  return { dPrey, dPredator };
}

/**
 * Beddington-DeAngelis functional response
 * f(H,P) = aH / (1 + ahH + cP)
 *
 * Adds mutual predator interference
 */
export function beddingtonDeAngelis(
  prey: number,
  predator: number,
  attackRate: number,
  handlingTime: number,
  interference: number,
): number {
  return (
    (attackRate * prey) /
    (1 + attackRate * handlingTime * prey + interference * predator)
  );
}

/**
 * Full Beddington-DeAngelis model
 */
export function beddingtonDeAngelisModel(
  prey: number,
  predator: number,
  params: LotkaVolterraParams,
): { dPrey: number; dPredator: number } {
  const {
    preyGrowthRate,
    preyCapacity,
    predationRate,
    handlingTime,
    mutualInterference,
    predatorEfficiency,
    predatorDeathRate,
  } = params;

  // Logistic prey growth
  const logisticGrowth =
    preyCapacity > 0
      ? preyGrowthRate * prey * (1 - prey / preyCapacity)
      : preyGrowthRate * prey;

  // Beddington-DeAngelis consumption
  const consumption = beddingtonDeAngelis(
    prey,
    predator,
    predationRate,
    handlingTime,
    mutualInterference,
  );

  const dPrey = logisticGrowth - consumption * predator;
  const dPredator =
    predatorEfficiency * consumption * predator - predatorDeathRate * predator;

  return { dPrey, dPredator };
}

/**
 * Equilibrium points for classic Lotka-Volterra
 */
export function classicEquilibrium(params: LotkaVolterraParams): {
  trivial: PhasePoint;
  coexistence: PhasePoint;
} {
  const {
    preyGrowthRate,
    predationRate,
    predatorEfficiency,
    predatorDeathRate,
  } = params;

  // Trivial equilibrium (extinction)
  const trivial = { step: 0, preyDensity: 0, predatorDensity: 0 };

  // Coexistence equilibrium
  const preyEq = predatorDeathRate / (predatorEfficiency * predationRate);
  const predatorEq = preyGrowthRate / predationRate;

  const coexistence = {
    step: 0,
    preyDensity: preyEq,
    predatorDensity: predatorEq,
  };

  return { trivial, coexistence };
}

/**
 * Equilibrium for logistic Lotka-Volterra
 */
export function logisticEquilibrium(params: LotkaVolterraParams): {
  extinction: PhasePoint;
  preyOnly: PhasePoint;
  coexistence: PhasePoint;
} {
  const {
    preyGrowthRate,
    preyCapacity,
    predationRate,
    predatorEfficiency,
    predatorDeathRate,
  } = params;

  const extinction = { step: 0, preyDensity: 0, predatorDensity: 0 };
  const preyOnly = { step: 0, preyDensity: preyCapacity, predatorDensity: 0 };

  // Coexistence equilibrium (if exists)
  const preyEq = predatorDeathRate / (predatorEfficiency * predationRate);
  const predatorEq =
    (preyGrowthRate / predationRate) * (1 - preyEq / preyCapacity);

  const coexistence = {
    step: 0,
    preyDensity: preyEq > 0 ? preyEq : 0,
    predatorDensity: predatorEq > 0 ? predatorEq : 0,
  };

  return { extinction, preyOnly, coexistence };
}

/**
 * Stability analysis for logistic model
 * Returns whether coexistence equilibrium is stable
 */
export function isCoexistenceStable(params: LotkaVolterraParams): boolean {
  const {
    preyCapacity,
    predationRate,
    predatorEfficiency,
    predatorDeathRate,
  } = params;

  // Coexistence prey equilibrium
  const preyEq = predatorDeathRate / (predatorEfficiency * predationRate);

  // Stable if prey equilibrium is less than K/2
  // (Otherwise, paradox of enrichment - limit cycles occur)
  return preyEq < preyCapacity / 2;
}

/**
 * Simulate Lotka-Volterra dynamics over time
 */
export function simulateLotkaVolterra(
  initialPrey: number,
  initialPredator: number,
  params: LotkaVolterraParams,
  steps: number,
  dt: number = 0.1,
  model: "classic" | "logistic" | "rosenzweig" | "beddington" = "logistic",
): PhasePoint[] {
  const trajectory: PhasePoint[] = [];

  let prey = initialPrey;
  let predator = initialPredator;

  for (let step = 0; step < steps; step++) {
    trajectory.push({
      step,
      preyDensity: prey,
      predatorDensity: predator,
    });

    let dPrey: number;
    let dPredator: number;

    switch (model) {
      case "classic":
        ({ dPrey, dPredator } = classicLotkaVolterra(prey, predator, params));
        break;
      case "logistic":
        ({ dPrey, dPredator } = logisticLotkaVolterra(prey, predator, params));
        break;
      case "rosenzweig":
        ({ dPrey, dPredator } = rosenzweigMacArthur(
          prey,
          predator,
          params as RosenzweigMacArthurParams,
        ));
        break;
      case "beddington":
        ({ dPrey, dPredator } = beddingtonDeAngelisModel(
          prey,
          predator,
          params,
        ));
        break;
    }

    // Euler integration
    prey = Math.max(0, prey + dPrey * dt);
    predator = Math.max(0, predator + dPredator * dt);
  }

  return trajectory;
}

/**
 * Runge-Kutta 4th order integration for more accuracy
 */
export function simulateRK4(
  initialPrey: number,
  initialPredator: number,
  params: LotkaVolterraParams,
  steps: number,
  dt: number = 0.1,
): PhasePoint[] {
  const trajectory: PhasePoint[] = [];

  let H = initialPrey;
  let P = initialPredator;

  const derivatives = (h: number, p: number) =>
    logisticLotkaVolterra(h, p, params);

  for (let step = 0; step < steps; step++) {
    trajectory.push({ step, preyDensity: H, predatorDensity: P });

    // RK4 integration
    const k1 = derivatives(H, P);
    const k2 = derivatives(
      H + 0.5 * dt * k1.dPrey,
      P + 0.5 * dt * k1.dPredator,
    );
    const k3 = derivatives(
      H + 0.5 * dt * k2.dPrey,
      P + 0.5 * dt * k2.dPredator,
    );
    const k4 = derivatives(H + dt * k3.dPrey, P + dt * k3.dPredator);

    H = Math.max(
      0,
      H + (dt / 6) * (k1.dPrey + 2 * k2.dPrey + 2 * k3.dPrey + k4.dPrey),
    );
    P = Math.max(
      0,
      P +
        (dt / 6) *
          (k1.dPredator + 2 * k2.dPredator + 2 * k3.dPredator + k4.dPredator),
    );
  }

  return trajectory;
}

/**
 * Calculate oscillation period from trajectory
 */
export function calculatePeriod(trajectory: PhasePoint[]): number | null {
  if (trajectory.length < 3) return null;

  // Find peaks in prey population
  const peaks: number[] = [];
  for (let i = 1; i < trajectory.length - 1; i++) {
    if (
      trajectory[i].preyDensity > trajectory[i - 1].preyDensity &&
      trajectory[i].preyDensity > trajectory[i + 1].preyDensity
    ) {
      peaks.push(trajectory[i].step);
    }
  }

  if (peaks.length < 2) return null;

  // Average period between peaks
  let totalPeriod = 0;
  for (let i = 1; i < peaks.length; i++) {
    totalPeriod += peaks[i] - peaks[i - 1];
  }

  return totalPeriod / (peaks.length - 1);
}

/**
 * Calculate amplitude from trajectory
 */
export function calculateAmplitude(trajectory: PhasePoint[]): {
  preyAmplitude: number;
  predatorAmplitude: number;
} {
  if (trajectory.length === 0) {
    return { preyAmplitude: 0, predatorAmplitude: 0 };
  }

  let minPrey = Infinity;
  let maxPrey = -Infinity;
  let minPredator = Infinity;
  let maxPredator = -Infinity;

  for (const point of trajectory) {
    minPrey = Math.min(minPrey, point.preyDensity);
    maxPrey = Math.max(maxPrey, point.preyDensity);
    minPredator = Math.min(minPredator, point.predatorDensity);
    maxPredator = Math.max(maxPredator, point.predatorDensity);
  }

  return {
    preyAmplitude: (maxPrey - minPrey) / 2,
    predatorAmplitude: (maxPredator - minPredator) / 2,
  };
}
