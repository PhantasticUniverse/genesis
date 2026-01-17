/**
 * Experiment Tracker
 * Auto-generates experiment manifests for reproducibility and tracking
 *
 * Note: Uses execSync for git commands with no user input - this is safe.
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { getSeed } from "../core/random";

/**
 * Experiment manifest structure
 */
export interface ExperimentManifest {
  id: string;
  name?: string;
  tags?: string[];
  command: string;
  subcommand?: string;
  args: Record<string, unknown>;
  seed: number;
  timestamp: string;
  git: {
    hash?: string;
    branch?: string;
    dirty?: boolean;
  };
  system: {
    platform: string;
    arch: string;
    nodeVersion: string;
    cpuModel: string;
    totalMemoryGB: number;
  };
  duration?: number;
  status: "running" | "completed" | "failed";
  error?: string;
  resultsFile?: string;
}

/**
 * Experiment index entry (for tracking multiple experiments)
 */
export interface ExperimentIndexEntry {
  id: string;
  name?: string;
  tags?: string[];
  command: string;
  timestamp: string;
  status: "running" | "completed" | "failed";
  resultsFile?: string;
}

/**
 * Experiment tracker class
 */
export class ExperimentTracker {
  private manifest: ExperimentManifest;
  private outputDir: string;
  private startTime: number;

  constructor(
    command: string,
    subcommand: string | undefined,
    args: Record<string, unknown>,
    options: {
      name?: string;
      tags?: string[];
      outputDir?: string;
    } = {},
  ) {
    this.startTime = Date.now();
    this.outputDir = options.outputDir || "./experiments";

    // Generate unique experiment ID
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const id = `exp_${timestamp}_${randomSuffix}`;

    // Get git info
    const git = this.getGitInfo();

    // Get system info
    const system = this.getSystemInfo();

    this.manifest = {
      id,
      name: options.name,
      tags: options.tags,
      command,
      subcommand,
      args,
      seed: getSeed(),
      timestamp: new Date().toISOString(),
      git,
      system,
      status: "running",
    };
  }

  /**
   * Get git repository information
   * Uses execSync with hardcoded git commands - no user input, safe from injection
   */
  private getGitInfo(): ExperimentManifest["git"] {
    try {
      // These are hardcoded git commands with no user input - safe
      const hash = execSync("git rev-parse --short HEAD", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();

      const branch = execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();

      // Check if working directory is dirty
      const status = execSync("git status --porcelain", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
      const dirty = status.length > 0;

      return { hash, branch, dirty };
    } catch {
      return {};
    }
  }

  /**
   * Get system information
   */
  private getSystemInfo(): ExperimentManifest["system"] {
    const cpus = os.cpus();
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      cpuModel: cpus.length > 0 ? cpus[0].model : "unknown",
      totalMemoryGB: Math.round((os.totalmem() / 1024 / 1024 / 1024) * 10) / 10,
    };
  }

  /**
   * Get the experiment ID
   */
  getId(): string {
    return this.manifest.id;
  }

  /**
   * Get the manifest
   */
  getManifest(): ExperimentManifest {
    return { ...this.manifest };
  }

  /**
   * Mark experiment as completed
   */
  complete(resultsFile?: string): ExperimentManifest {
    this.manifest.status = "completed";
    this.manifest.duration = Date.now() - this.startTime;
    if (resultsFile) {
      this.manifest.resultsFile = resultsFile;
    }
    return this.manifest;
  }

  /**
   * Mark experiment as failed
   */
  fail(error: Error | string): ExperimentManifest {
    this.manifest.status = "failed";
    this.manifest.duration = Date.now() - this.startTime;
    this.manifest.error = error instanceof Error ? error.message : error;
    return this.manifest;
  }

  /**
   * Save the manifest to disk
   */
  save(): string {
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // Save manifest
    const manifestPath = path.join(
      this.outputDir,
      `${this.manifest.id}_manifest.json`,
    );
    fs.writeFileSync(manifestPath, JSON.stringify(this.manifest, null, 2));

    // Update index
    this.updateIndex();

    return manifestPath;
  }

  /**
   * Update the experiment index file
   */
  private updateIndex(): void {
    const indexPath = path.join(this.outputDir, "experiment_index.json");

    let index: ExperimentIndexEntry[] = [];

    // Load existing index if it exists
    if (fs.existsSync(indexPath)) {
      try {
        index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
      } catch {
        // If index is corrupted, start fresh
        index = [];
      }
    }

    // Check if this experiment is already in the index
    const existingIndex = index.findIndex((e) => e.id === this.manifest.id);
    const entry: ExperimentIndexEntry = {
      id: this.manifest.id,
      name: this.manifest.name,
      tags: this.manifest.tags,
      command: this.manifest.subcommand
        ? `${this.manifest.command} ${this.manifest.subcommand}`
        : this.manifest.command,
      timestamp: this.manifest.timestamp,
      status: this.manifest.status,
      resultsFile: this.manifest.resultsFile,
    };

    if (existingIndex >= 0) {
      index[existingIndex] = entry;
    } else {
      index.push(entry);
    }

    // Keep only last 1000 experiments
    if (index.length > 1000) {
      index = index.slice(-1000);
    }

    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
  }
}

/**
 * Create a new experiment tracker
 */
export function createExperimentTracker(
  command: string,
  subcommand: string | undefined,
  args: Record<string, unknown>,
  options?: {
    name?: string;
    tags?: string[];
    outputDir?: string;
  },
): ExperimentTracker {
  return new ExperimentTracker(command, subcommand, args, options);
}

/**
 * Load an experiment manifest by ID
 */
export function loadExperiment(
  experimentId: string,
  outputDir: string = "./experiments",
): ExperimentManifest | null {
  const manifestPath = path.join(outputDir, `${experimentId}_manifest.json`);

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * List all experiments
 */
export function listExperiments(
  outputDir: string = "./experiments",
  options?: {
    command?: string;
    status?: "running" | "completed" | "failed";
    tags?: string[];
    limit?: number;
  },
): ExperimentIndexEntry[] {
  const indexPath = path.join(outputDir, "experiment_index.json");

  if (!fs.existsSync(indexPath)) {
    return [];
  }

  try {
    let index: ExperimentIndexEntry[] = JSON.parse(
      fs.readFileSync(indexPath, "utf-8"),
    );

    // Filter by command
    if (options?.command) {
      index = index.filter((e) => e.command.startsWith(options.command!));
    }

    // Filter by status
    if (options?.status) {
      index = index.filter((e) => e.status === options.status);
    }

    // Filter by tags
    if (options?.tags && options.tags.length > 0) {
      index = index.filter((e) =>
        options.tags!.some((tag) => e.tags?.includes(tag)),
      );
    }

    // Limit results
    if (options?.limit) {
      index = index.slice(-options.limit);
    }

    return index;
  } catch {
    return [];
  }
}

/**
 * Summarize experiment results with statistics
 */
export function summarizeExperiments(experiments: ExperimentManifest[]): {
  total: number;
  completed: number;
  failed: number;
  running: number;
  avgDuration?: number;
  commands: Record<string, number>;
} {
  const summary = {
    total: experiments.length,
    completed: 0,
    failed: 0,
    running: 0,
    avgDuration: undefined as number | undefined,
    commands: {} as Record<string, number>,
  };

  let totalDuration = 0;
  let durationCount = 0;

  for (const exp of experiments) {
    // Count by status
    switch (exp.status) {
      case "completed":
        summary.completed++;
        break;
      case "failed":
        summary.failed++;
        break;
      case "running":
        summary.running++;
        break;
    }

    // Calculate average duration
    if (exp.duration) {
      totalDuration += exp.duration;
      durationCount++;
    }

    // Count by command
    const cmd = exp.subcommand
      ? `${exp.command} ${exp.subcommand}`
      : exp.command;
    summary.commands[cmd] = (summary.commands[cmd] || 0) + 1;
  }

  if (durationCount > 0) {
    summary.avgDuration = totalDuration / durationCount;
  }

  return summary;
}

export default {
  ExperimentTracker,
  createExperimentTracker,
  loadExperiment,
  listExperiments,
  summarizeExperiments,
};
