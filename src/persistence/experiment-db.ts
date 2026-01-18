/**
 * Experiment Database
 * IndexedDB-based storage for experiments, runs, snapshots, and organisms
 *
 * Schema:
 * - experiments: Experiment definitions and metadata
 * - runs: Individual simulation runs within an experiment
 * - snapshots: Point-in-time state captures
 * - organisms: Discovered organisms with genomes and behavior
 * - genealogy: Evolutionary lineage tracking
 */

import type { LeniaGenome } from "../discovery/genome";
import type { MultiKernelConfig } from "../core/types";
import type { BehaviorVector } from "../agency/behavior";

// Database version - increment when schema changes
const DB_VERSION = 1;
const DB_NAME = "genesis-experiments";

// ============================================================================
// Type Definitions
// ============================================================================

export type ExperimentStatus =
  | "created"
  | "running"
  | "paused"
  | "completed"
  | "failed";
export type RunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Experiment definition
 */
export interface Experiment {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  status: ExperimentStatus;
  tags: string[];
  parentId?: string; // For forked experiments
  config: ExperimentConfig;
  metrics?: ExperimentMetrics;
}

export interface ExperimentConfig {
  paradigm: "discrete" | "continuous" | "multikernel" | "multichannel";
  gridSize: { width: number; height: number };
  baseGenome?: LeniaGenome;
  multiKernelConfig?: MultiKernelConfig;
  evolutionConfig?: EvolutionConfig;
  sweepConfig?: SweepConfig;
}

export interface EvolutionConfig {
  populationSize: number;
  generations: number;
  mutationRate: number;
  crossoverRate: number;
  eliteCount: number;
  fitnessMetrics: string[];
}

export interface SweepConfig {
  parameters: ParameterRange[];
  samples: number;
  strategy: "grid" | "random" | "bayesian";
}

export interface ParameterRange {
  name: string;
  min: number;
  max: number;
  step?: number;
}

export interface ExperimentMetrics {
  totalRuns: number;
  completedRuns: number;
  bestFitness: number;
  avgFitness: number;
  totalSteps: number;
  totalDurationMs: number;
}

/**
 * Individual run within an experiment
 */
export interface Run {
  id: string;
  experimentId: string;
  createdAt: number;
  completedAt?: number;
  status: RunStatus;
  seed: number;
  params: Record<string, unknown>;
  metrics: RunMetrics;
  error?: string;
}

export interface RunMetrics {
  steps: number;
  durationMs: number;
  finalMass: number;
  maxMass: number;
  avgMass: number;
  fitness?: number;
  symmetry?: number;
  chaos?: number;
  periodicity?: number;
}

/**
 * Point-in-time state snapshot
 */
export interface Snapshot {
  id: string;
  runId: string;
  step: number;
  createdAt: number;
  state: CompressedState;
  metrics: SnapshotMetrics;
}

export interface CompressedState {
  format: "base64" | "rle";
  width: number;
  height: number;
  data: string; // Base64 or RLE encoded
  compression?: "gzip";
}

export interface SnapshotMetrics {
  mass: number;
  entropy: number;
  creatureCount: number;
}

/**
 * Discovered organism
 */
export interface OrganismRecord {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  genome: LeniaGenome;
  multiKernelConfig?: MultiKernelConfig;
  fitness: number;
  behavior: BehaviorVector;
  thumbnail?: string; // Base64 image
  tags: string[];
  experimentId?: string; // Source experiment
  runId?: string; // Source run
  generation?: number; // Evolution generation
  parentIds?: string[]; // Parent organism IDs
}

/**
 * Genealogy node for phylogenetic tracking
 */
export interface GenealogyNode {
  id: string;
  experimentId: string;
  organismId: string;
  parentIds: string[];
  generation: number;
  createdAt: number;
  fitness: number;
  isElite: boolean;
}

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Open or create the database
 */
export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Experiments store
      if (!db.objectStoreNames.contains("experiments")) {
        const store = db.createObjectStore("experiments", { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("tags", "tags", { unique: false, multiEntry: true });
        store.createIndex("parentId", "parentId", { unique: false });
      }

      // Runs store
      if (!db.objectStoreNames.contains("runs")) {
        const store = db.createObjectStore("runs", { keyPath: "id" });
        store.createIndex("experimentId", "experimentId", { unique: false });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }

      // Snapshots store
      if (!db.objectStoreNames.contains("snapshots")) {
        const store = db.createObjectStore("snapshots", { keyPath: "id" });
        store.createIndex("runId", "runId", { unique: false });
        store.createIndex("step", "step", { unique: false });
      }

      // Organisms store
      if (!db.objectStoreNames.contains("organisms")) {
        const store = db.createObjectStore("organisms", { keyPath: "id" });
        store.createIndex("name", "name", { unique: false });
        store.createIndex("fitness", "fitness", { unique: false });
        store.createIndex("experimentId", "experimentId", { unique: false });
        store.createIndex("tags", "tags", { unique: false, multiEntry: true });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }

      // Genealogy store
      if (!db.objectStoreNames.contains("genealogy")) {
        const store = db.createObjectStore("genealogy", { keyPath: "id" });
        store.createIndex("experimentId", "experimentId", { unique: false });
        store.createIndex("organismId", "organismId", { unique: false });
        store.createIndex("generation", "generation", { unique: false });
        store.createIndex("parentIds", "parentIds", {
          unique: false,
          multiEntry: true,
        });
      }
    };
  });
}

/**
 * Generate a unique ID
 */
export function generateId(prefix = ""): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 9);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

// ============================================================================
// Experiment CRUD
// ============================================================================

export async function createExperiment(
  name: string,
  config: ExperimentConfig,
  options: { description?: string; tags?: string[]; parentId?: string } = {},
): Promise<Experiment> {
  const db = await openDatabase();
  const now = Date.now();

  const experiment: Experiment = {
    id: generateId("exp"),
    name,
    description: options.description,
    createdAt: now,
    updatedAt: now,
    status: "created",
    tags: options.tags ?? [],
    parentId: options.parentId,
    config,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("experiments", "readwrite");
    const store = tx.objectStore("experiments");
    const request = store.add(experiment);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      resolve(experiment);
    };
  });
}

export async function getExperiment(id: string): Promise<Experiment | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("experiments", "readonly");
    const store = tx.objectStore("experiments");
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      resolve(request.result ?? null);
    };
  });
}

export async function updateExperiment(
  id: string,
  updates: Partial<Omit<Experiment, "id" | "createdAt">>,
): Promise<boolean> {
  const db = await openDatabase();
  const existing = await getExperiment(id);

  if (!existing) {
    db.close();
    return false;
  }

  const updated: Experiment = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("experiments", "readwrite");
    const store = tx.objectStore("experiments");
    const request = store.put(updated);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      resolve(true);
    };
  });
}

export async function deleteExperiment(id: string): Promise<boolean> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ["experiments", "runs", "snapshots", "genealogy"],
      "readwrite",
    );

    // Delete experiment
    const expStore = tx.objectStore("experiments");
    expStore.delete(id);

    // Delete related runs
    const runStore = tx.objectStore("runs");
    const runIndex = runStore.index("experimentId");
    const runCursor = runIndex.openCursor(IDBKeyRange.only(id));

    runCursor.onsuccess = () => {
      const cursor = runCursor.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    // Delete related genealogy
    const genStore = tx.objectStore("genealogy");
    const genIndex = genStore.index("experimentId");
    const genCursor = genIndex.openCursor(IDBKeyRange.only(id));

    genCursor.onsuccess = () => {
      const cursor = genCursor.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };
  });
}

export async function listExperiments(
  options: {
    status?: ExperimentStatus;
    tags?: string[];
    limit?: number;
    offset?: number;
  } = {},
): Promise<Experiment[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("experiments", "readonly");
    const store = tx.objectStore("experiments");

    let request: IDBRequest;

    if (options.status) {
      const index = store.index("status");
      request = index.getAll(IDBKeyRange.only(options.status));
    } else {
      request = store.getAll();
    }

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      let results = request.result as Experiment[];

      // Filter by tags if specified
      if (options.tags && options.tags.length > 0) {
        results = results.filter((exp) =>
          options.tags!.some((tag) => exp.tags.includes(tag)),
        );
      }

      // Sort by creation date (newest first)
      results.sort((a, b) => b.createdAt - a.createdAt);

      // Apply pagination
      if (options.offset) {
        results = results.slice(options.offset);
      }
      if (options.limit) {
        results = results.slice(0, options.limit);
      }

      resolve(results);
    };
  });
}

// ============================================================================
// Run CRUD
// ============================================================================

export async function createRun(
  experimentId: string,
  seed: number,
  params: Record<string, unknown>,
): Promise<Run> {
  const db = await openDatabase();

  const run: Run = {
    id: generateId("run"),
    experimentId,
    createdAt: Date.now(),
    status: "pending",
    seed,
    params,
    metrics: {
      steps: 0,
      durationMs: 0,
      finalMass: 0,
      maxMass: 0,
      avgMass: 0,
    },
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("runs", "readwrite");
    const store = tx.objectStore("runs");
    const request = store.add(run);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      resolve(run);
    };
  });
}

export async function getRun(id: string): Promise<Run | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("runs", "readonly");
    const store = tx.objectStore("runs");
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      resolve(request.result ?? null);
    };
  });
}

export async function updateRun(
  id: string,
  updates: Partial<Omit<Run, "id" | "experimentId" | "createdAt">>,
): Promise<boolean> {
  const db = await openDatabase();
  const existing = await getRun(id);

  if (!existing) {
    db.close();
    return false;
  }

  const updated: Run = { ...existing, ...updates };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("runs", "readwrite");
    const store = tx.objectStore("runs");
    const request = store.put(updated);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      resolve(true);
    };
  });
}

export async function listRuns(experimentId: string): Promise<Run[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("runs", "readonly");
    const store = tx.objectStore("runs");
    const index = store.index("experimentId");
    const request = index.getAll(IDBKeyRange.only(experimentId));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      const results = request.result as Run[];
      results.sort((a, b) => a.createdAt - b.createdAt);
      resolve(results);
    };
  });
}

// ============================================================================
// Snapshot CRUD
// ============================================================================

export async function createSnapshot(
  runId: string,
  step: number,
  state: CompressedState,
  metrics: SnapshotMetrics,
): Promise<Snapshot> {
  const db = await openDatabase();

  const snapshot: Snapshot = {
    id: generateId("snap"),
    runId,
    step,
    createdAt: Date.now(),
    state,
    metrics,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readwrite");
    const store = tx.objectStore("snapshots");
    const request = store.add(snapshot);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      resolve(snapshot);
    };
  });
}

export async function listSnapshots(runId: string): Promise<Snapshot[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("snapshots", "readonly");
    const store = tx.objectStore("snapshots");
    const index = store.index("runId");
    const request = index.getAll(IDBKeyRange.only(runId));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      const results = request.result as Snapshot[];
      results.sort((a, b) => a.step - b.step);
      resolve(results);
    };
  });
}

// ============================================================================
// Organism CRUD
// ============================================================================

export async function createOrganism(
  name: string,
  genome: LeniaGenome,
  behavior: BehaviorVector,
  fitness: number,
  options: {
    description?: string;
    tags?: string[];
    experimentId?: string;
    runId?: string;
    generation?: number;
    parentIds?: string[];
    multiKernelConfig?: MultiKernelConfig;
    thumbnail?: string;
  } = {},
): Promise<OrganismRecord> {
  const db = await openDatabase();
  const now = Date.now();

  const organism: OrganismRecord = {
    id: generateId("org"),
    name,
    description: options.description,
    createdAt: now,
    updatedAt: now,
    genome,
    multiKernelConfig: options.multiKernelConfig,
    fitness,
    behavior,
    thumbnail: options.thumbnail,
    tags: options.tags ?? [],
    experimentId: options.experimentId,
    runId: options.runId,
    generation: options.generation,
    parentIds: options.parentIds,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("organisms", "readwrite");
    const store = tx.objectStore("organisms");
    const request = store.add(organism);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      resolve(organism);
    };
  });
}

export async function getOrganism(id: string): Promise<OrganismRecord | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("organisms", "readonly");
    const store = tx.objectStore("organisms");
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      resolve(request.result ?? null);
    };
  });
}

export async function updateOrganism(
  id: string,
  updates: Partial<Omit<OrganismRecord, "id" | "createdAt">>,
): Promise<boolean> {
  const db = await openDatabase();
  const existing = await getOrganism(id);

  if (!existing) {
    db.close();
    return false;
  }

  const updated: OrganismRecord = {
    ...existing,
    ...updates,
    updatedAt: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("organisms", "readwrite");
    const store = tx.objectStore("organisms");
    const request = store.put(updated);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      resolve(true);
    };
  });
}

export async function listOrganisms(
  options: {
    experimentId?: string;
    tags?: string[];
    minFitness?: number;
    limit?: number;
    offset?: number;
    sortBy?: "fitness" | "createdAt" | "name";
    sortOrder?: "asc" | "desc";
  } = {},
): Promise<OrganismRecord[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("organisms", "readonly");
    const store = tx.objectStore("organisms");

    let request: IDBRequest;

    if (options.experimentId) {
      const index = store.index("experimentId");
      request = index.getAll(IDBKeyRange.only(options.experimentId));
    } else {
      request = store.getAll();
    }

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      let results = request.result as OrganismRecord[];

      // Filter by tags
      if (options.tags && options.tags.length > 0) {
        results = results.filter((org) =>
          options.tags!.some((tag) => org.tags.includes(tag)),
        );
      }

      // Filter by fitness
      if (options.minFitness !== undefined) {
        results = results.filter((org) => org.fitness >= options.minFitness!);
      }

      // Sort
      const sortBy = options.sortBy ?? "createdAt";
      const sortOrder = options.sortOrder ?? "desc";
      results.sort((a, b) => {
        let cmp: number;
        switch (sortBy) {
          case "fitness":
            cmp = a.fitness - b.fitness;
            break;
          case "name":
            cmp = a.name.localeCompare(b.name);
            break;
          case "createdAt":
          default:
            cmp = a.createdAt - b.createdAt;
        }
        return sortOrder === "desc" ? -cmp : cmp;
      });

      // Pagination
      if (options.offset) {
        results = results.slice(options.offset);
      }
      if (options.limit) {
        results = results.slice(0, options.limit);
      }

      resolve(results);
    };
  });
}

// ============================================================================
// Genealogy CRUD
// ============================================================================

export async function createGenealogyNode(
  experimentId: string,
  organismId: string,
  parentIds: string[],
  generation: number,
  fitness: number,
  isElite: boolean,
): Promise<GenealogyNode> {
  const db = await openDatabase();

  const node: GenealogyNode = {
    id: generateId("gen"),
    experimentId,
    organismId,
    parentIds,
    generation,
    createdAt: Date.now(),
    fitness,
    isElite,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction("genealogy", "readwrite");
    const store = tx.objectStore("genealogy");
    const request = store.add(node);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      resolve(node);
    };
  });
}

export async function getGenealogy(
  experimentId: string,
): Promise<GenealogyNode[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("genealogy", "readonly");
    const store = tx.objectStore("genealogy");
    const index = store.index("experimentId");
    const request = index.getAll(IDBKeyRange.only(experimentId));

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db.close();
      const results = request.result as GenealogyNode[];
      results.sort(
        (a, b) => a.generation - b.generation || a.createdAt - b.createdAt,
      );
      resolve(results);
    };
  });
}

// ============================================================================
// Export/Import
// ============================================================================

export interface ExportData {
  version: 1;
  exportedAt: number;
  experiments: Experiment[];
  runs: Run[];
  snapshots: Snapshot[];
  organisms: OrganismRecord[];
  genealogy: GenealogyNode[];
}

export async function exportAll(): Promise<ExportData> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ["experiments", "runs", "snapshots", "organisms", "genealogy"],
      "readonly",
    );

    const data: ExportData = {
      version: 1,
      exportedAt: Date.now(),
      experiments: [],
      runs: [],
      snapshots: [],
      organisms: [],
      genealogy: [],
    };

    tx.objectStore("experiments").getAll().onsuccess = (e) => {
      data.experiments = (e.target as IDBRequest).result;
    };
    tx.objectStore("runs").getAll().onsuccess = (e) => {
      data.runs = (e.target as IDBRequest).result;
    };
    tx.objectStore("snapshots").getAll().onsuccess = (e) => {
      data.snapshots = (e.target as IDBRequest).result;
    };
    tx.objectStore("organisms").getAll().onsuccess = (e) => {
      data.organisms = (e.target as IDBRequest).result;
    };
    tx.objectStore("genealogy").getAll().onsuccess = (e) => {
      data.genealogy = (e.target as IDBRequest).result;
    };

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => {
      db.close();
      resolve(data);
    };
  });
}

export async function importData(data: ExportData): Promise<void> {
  if (data.version !== 1) {
    throw new Error(`Unsupported export version: ${data.version}`);
  }

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ["experiments", "runs", "snapshots", "organisms", "genealogy"],
      "readwrite",
    );

    for (const exp of data.experiments) {
      tx.objectStore("experiments").put(exp);
    }
    for (const run of data.runs) {
      tx.objectStore("runs").put(run);
    }
    for (const snap of data.snapshots) {
      tx.objectStore("snapshots").put(snap);
    }
    for (const org of data.organisms) {
      tx.objectStore("organisms").put(org);
    }
    for (const gen of data.genealogy) {
      tx.objectStore("genealogy").put(gen);
    }

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

export async function clearDatabase(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ["experiments", "runs", "snapshots", "organisms", "genealogy"],
      "readwrite",
    );

    tx.objectStore("experiments").clear();
    tx.objectStore("runs").clear();
    tx.objectStore("snapshots").clear();
    tx.objectStore("organisms").clear();
    tx.objectStore("genealogy").clear();

    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}
