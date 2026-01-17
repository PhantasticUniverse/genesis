/**
 * Experiment Tracker Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  createExperimentTracker,
  loadExperiment,
  listExperiments,
  summarizeExperiments,
  type ExperimentManifest,
} from "../../cli/experiment-tracker";
import { setSeed, getSeed } from "../../core/random";

describe("Experiment Tracker", () => {
  const testOutputDir = "./test-experiments-" + Date.now();

  beforeEach(() => {
    // Set a known seed
    setSeed(12345);
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testOutputDir)) {
      const files = fs.readdirSync(testOutputDir);
      for (const file of files) {
        fs.unlinkSync(path.join(testOutputDir, file));
      }
      fs.rmdirSync(testOutputDir);
    }
  });

  describe("createExperimentTracker", () => {
    it("should create tracker with unique ID", () => {
      const tracker1 = createExperimentTracker("evolve", "run", {
        population: 20,
      });
      const tracker2 = createExperimentTracker("evolve", "run", {
        population: 20,
      });

      expect(tracker1.getId()).toMatch(/^exp_/);
      expect(tracker2.getId()).toMatch(/^exp_/);
      expect(tracker1.getId()).not.toBe(tracker2.getId());
    });

    it("should capture seed in manifest", () => {
      setSeed(42);
      const tracker = createExperimentTracker("evolve", "run", {
        population: 20,
      });
      const manifest = tracker.getManifest();

      expect(manifest.seed).toBe(42);
    });

    it("should capture command and args", () => {
      const tracker = createExperimentTracker("evolve", "run", {
        population: 50,
        generations: 100,
      });
      const manifest = tracker.getManifest();

      expect(manifest.command).toBe("evolve");
      expect(manifest.subcommand).toBe("run");
      expect(manifest.args.population).toBe(50);
      expect(manifest.args.generations).toBe(100);
    });

    it("should capture system info", () => {
      const tracker = createExperimentTracker("evolve", "run", {});
      const manifest = tracker.getManifest();

      expect(manifest.system.platform).toBeDefined();
      expect(manifest.system.arch).toBeDefined();
      expect(manifest.system.nodeVersion).toBeDefined();
      expect(manifest.system.cpuModel).toBeDefined();
      expect(manifest.system.totalMemoryGB).toBeGreaterThan(0);
    });

    it("should start with running status", () => {
      const tracker = createExperimentTracker("evolve", "run", {});
      const manifest = tracker.getManifest();

      expect(manifest.status).toBe("running");
    });
  });

  describe("complete / fail", () => {
    it("should mark experiment as completed", () => {
      const tracker = createExperimentTracker("evolve", "run", {});
      const manifest = tracker.complete("results.json");

      expect(manifest.status).toBe("completed");
      expect(manifest.resultsFile).toBe("results.json");
      expect(manifest.duration).toBeGreaterThanOrEqual(0);
    });

    it("should mark experiment as failed with error", () => {
      const tracker = createExperimentTracker("evolve", "run", {});
      const manifest = tracker.fail("Something went wrong");

      expect(manifest.status).toBe("failed");
      expect(manifest.error).toBe("Something went wrong");
      expect(manifest.duration).toBeGreaterThanOrEqual(0);
    });

    it("should accept Error object for fail", () => {
      const tracker = createExperimentTracker("evolve", "run", {});
      const manifest = tracker.fail(new Error("Test error"));

      expect(manifest.error).toBe("Test error");
    });
  });

  describe("save / load", () => {
    it("should save manifest to disk", () => {
      const tracker = createExperimentTracker(
        "evolve",
        "run",
        { population: 20 },
        { outputDir: testOutputDir },
      );
      tracker.complete();
      const manifestPath = tracker.save();

      expect(fs.existsSync(manifestPath)).toBe(true);
      expect(manifestPath).toContain(tracker.getId());
    });

    it("should create output directory if needed", () => {
      const tracker = createExperimentTracker(
        "evolve",
        "run",
        {},
        { outputDir: testOutputDir },
      );
      tracker.save();

      expect(fs.existsSync(testOutputDir)).toBe(true);
    });

    it("should load experiment by ID", () => {
      const tracker = createExperimentTracker(
        "evolve",
        "run",
        { population: 30 },
        { outputDir: testOutputDir },
      );
      tracker.complete();
      tracker.save();

      const loaded = loadExperiment(tracker.getId(), testOutputDir);

      expect(loaded).not.toBeNull();
      expect(loaded?.id).toBe(tracker.getId());
      expect(loaded?.args.population).toBe(30);
    });

    it("should return null for non-existent experiment", () => {
      const loaded = loadExperiment("non-existent-id", testOutputDir);
      expect(loaded).toBeNull();
    });
  });

  describe("experiment index", () => {
    it("should update index on save", () => {
      const tracker = createExperimentTracker(
        "evolve",
        "run",
        {},
        { outputDir: testOutputDir },
      );
      tracker.complete();
      tracker.save();

      const indexPath = path.join(testOutputDir, "experiment_index.json");
      expect(fs.existsSync(indexPath)).toBe(true);

      const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
      expect(index.length).toBe(1);
      expect(index[0].id).toBe(tracker.getId());
    });

    it("should append to existing index", () => {
      const tracker1 = createExperimentTracker(
        "evolve",
        "run",
        {},
        { outputDir: testOutputDir },
      );
      tracker1.complete();
      tracker1.save();

      const tracker2 = createExperimentTracker(
        "analyze",
        "full",
        {},
        { outputDir: testOutputDir },
      );
      tracker2.complete();
      tracker2.save();

      const index = listExperiments(testOutputDir);
      expect(index.length).toBe(2);
    });
  });

  describe("listExperiments", () => {
    it("should filter by command", () => {
      const tracker1 = createExperimentTracker(
        "evolve",
        "run",
        {},
        { outputDir: testOutputDir },
      );
      tracker1.complete();
      tracker1.save();

      const tracker2 = createExperimentTracker(
        "analyze",
        "full",
        {},
        { outputDir: testOutputDir },
      );
      tracker2.complete();
      tracker2.save();

      const evolveExps = listExperiments(testOutputDir, { command: "evolve" });
      expect(evolveExps.length).toBe(1);
      expect(evolveExps[0].command).toBe("evolve run");
    });

    it("should filter by status", () => {
      const tracker1 = createExperimentTracker(
        "evolve",
        "run",
        {},
        { outputDir: testOutputDir },
      );
      tracker1.complete();
      tracker1.save();

      const tracker2 = createExperimentTracker(
        "evolve",
        "test",
        {},
        { outputDir: testOutputDir },
      );
      tracker2.fail("error");
      tracker2.save();

      const completed = listExperiments(testOutputDir, { status: "completed" });
      expect(completed.length).toBe(1);

      const failed = listExperiments(testOutputDir, { status: "failed" });
      expect(failed.length).toBe(1);
    });

    it("should respect limit", () => {
      for (let i = 0; i < 5; i++) {
        const tracker = createExperimentTracker(
          "evolve",
          "run",
          { iteration: i },
          { outputDir: testOutputDir },
        );
        tracker.complete();
        tracker.save();
      }

      const limited = listExperiments(testOutputDir, { limit: 3 });
      expect(limited.length).toBe(3);
    });
  });

  describe("summarizeExperiments", () => {
    it("should count status correctly", () => {
      const manifests: ExperimentManifest[] = [
        { status: "completed" } as ExperimentManifest,
        { status: "completed" } as ExperimentManifest,
        { status: "failed" } as ExperimentManifest,
        { status: "running" } as ExperimentManifest,
      ];

      const summary = summarizeExperiments(manifests);

      expect(summary.total).toBe(4);
      expect(summary.completed).toBe(2);
      expect(summary.failed).toBe(1);
      expect(summary.running).toBe(1);
    });

    it("should calculate average duration", () => {
      const manifests: ExperimentManifest[] = [
        { status: "completed", duration: 100 } as ExperimentManifest,
        { status: "completed", duration: 200 } as ExperimentManifest,
        { status: "completed", duration: 300 } as ExperimentManifest,
      ];

      const summary = summarizeExperiments(manifests);

      expect(summary.avgDuration).toBe(200);
    });

    it("should count commands", () => {
      const manifests: ExperimentManifest[] = [
        { command: "evolve", subcommand: "run" } as ExperimentManifest,
        { command: "evolve", subcommand: "run" } as ExperimentManifest,
        { command: "analyze", subcommand: "full" } as ExperimentManifest,
      ];

      const summary = summarizeExperiments(manifests);

      expect(summary.commands["evolve run"]).toBe(2);
      expect(summary.commands["analyze full"]).toBe(1);
    });
  });

  describe("name and tags", () => {
    it("should support experiment naming", () => {
      const tracker = createExperimentTracker(
        "evolve",
        "run",
        {},
        { name: "My Experiment", outputDir: testOutputDir },
      );
      const manifest = tracker.getManifest();

      expect(manifest.name).toBe("My Experiment");
    });

    it("should support experiment tags", () => {
      const tracker = createExperimentTracker(
        "evolve",
        "run",
        {},
        { tags: ["baseline", "v1"], outputDir: testOutputDir },
      );
      const manifest = tracker.getManifest();

      expect(manifest.tags).toEqual(["baseline", "v1"]);
    });

    it("should filter by tags", () => {
      const tracker1 = createExperimentTracker(
        "evolve",
        "run",
        {},
        { tags: ["baseline"], outputDir: testOutputDir },
      );
      tracker1.complete();
      tracker1.save();

      const tracker2 = createExperimentTracker(
        "evolve",
        "run",
        {},
        { tags: ["ablation"], outputDir: testOutputDir },
      );
      tracker2.complete();
      tracker2.save();

      const baselineExps = listExperiments(testOutputDir, {
        tags: ["baseline"],
      });
      expect(baselineExps.length).toBe(1);
    });
  });
});
