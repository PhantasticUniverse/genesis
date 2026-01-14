/**
 * Particle Renderer
 * Renders particles overlaid on the Lenia field
 */

import type { Particle, ParticleSystemState } from '../core/particles';
import { PARTICLE_COLORS, getActiveParticles } from '../core/particles';

export interface ParticleRendererConfig {
  /** Canvas to render to */
  canvas: HTMLCanvasElement;
  /** Base particle radius in pixels */
  particleRadius: number;
  /** Whether to show velocity vectors */
  showVelocity: boolean;
  /** Whether to show interaction lines */
  showInteractions: boolean;
  /** Interaction line distance threshold */
  interactionThreshold: number;
  /** Opacity of particles (0-1) */
  opacity: number;
  /** Whether to show particle trails */
  showTrails: boolean;
  /** Trail length in frames */
  trailLength: number;
}

export interface ParticleRenderer {
  /** Render particles */
  render(particles: Particle[]): void;
  /** Render from particle system state */
  renderState(state: ParticleSystemState): void;
  /** Update configuration */
  setConfig(config: Partial<ParticleRendererConfig>): void;
  /** Get current configuration */
  getConfig(): ParticleRendererConfig;
  /** Clear trails */
  clearTrails(): void;
  /** Clean up */
  destroy(): void;
}

const DEFAULT_CONFIG: ParticleRendererConfig = {
  canvas: null as unknown as HTMLCanvasElement,
  particleRadius: 4,
  showVelocity: false,
  showInteractions: false,
  interactionThreshold: 50,
  opacity: 0.9,
  showTrails: false,
  trailLength: 20,
};

/**
 * Create a particle renderer
 */
export function createParticleRenderer(
  config: Partial<ParticleRendererConfig> & { canvas: HTMLCanvasElement }
): ParticleRenderer {
  const fullConfig: ParticleRendererConfig = { ...DEFAULT_CONFIG, ...config };
  const ctx = fullConfig.canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get 2D context for particle rendering');
  }

  // Trail history: array of position arrays per particle
  const trailHistory: Map<number, Array<{ x: number; y: number }>> = new Map();

  function getParticleColor(type: number, alpha: number = 1): string {
    const color = PARTICLE_COLORS[type % PARTICLE_COLORS.length];
    return `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
  }

  function renderParticle(p: Particle, scaleX: number, scaleY: number) {
    if (!p.active) return;

    const x = p.x * scaleX;
    const y = p.y * scaleY;
    const radius = fullConfig.particleRadius;

    // Draw trail if enabled
    if (fullConfig.showTrails) {
      const trail = trailHistory.get(p.id);
      if (trail && trail.length > 1) {
        ctx!.beginPath();
        ctx!.moveTo(trail[0].x * scaleX, trail[0].y * scaleY);
        for (let i = 1; i < trail.length; i++) {
          const alpha = (i / trail.length) * 0.5;
          ctx!.strokeStyle = getParticleColor(p.type, alpha * fullConfig.opacity);
          ctx!.lineTo(trail[i].x * scaleX, trail[i].y * scaleY);
        }
        ctx!.lineWidth = radius * 0.5;
        ctx!.stroke();
      }
    }

    // Draw velocity vector if enabled
    if (fullConfig.showVelocity) {
      const vScale = 5;
      ctx!.beginPath();
      ctx!.moveTo(x, y);
      ctx!.lineTo(x + p.vx * vScale, y + p.vy * vScale);
      ctx!.strokeStyle = getParticleColor(p.type, 0.5 * fullConfig.opacity);
      ctx!.lineWidth = 1;
      ctx!.stroke();
    }

    // Draw particle
    ctx!.beginPath();
    ctx!.arc(x, y, radius, 0, Math.PI * 2);
    ctx!.fillStyle = getParticleColor(p.type, fullConfig.opacity);
    ctx!.fill();

    // Draw outline
    ctx!.strokeStyle = getParticleColor(p.type, fullConfig.opacity * 0.5);
    ctx!.lineWidth = 1;
    ctx!.stroke();
  }

  function renderInteractions(particles: Particle[], scaleX: number, scaleY: number) {
    if (!fullConfig.showInteractions) return;

    ctx!.lineWidth = 0.5;

    for (let i = 0; i < particles.length; i++) {
      const p1 = particles[i];
      if (!p1.active) continue;

      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        if (!p2.active) continue;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < fullConfig.interactionThreshold) {
          const alpha = (1 - dist / fullConfig.interactionThreshold) * 0.3 * fullConfig.opacity;
          ctx!.beginPath();
          ctx!.moveTo(p1.x * scaleX, p1.y * scaleY);
          ctx!.lineTo(p2.x * scaleX, p2.y * scaleY);
          ctx!.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx!.stroke();
        }
      }
    }
  }

  function updateTrails(particles: Particle[]) {
    if (!fullConfig.showTrails) return;

    for (const p of particles) {
      if (!p.active) {
        trailHistory.delete(p.id);
        continue;
      }

      let trail = trailHistory.get(p.id);
      if (!trail) {
        trail = [];
        trailHistory.set(p.id, trail);
      }

      trail.push({ x: p.x, y: p.y });

      // Limit trail length
      while (trail.length > fullConfig.trailLength) {
        trail.shift();
      }
    }
  }

  return {
    render(particles: Particle[]) {
      const canvas = fullConfig.canvas;
      const gridWidth = canvas.width;
      const gridHeight = canvas.height;

      // Scale factors (particles use grid coordinates, canvas may be different)
      const scaleX = canvas.width / gridWidth;
      const scaleY = canvas.height / gridHeight;

      // Update trail history
      updateTrails(particles);

      // Render interactions first (behind particles)
      renderInteractions(particles, scaleX, scaleY);

      // Render each particle
      for (const p of particles) {
        renderParticle(p, scaleX, scaleY);
      }
    },

    renderState(state: ParticleSystemState) {
      const canvas = fullConfig.canvas;
      const { gridWidth, gridHeight } = state.config;

      // Scale factors
      const scaleX = canvas.width / gridWidth;
      const scaleY = canvas.height / gridHeight;

      const activeParticles = getActiveParticles(state);

      // Update trail history
      updateTrails(activeParticles);

      // Render interactions first (behind particles)
      renderInteractions(activeParticles, scaleX, scaleY);

      // Render each particle
      for (const p of activeParticles) {
        renderParticle(p, scaleX, scaleY);
      }
    },

    setConfig(newConfig: Partial<ParticleRendererConfig>) {
      Object.assign(fullConfig, newConfig);
    },

    getConfig(): ParticleRendererConfig {
      return { ...fullConfig };
    },

    clearTrails() {
      trailHistory.clear();
    },

    destroy() {
      trailHistory.clear();
    },
  };
}

/**
 * Helper to render particles on an existing canvas context
 * (for integration with main render loop)
 */
export function renderParticlesOverlay(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  gridWidth: number,
  gridHeight: number,
  options: {
    radius?: number;
    opacity?: number;
    showVelocity?: boolean;
  } = {}
): void {
  const radius = options.radius ?? 4;
  const opacity = options.opacity ?? 0.9;
  const showVelocity = options.showVelocity ?? false;

  const scaleX = ctx.canvas.width / gridWidth;
  const scaleY = ctx.canvas.height / gridHeight;

  for (const p of particles) {
    if (!p.active) continue;

    const x = p.x * scaleX;
    const y = p.y * scaleY;
    const color = PARTICLE_COLORS[p.type % PARTICLE_COLORS.length];

    // Velocity vector
    if (showVelocity) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + p.vx * 5, y + p.vy * 5);
      ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity * 0.5})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Particle body
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity * 0.5})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
