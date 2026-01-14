/**
 * Sensorimotor Cellular Automata Shader
 *
 * Channel layout (in RGBA texture):
 * R = Creature (body mass)
 * G = Obstacle (fixed barriers)
 * B = Gradient (chemical field / target)
 * A = Motor (movement field)
 *
 * Second texture for additional channels:
 * R = Proximity sensor
 * G = Pheromone
 * B = Reserved
 * A = Reserved
 */

struct Params {
  width: u32,
  height: u32,
  kernelRadius: u32,
  dt: f32,
  growthCenter: f32,
  growthWidth: f32,
  obstacleRepulsion: f32,
  motorInfluence: f32,
  gradientDiffusion: f32,
  gradientDecay: f32,
  proximityRadius: f32,
  pheromoneEmission: f32,
  pheromoneDiffusion: f32,
  pheromoneDecay: f32,
}

@group(0) @binding(0) var input_main: texture_2d<f32>;
@group(0) @binding(1) var input_aux: texture_2d<f32>;
@group(0) @binding(2) var output_main: texture_storage_2d<rgba32float, write>;
@group(0) @binding(3) var output_aux: texture_storage_2d<rgba32float, write>;
@group(0) @binding(4) var kernel_texture: texture_2d<f32>;
@group(0) @binding(5) var<uniform> params: Params;

// Growth function (Lenia-style polynomial)
fn growth(n: f32, mu: f32, sigma: f32) -> f32 {
  let x = (n - mu) / (3.0 * sigma);
  if (abs(x) >= 1.0) {
    return -1.0;
  }
  let t = 1.0 - x * x;
  return 2.0 * t * t * t * t - 1.0;
}

// Gaussian kernel weight
fn gaussian_weight(dx: f32, dy: f32, sigma: f32) -> f32 {
  let r2 = dx * dx + dy * dy;
  return exp(-r2 / (2.0 * sigma * sigma));
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let x = global_id.x;
  let y = global_id.y;

  if (x >= params.width || y >= params.height) {
    return;
  }

  let coord = vec2<i32>(i32(x), i32(y));
  let radius = i32(params.kernelRadius);

  // Load current state
  let current_main = textureLoad(input_main, coord, 0);
  let current_aux = textureLoad(input_aux, coord, 0);

  let creature = current_main.r;
  let obstacle = current_main.g;
  let gradient_field = current_main.b;
  let motor = current_main.a;
  let proximity = current_aux.r;
  let pheromone = current_aux.g;

  // If this is an obstacle cell, don't update
  if (obstacle > 0.5) {
    textureStore(output_main, coord, current_main);
    textureStore(output_aux, coord, current_aux);
    return;
  }

  // === CREATURE UPDATE (Lenia with sensorimotor modulation) ===

  // Compute convolution for creature channel
  var neighbor_sum = 0.0;
  var kernel_sum = 0.0;
  var gradient_dx = 0.0;
  var gradient_dy = 0.0;
  var motor_accumulator = 0.0;
  var obstacle_penalty = 0.0;
  var nearby_creature_mass = 0.0;
  var pheromone_sum = 0.0;

  let kernel_size = i32(params.kernelRadius * 2u + 1u);

  for (var dy = -radius; dy <= radius; dy++) {
    for (var dx = -radius; dx <= radius; dx++) {
      let dist = sqrt(f32(dx * dx + dy * dy));

      if (dist > f32(radius)) {
        continue;
      }

      // Toroidal coordinates
      let nx = (i32(params.width) + coord.x + dx) % i32(params.width);
      let ny = (i32(params.height) + coord.y + dy) % i32(params.height);
      let neighbor_coord = vec2<i32>(nx, ny);

      let neighbor_main = textureLoad(input_main, neighbor_coord, 0);
      let neighbor_aux = textureLoad(input_aux, neighbor_coord, 0);

      // Sample kernel weight
      let kernel_coord = vec2<i32>(dx + radius, dy + radius);
      let kernel_weight = textureLoad(kernel_texture, kernel_coord, 0).r;

      // Accumulate neighbor creature values (for Lenia convolution)
      neighbor_sum += neighbor_main.r * kernel_weight;
      kernel_sum += kernel_weight;

      // Detect gradient direction
      if (dist > 0.0) {
        let grad_weight = neighbor_main.b / dist;
        gradient_dx += f32(dx) * grad_weight;
        gradient_dy += f32(dy) * grad_weight;
      }

      // Accumulate motor influence from neighbors
      motor_accumulator += neighbor_main.a * kernel_weight;

      // Obstacle repulsion
      if (neighbor_main.g > 0.5 && dist < f32(radius) * 0.5) {
        obstacle_penalty += params.obstacleRepulsion * (1.0 - dist / (f32(radius) * 0.5));
      }

      // Nearby creature detection (for proximity sensor)
      if (dist < params.proximityRadius && dist > 0.0) {
        let prox_weight = 1.0 - dist / params.proximityRadius;
        nearby_creature_mass += neighbor_main.r * prox_weight;
      }

      // Pheromone diffusion
      pheromone_sum += neighbor_aux.g * gaussian_weight(f32(dx), f32(dy), f32(radius) * 0.5);
    }
  }

  // Normalize convolution
  let normalized_sum = select(0.0, neighbor_sum / kernel_sum, kernel_sum > 0.0);

  // Apply growth function
  var growth_value = growth(normalized_sum, params.growthCenter, params.growthWidth);

  // Modulate growth by motor field (asymmetric growth for movement)
  let motor_bias = motor_accumulator * params.motorInfluence;
  growth_value += motor_bias * 0.1;

  // Apply obstacle penalty
  growth_value -= obstacle_penalty;

  // Update creature
  var new_creature = creature + params.dt * growth_value;
  new_creature = clamp(new_creature, 0.0, 1.0);

  // === GRADIENT FIELD UPDATE ===

  // Diffuse gradient
  var new_gradient = gradient_field * (1.0 - params.gradientDecay);

  // Creature emits positive gradient (for other creatures to sense)
  new_gradient += creature * 0.1;
  new_gradient = clamp(new_gradient, 0.0, 1.0);

  // === MOTOR FIELD UPDATE ===

  // Motor field points toward gradient (simple chemotaxis)
  let grad_magnitude = sqrt(gradient_dx * gradient_dx + gradient_dy * gradient_dy);
  var new_motor = motor * 0.9;  // Decay

  // If creature is here and there's a gradient, create motor field
  if (creature > 0.1 && grad_magnitude > 0.01) {
    // Normalize gradient direction and add to motor field
    new_motor += (gradient_dx / grad_magnitude) * creature * 0.1;
  }
  new_motor = clamp(new_motor, -1.0, 1.0);

  // === PROXIMITY SENSOR UPDATE ===

  var new_proximity = nearby_creature_mass * 0.1;
  new_proximity = clamp(new_proximity, 0.0, 1.0);

  // === PHEROMONE UPDATE ===

  // Diffuse and decay pheromone
  var new_pheromone = pheromone_sum * params.pheromoneDiffusion;
  new_pheromone *= (1.0 - params.pheromoneDecay);

  // Creature emits pheromone
  new_pheromone += creature * params.pheromoneEmission;
  new_pheromone = clamp(new_pheromone, 0.0, 1.0);

  // Write outputs
  textureStore(output_main, coord, vec4<f32>(new_creature, obstacle, new_gradient, new_motor));
  textureStore(output_aux, coord, vec4<f32>(new_proximity, new_pheromone, 0.0, 0.0));
}
