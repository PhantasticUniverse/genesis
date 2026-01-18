/**
 * Experiment CLI Commands
 *
 * Commands for managing experiments from the command line:
 * - create: Create a new experiment
 * - list: List experiments
 * - info: Show experiment details
 * - export: Export experiment data
 * - delete: Delete an experiment
 */

import { Command } from "commander";
import { writeFileSync } from "fs";
import * as db from "../../persistence/experiment-db";

export function registerExperimentCommands(program: Command): void {
  const experiment = program
    .command("experiment")
    .description("Manage experiments and runs");

  // Create experiment
  experiment
    .command("create <name>")
    .description("Create a new experiment")
    .option("-d, --description <desc>", "Experiment description")
    .option("-t, --tags <tags>", "Tags (comma-separated)")
    .option("-p, --paradigm <paradigm>", "Simulation paradigm", "continuous")
    .option("-g, --grid <size>", "Grid size", "512")
    .action(async (name, options) => {
      const config: db.ExperimentConfig = {
        paradigm: options.paradigm as db.ExperimentConfig["paradigm"],
        gridSize: {
          width: parseInt(options.grid, 10),
          height: parseInt(options.grid, 10),
        },
      };

      const exp = await db.createExperiment(name, config, {
        description: options.description,
        tags: options.tags?.split(",").map((t: string) => t.trim()) ?? [],
      });

      console.log("\nExperiment created:");
      console.log(`  ID:       ${exp.id}`);
      console.log(`  Name:     ${exp.name}`);
      console.log(`  Status:   ${exp.status}`);
      console.log(`  Created:  ${new Date(exp.createdAt).toLocaleString()}`);
    });

  // List experiments
  experiment
    .command("list")
    .description("List all experiments")
    .option("-s, --status <status>", "Filter by status")
    .option("-t, --tags <tags>", "Filter by tags (comma-separated)")
    .option("-l, --limit <n>", "Limit results", "20")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      const experiments = await db.listExperiments({
        status: options.status,
        tags: options.tags?.split(",").map((t: string) => t.trim()),
        limit: parseInt(options.limit, 10),
      });

      if (options.json) {
        console.log(JSON.stringify(experiments, null, 2));
      } else {
        if (experiments.length === 0) {
          console.log("\nNo experiments found.");
          return;
        }

        console.log(`\nFound ${experiments.length} experiments:\n`);
        console.log(
          "ID".padEnd(25) + "Name".padEnd(30) + "Status".padEnd(12) + "Created",
        );
        console.log("-".repeat(80));

        for (const exp of experiments) {
          const created = new Date(exp.createdAt).toLocaleDateString();
          console.log(
            `${exp.id.padEnd(25)}${exp.name.padEnd(30)}${exp.status.padEnd(12)}${created}`,
          );
        }
      }
    });

  // Show experiment info
  experiment
    .command("info <id>")
    .description("Show experiment details")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      const exp = await db.getExperiment(id);

      if (!exp) {
        console.error(`Experiment not found: ${id}`);
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(exp, null, 2));
      } else {
        console.log("\n" + "=".repeat(50));
        console.log(`Experiment: ${exp.name}`);
        console.log("=".repeat(50));
        console.log(`ID:          ${exp.id}`);
        console.log(`Status:      ${exp.status}`);
        console.log(`Created:     ${new Date(exp.createdAt).toLocaleString()}`);
        console.log(`Updated:     ${new Date(exp.updatedAt).toLocaleString()}`);
        console.log(`Description: ${exp.description || "(none)"}`);
        console.log(`Tags:        ${exp.tags.join(", ") || "(none)"}`);
        console.log("\nConfiguration:");
        console.log(`  Paradigm:  ${exp.config.paradigm}`);
        console.log(
          `  Grid:      ${exp.config.gridSize.width}×${exp.config.gridSize.height}`,
        );

        if (exp.metrics) {
          console.log("\nMetrics:");
          console.log(`  Total runs:     ${exp.metrics.totalRuns}`);
          console.log(`  Completed:      ${exp.metrics.completedRuns}`);
          console.log(
            `  Best fitness:   ${exp.metrics.bestFitness.toFixed(4)}`,
          );
          console.log(`  Avg fitness:    ${exp.metrics.avgFitness.toFixed(4)}`);
          console.log(`  Total steps:    ${exp.metrics.totalSteps}`);
          console.log(
            `  Duration:       ${(exp.metrics.totalDurationMs / 1000).toFixed(1)}s`,
          );
        }

        // Show runs
        const runs = await db.listRuns(id);
        if (runs.length > 0) {
          console.log(`\nRuns (${runs.length}):`);
          console.log(
            "  " +
              "ID".padEnd(20) +
              "Status".padEnd(12) +
              "Steps".padEnd(10) +
              "Fitness",
          );
          console.log("  " + "-".repeat(55));
          for (const run of runs.slice(0, 10)) {
            const fitness = run.metrics.fitness?.toFixed(4) ?? "-";
            console.log(
              `  ${run.id.padEnd(20)}${run.status.padEnd(12)}${run.metrics.steps.toString().padEnd(10)}${fitness}`,
            );
          }
          if (runs.length > 10) {
            console.log(`  ... and ${runs.length - 10} more runs`);
          }
        }
      }
    });

  // Export experiment
  experiment
    .command("export <id>")
    .description("Export experiment data")
    .option("-o, --output <file>", "Output file path")
    .option("-f, --format <format>", "Export format (json, csv)", "json")
    .action(async (id, options) => {
      const exp = await db.getExperiment(id);

      if (!exp) {
        console.error(`Experiment not found: ${id}`);
        process.exit(1);
      }

      const runs = await db.listRuns(id);
      const organisms = await db.listOrganisms({ experimentId: id });
      const genealogy = await db.getGenealogy(id);

      const outputFile = options.output || `experiment-${id}.${options.format}`;

      if (options.format === "csv") {
        // Export runs as CSV
        const headers = [
          "run_id",
          "status",
          "seed",
          "steps",
          "duration_ms",
          "final_mass",
          "fitness",
        ];
        const rows = runs.map((run) =>
          [
            run.id,
            run.status,
            run.seed,
            run.metrics.steps,
            run.metrics.durationMs,
            run.metrics.finalMass,
            run.metrics.fitness ?? "",
          ].join(","),
        );

        const csv = [headers.join(","), ...rows].join("\n");
        writeFileSync(outputFile, csv);
        console.log(`Exported ${runs.length} runs to ${outputFile}`);
      } else {
        // Export as JSON
        const exportData = {
          experiment: exp,
          runs,
          organisms,
          genealogy,
          exportedAt: Date.now(),
        };

        writeFileSync(outputFile, JSON.stringify(exportData, null, 2));
        console.log(`Exported experiment to ${outputFile}`);
      }
    });

  // Delete experiment
  experiment
    .command("delete <id>")
    .description("Delete an experiment and all its data")
    .option("-f, --force", "Skip confirmation")
    .action(async (id, options) => {
      const exp = await db.getExperiment(id);

      if (!exp) {
        console.error(`Experiment not found: ${id}`);
        process.exit(1);
      }

      if (!options.force) {
        console.log(`\nAbout to delete experiment: ${exp.name} (${id})`);
        console.log(
          "This will also delete all runs, snapshots, and genealogy data.",
        );
        console.log("Use --force to skip this confirmation.");
        process.exit(0);
      }

      await db.deleteExperiment(id);
      console.log(`Deleted experiment: ${id}`);
    });

  // Update experiment status
  experiment
    .command("status <id> <status>")
    .description("Update experiment status")
    .action(async (id, status) => {
      const validStatuses = [
        "created",
        "running",
        "paused",
        "completed",
        "failed",
      ];
      if (!validStatuses.includes(status)) {
        console.error(`Invalid status: ${status}`);
        console.error(`Valid statuses: ${validStatuses.join(", ")}`);
        process.exit(1);
      }

      const updated = await db.updateExperiment(id, {
        status: status as db.ExperimentStatus,
      });

      if (!updated) {
        console.error(`Experiment not found: ${id}`);
        process.exit(1);
      }

      console.log(`Updated experiment ${id} status to: ${status}`);
    });

  // Clear all experiments
  experiment
    .command("clear")
    .description("Clear all experiment data")
    .option("-f, --force", "Skip confirmation")
    .action(async (options) => {
      if (!options.force) {
        console.log(
          "\nThis will delete ALL experiments, runs, snapshots, and organisms.",
        );
        console.log("Use --force to proceed.");
        process.exit(0);
      }

      await db.clearDatabase();
      console.log("Cleared all experiment data.");
    });

  // Export all
  experiment
    .command("export-all")
    .description("Export all experiment data")
    .option("-o, --output <file>", "Output file path", "genesis-export.json")
    .action(async (options) => {
      const data = await db.exportAll();
      writeFileSync(options.output, JSON.stringify(data, null, 2));
      console.log(`Exported all data to ${options.output}`);
      console.log(`  Experiments: ${data.experiments.length}`);
      console.log(`  Runs:        ${data.runs.length}`);
      console.log(`  Snapshots:   ${data.snapshots.length}`);
      console.log(`  Organisms:   ${data.organisms.length}`);
    });
}
