/**
 * Engine State Machine
 * Defines states and transitions for the GENESIS simulation engine
 */

/**
 * Engine lifecycle states
 */
export type EngineState =
  | "uninitialized"
  | "idle"
  | "running"
  | "paused"
  | "transitioning"
  | "error"
  | "destroyed";

/**
 * Simulation modes - determines which compute pipeline is used
 */
export type SimulationMode =
  | "discrete" // Game of Life and other discrete CAs
  | "continuous" // Single-kernel Lenia
  | "multikernel" // Multi-kernel Lenia
  | "multichannel" // Multi-species ecology
  | "particle" // Particle-Lenia hybrid
  | "sensorimotor"; // Sensorimotor control

/**
 * State transition events
 */
export type StateEvent =
  | "INITIALIZE"
  | "START"
  | "STOP"
  | "PAUSE"
  | "RESUME"
  | "STEP"
  | "RESET"
  | "CHANGE_MODE"
  | "ERROR"
  | "DESTROY";

/**
 * Valid state transitions
 */
export const STATE_TRANSITIONS: Record<EngineState, StateEvent[]> = {
  uninitialized: ["INITIALIZE", "DESTROY"],
  idle: ["START", "STEP", "RESET", "CHANGE_MODE", "DESTROY"],
  running: ["STOP", "PAUSE", "ERROR", "DESTROY"],
  paused: ["RESUME", "STOP", "STEP", "RESET", "DESTROY"],
  transitioning: ["START", "ERROR", "DESTROY"],
  error: ["RESET", "DESTROY"],
  destroyed: [],
};

/**
 * State transition result
 */
export interface StateTransitionResult {
  success: boolean;
  previousState: EngineState;
  newState: EngineState;
  event: StateEvent;
  error?: Error;
}

/**
 * Compute the next state given current state and event
 */
export function getNextState(
  currentState: EngineState,
  event: StateEvent,
): EngineState | null {
  // Check if transition is valid
  if (!STATE_TRANSITIONS[currentState].includes(event)) {
    return null;
  }

  // Define state transitions
  switch (event) {
    case "INITIALIZE":
      return currentState === "uninitialized" ? "idle" : null;

    case "START":
      return currentState === "idle" || currentState === "transitioning"
        ? "running"
        : null;

    case "STOP":
      return currentState === "running" || currentState === "paused"
        ? "idle"
        : null;

    case "PAUSE":
      return currentState === "running" ? "paused" : null;

    case "RESUME":
      return currentState === "paused" ? "running" : null;

    case "STEP":
      return currentState; // Stay in same state (idle or paused)

    case "RESET":
      return currentState === "idle" ||
        currentState === "paused" ||
        currentState === "error"
        ? "idle"
        : null;

    case "CHANGE_MODE":
      return currentState === "idle" ? "transitioning" : null;

    case "ERROR":
      return "error";

    case "DESTROY":
      return "destroyed";

    default:
      return null;
  }
}

/**
 * State change callback type
 */
export type StateChangeCallback = (
  previousState: EngineState,
  newState: EngineState,
  event: StateEvent,
) => void;

/**
 * Engine State Manager
 * Manages state transitions with validation and callbacks
 */
export class EngineStateManager {
  private state: EngineState = "uninitialized";
  private mode: SimulationMode = "discrete";
  private callbacks: Set<StateChangeCallback> = new Set();
  private transitionLock = false;

  /**
   * Get current engine state
   */
  getState(): EngineState {
    return this.state;
  }

  /**
   * Get current simulation mode
   */
  getMode(): SimulationMode {
    return this.mode;
  }

  /**
   * Set simulation mode (only valid when idle)
   */
  setMode(mode: SimulationMode): boolean {
    if (this.state !== "idle" && this.state !== "transitioning") {
      return false;
    }
    this.mode = mode;
    return true;
  }

  /**
   * Check if a transition is valid
   */
  canTransition(event: StateEvent): boolean {
    if (this.transitionLock) return false;
    return getNextState(this.state, event) !== null;
  }

  /**
   * Attempt a state transition
   */
  transition(event: StateEvent): StateTransitionResult {
    const previousState = this.state;

    if (this.transitionLock) {
      return {
        success: false,
        previousState,
        newState: previousState,
        event,
        error: new Error("State transition in progress"),
      };
    }

    const nextState = getNextState(this.state, event);

    if (nextState === null) {
      return {
        success: false,
        previousState,
        newState: previousState,
        event,
        error: new Error(`Invalid transition: ${previousState} + ${event}`),
      };
    }

    this.transitionLock = true;
    this.state = nextState;

    // Notify callbacks
    for (const callback of this.callbacks) {
      try {
        callback(previousState, nextState, event);
      } catch (error) {
        console.error("State change callback error:", error);
      }
    }

    this.transitionLock = false;

    return {
      success: true,
      previousState,
      newState: nextState,
      event,
    };
  }

  /**
   * Force state (for initialization/error recovery)
   */
  forceState(state: EngineState): void {
    const previousState = this.state;
    this.state = state;

    for (const callback of this.callbacks) {
      try {
        callback(previousState, state, "INITIALIZE");
      } catch (error) {
        console.error("State change callback error:", error);
      }
    }
  }

  /**
   * Register state change callback
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Check convenience methods
   */
  isRunning(): boolean {
    return this.state === "running";
  }

  isIdle(): boolean {
    return this.state === "idle";
  }

  isPaused(): boolean {
    return this.state === "paused";
  }

  isTransitioning(): boolean {
    return this.state === "transitioning";
  }

  canStep(): boolean {
    return this.state === "idle" || this.state === "paused";
  }

  canStart(): boolean {
    return this.state === "idle";
  }

  canStop(): boolean {
    return this.state === "running" || this.state === "paused";
  }
}

/**
 * Create a new state manager
 */
export function createStateManager(): EngineStateManager {
  return new EngineStateManager();
}
