#!/usr/bin/env bun
/**
 * Genesis CLI
 * Command-line interface for testing and benchmarking without browser/Playwright
 */

import { Command } from "commander";
import { registerAnalyzeCommands } from "./commands/analyze";
import { registerBenchCommands } from "./commands/bench";
import { registerEvolveCommands } from "./commands/evolve";
import { registerEvaluateCommands } from "./commands/evaluate";
import { registerMultiKernelCommands } from "./commands/multikernel";
import { sweepCommand } from "./commands/sweep";
import { registerPresetCommands } from "./commands/preset";
import { registerExperimentCommands } from "./commands/experiment";

const program = new Command();

program
  .name("genesis")
  .description(
    "Genesis CLI - Artificial life simulation testing & benchmarking",
  )
  .version("1.0.0");

// Register command groups
registerAnalyzeCommands(program);
registerBenchCommands(program);
registerEvolveCommands(program);
registerEvaluateCommands(program);
registerMultiKernelCommands(program);
program.addCommand(sweepCommand);
registerPresetCommands(program);
registerExperimentCommands(program);

// Parse and execute
program.parse(process.argv);

// Show help if no command provided
if (process.argv.length <= 2) {
  program.help();
}
