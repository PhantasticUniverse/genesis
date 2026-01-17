# Genesis Skills

This directory contains domain-specific knowledge for Claude Code to use when working on the Genesis codebase.

## Available Skills

| Skill        | Description                                                     |
| ------------ | --------------------------------------------------------------- |
| `lenia-core` | Core Lenia engine, parameters, multi-kernel, multi-species      |
| `analysis`   | Symmetry detection, chaos analysis (Lyapunov), period detection |
| `discovery`  | Genetic algorithm, fitness metrics, novelty search, replication |
| `webgpu`     | GPU pipelines, texture pooling, spatial hashing                 |
| `3d-lenia`   | 3D volumetric Lenia engine and presets                          |
| `advanced`   | Particle-Lenia hybrid, bioelectric patterns, Flow-Lenia         |
| `cli`        | CLI commands for testing and benchmarking without WebGPU        |

## How Skills Work

Skills are automatically loaded by Claude Code when relevant to your task. Each skill contains:

- **Frontmatter**: YAML metadata with name and description
- **API Documentation**: Detailed function signatures and usage examples
- **Types**: TypeScript type definitions
- **Presets/Constants**: Available configuration options

## Triggering Skills

Skills are triggered contextually. For example:

- Working on symmetry analysis? → `analysis` skill loads
- Implementing GA evolution? → `discovery` skill loads
- Debugging GPU pipelines? → `webgpu` skill loads
