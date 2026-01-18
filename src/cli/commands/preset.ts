/**
 * Preset CLI Commands
 *
 * Commands for managing presets from the command line:
 * - list: List all available presets
 * - info: Show detailed preset information
 * - export: Export presets to file
 * - import: Import presets from file
 * - validate: Validate a preset file
 */

import { Command } from "commander";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { getPresetRegistry } from "../../patterns/registry/preset-registry";
import type {
  PresetMode,
  GenesisPresetFile,
} from "../../patterns/registry/preset-types";

export function registerPresetCommands(program: Command): void {
  const preset = program
    .command("preset")
    .description("Manage simulation presets");

  // List presets
  preset
    .command("list")
    .description("List available presets")
    .option(
      "-m, --mode <mode>",
      "Filter by mode (discrete, continuous, multikernel, 3d, particle, ecology)",
    )
    .option("-c, --category <category>", "Filter by category")
    .option("-t, --tags <tags>", "Filter by tags (comma-separated)")
    .option("--json", "Output as JSON")
    .action((options) => {
      const registry = getPresetRegistry();

      let presets = registry.getAllPresets();

      // Filter by mode
      if (options.mode) {
        presets = presets.filter((p) => p.metadata.mode === options.mode);
      }

      // Filter by category
      if (options.category) {
        presets = presets.filter(
          (p) => p.metadata.category === options.category,
        );
      }

      // Filter by tags
      if (options.tags) {
        const tags = options.tags.split(",").map((t: string) => t.trim());
        presets = presets.filter((p) =>
          tags.some((tag: string) => p.metadata.tags.includes(tag)),
        );
      }

      if (options.json) {
        console.log(
          JSON.stringify(
            presets.map((p) => ({
              id: p.metadata.id,
              name: p.metadata.name,
              mode: p.metadata.mode,
              category: p.metadata.category,
              tags: p.metadata.tags,
            })),
            null,
            2,
          ),
        );
      } else {
        console.log(`\nFound ${presets.length} presets:\n`);

        // Group by mode
        const byMode = new Map<PresetMode, typeof presets>();
        for (const p of presets) {
          const mode = p.metadata.mode;
          if (!byMode.has(mode)) {
            byMode.set(mode, []);
          }
          byMode.get(mode)!.push(p);
        }

        for (const [mode, modePresets] of byMode) {
          console.log(`\n[${mode.toUpperCase()}] (${modePresets.length})`);
          console.log("-".repeat(40));
          for (const p of modePresets.slice(0, 10)) {
            const tags = p.metadata.tags.slice(0, 3).join(", ");
            console.log(
              `  ${p.metadata.name.padEnd(25)} ${p.metadata.category.padEnd(12)} ${tags}`,
            );
          }
          if (modePresets.length > 10) {
            console.log(`  ... and ${modePresets.length - 10} more`);
          }
        }
      }
    });

  // Show preset info
  preset
    .command("info <id>")
    .description("Show detailed preset information")
    .option("--json", "Output as JSON")
    .action((id, options) => {
      const registry = getPresetRegistry();
      const preset = registry.getPreset(id);

      if (!preset) {
        console.error(`Preset not found: ${id}`);
        process.exit(1);
      }

      if (options.json) {
        console.log(JSON.stringify(preset, null, 2));
      } else {
        const m = preset.metadata;
        console.log("\n" + "=".repeat(50));
        console.log(`${m.name}`);
        console.log("=".repeat(50));
        console.log(`ID:          ${m.id}`);
        console.log(`Mode:        ${m.mode}`);
        console.log(`Category:    ${m.category}`);
        console.log(
          `Difficulty:  ${"★".repeat(m.difficulty)}${"☆".repeat(5 - m.difficulty)}`,
        );
        console.log(`Author:      ${m.author}`);
        console.log(`Tags:        ${m.tags.join(", ") || "(none)"}`);
        console.log(`Description: ${m.description || "(none)"}`);
        console.log("\nBehavior:");
        console.log(`  Mobile:      ${m.behavior.mobile ? "✓" : "✗"}`);
        console.log(`  Oscillating: ${m.behavior.oscillating ? "✓" : "✗"}`);
        console.log(`  Replicating: ${m.behavior.replicating ? "✓" : "✗"}`);
        console.log(`  Growing:     ${m.behavior.growing ? "✓" : "✗"}`);
        console.log(`  Chaotic:     ${m.behavior.chaotic ? "✓" : "✗"}`);
        console.log(`  Symmetric:   ${m.behavior.symmetric ? "✓" : "✗"}`);
        console.log("\nConfiguration:");
        console.log(JSON.stringify(preset.config, null, 2));
      }
    });

  // Export presets
  preset
    .command("export")
    .description("Export presets to a file")
    .option("-o, --output <file>", "Output file path", "presets.gpreset")
    .option("-i, --ids <ids>", "Preset IDs to export (comma-separated)")
    .option("-m, --mode <mode>", "Export all presets of a mode")
    .option("--user-only", "Export only user presets")
    .action((options) => {
      const registry = getPresetRegistry();

      let ids: string[] = [];

      if (options.ids) {
        ids = options.ids.split(",").map((id: string) => id.trim());
      } else if (options.userOnly) {
        ids = registry.getUserPresets().map((p) => p.metadata.id);
      } else if (options.mode) {
        ids = registry
          .getPresetsByMode(options.mode as PresetMode)
          .map((p) => p.metadata.id);
      } else {
        ids = registry.getAllPresets().map((p) => p.metadata.id);
      }

      if (ids.length === 0) {
        console.error("No presets to export");
        process.exit(1);
      }

      const exported = registry.exportPresets(ids);
      const json = JSON.stringify(exported, null, 2);

      writeFileSync(options.output, json);
      console.log(`Exported ${ids.length} presets to ${options.output}`);
    });

  // Import presets
  preset
    .command("import <file>")
    .description("Import presets from a file")
    .option("--dry-run", "Validate without importing")
    .action((file, options) => {
      if (!existsSync(file)) {
        console.error(`File not found: ${file}`);
        process.exit(1);
      }

      const content = readFileSync(file, "utf-8");
      let data: GenesisPresetFile;

      try {
        data = JSON.parse(content);
      } catch {
        console.error("Invalid JSON file");
        process.exit(1);
      }

      if (data.version !== "1.0") {
        console.error(`Unsupported version: ${data.version}`);
        process.exit(1);
      }

      console.log(`\nFile: ${file}`);
      console.log(`Version: ${data.version}`);
      console.log(`Presets: ${data.presets.length}`);
      console.log(
        `Exported at: ${new Date(data.metadata.exportedAt).toLocaleString()}`,
      );

      if (options.dryRun) {
        console.log("\n[DRY RUN] Validating presets...");
        const registry = getPresetRegistry();
        let valid = 0;
        let invalid = 0;

        for (const preset of data.presets) {
          const result = registry.validatePreset(preset);
          if (result.valid) {
            valid++;
            console.log(`  ✓ ${preset.metadata.name}`);
          } else {
            invalid++;
            console.log(
              `  ✗ ${preset.metadata.name}: ${result.errors.join(", ")}`,
            );
          }
        }

        console.log(`\nValid: ${valid}, Invalid: ${invalid}`);
      } else {
        const registry = getPresetRegistry();
        const result = registry.importPresets(data);

        if (result.success) {
          console.log(`\nImported ${result.imported} presets`);
          if (result.skipped > 0) {
            console.log(
              `Skipped ${result.skipped} presets (validation errors)`,
            );
          }
        } else {
          console.error("Import failed:", result.errors.join(", "));
          process.exit(1);
        }
      }
    });

  // Validate preset file
  preset
    .command("validate <file>")
    .description("Validate a preset file")
    .action((file) => {
      if (!existsSync(file)) {
        console.error(`File not found: ${file}`);
        process.exit(1);
      }

      const content = readFileSync(file, "utf-8");
      let data: GenesisPresetFile;

      try {
        data = JSON.parse(content);
      } catch {
        console.error("Invalid JSON file");
        process.exit(1);
      }

      const registry = getPresetRegistry();
      let allValid = true;

      console.log(`\nValidating ${data.presets.length} presets...\n`);

      for (const preset of data.presets) {
        const result = registry.validatePreset(preset);

        if (!result.valid) {
          allValid = false;
          console.log(`✗ ${preset.metadata.name}`);
          for (const error of result.errors) {
            console.log(`  - ${error}`);
          }
        } else if (result.warnings.length > 0) {
          console.log(`⚠ ${preset.metadata.name}`);
          for (const warning of result.warnings) {
            console.log(`  - ${warning}`);
          }
        } else {
          console.log(`✓ ${preset.metadata.name}`);
        }
      }

      if (allValid) {
        console.log("\n✓ All presets are valid");
      } else {
        console.log("\n✗ Some presets have validation errors");
        process.exit(1);
      }
    });

  // Show stats
  preset
    .command("stats")
    .description("Show preset registry statistics")
    .action(() => {
      const registry = getPresetRegistry();
      const stats = registry.getStats();

      console.log("\n" + "=".repeat(40));
      console.log("Preset Registry Statistics");
      console.log("=".repeat(40));
      console.log(`Total presets:   ${stats.totalPresets}`);
      console.log(`Builtin:         ${stats.builtinPresets}`);
      console.log(`User-created:    ${stats.userPresets}`);
      console.log(`Favorites:       ${stats.favorites}`);
      console.log(`Collections:     ${stats.collections}`);
      console.log("\nBy Mode:");
      for (const [mode, count] of Object.entries(stats.byMode)) {
        console.log(`  ${mode.padEnd(15)} ${count}`);
      }
    });
}
