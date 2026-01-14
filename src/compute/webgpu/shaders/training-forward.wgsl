/**
 * Training Forward Pass Shader
 * Computes one CA step and stores intermediate values for backpropagation
 *
 * Outputs:
 * - new_state: Updated cell values after growth
 * - neighbor_sums: Convolution results (needed for gradient computation)
 * - growth_values: Growth function outputs (needed for gradient computation)
 */

struct Params {
  width: u32,
  height: u32,
  kernel_radius: u32,
  growth_center: f32,   // μ
  growth_width: f32,    // σ
  dt: f32,
  _padding: vec2<f32>,
}

@group(0) @binding(0) var input_state: texture_2d<f32>;
@group(0) @binding(1) var output_state: texture_storage_2d<r32float, write>;
@group(0) @binding(2) var output_neighbor_sums: texture_storage_2d<r32float, write>;
@group(0) @binding(3) var output_growth_values: texture_storage_2d<r32float, write>;
@group(0) @binding(4) var kernel_texture: texture_2d<f32>;
@group(0) @binding(5) var<uniform> params: Params;

// Soft growth function (differentiable)
fn soft_growth(n: f32, mu: f32, sigma: f32) -> f32 {
  let x = (n - mu) / (3.0 * sigma);
  if (abs(x) >= 1.0) {
    return -1.0;
  }
  let t = 1.0 - x * x;
  let t4 = t * t * t * t;
  return 2.0 * t4 - 1.0;
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let x = global_id.x;
  let y = global_id.y;

  if (x >= params.width || y >= params.height) {
    return;
  }

  let coord = vec2<i32>(i32(x), i32(y));
  let radius = i32(params.kernel_radius);
  let kernel_size = i32(params.kernel_radius * 2u + 1u);

  // Convolution with kernel
  var neighbor_sum = 0.0;
  var kernel_sum = 0.0;

  for (var ky = 0; ky < kernel_size; ky++) {
    for (var kx = 0; kx < kernel_size; kx++) {
      // Wrap coordinates (toroidal boundary)
      let nx = (i32(x) + kx - radius + i32(params.width)) % i32(params.width);
      let ny = (i32(y) + ky - radius + i32(params.height)) % i32(params.height);

      let neighbor_coord = vec2<i32>(nx, ny);
      let kernel_coord = vec2<i32>(kx, ky);

      let neighbor_val = textureLoad(input_state, neighbor_coord, 0).r;
      let kernel_weight = textureLoad(kernel_texture, kernel_coord, 0).r;

      neighbor_sum += neighbor_val * kernel_weight;
      kernel_sum += kernel_weight;
    }
  }

  // Normalize by kernel sum
  let normalized_sum = select(0.0, neighbor_sum / kernel_sum, kernel_sum > 0.0);

  // Apply growth function
  let growth_val = soft_growth(normalized_sum, params.growth_center, params.growth_width);

  // Update state with clamping
  let current_val = textureLoad(input_state, coord, 0).r;
  let new_val = clamp(current_val + params.dt * growth_val, 0.0, 1.0);

  // Store outputs
  textureStore(output_state, coord, vec4<f32>(new_val, 0.0, 0.0, 0.0));
  textureStore(output_neighbor_sums, coord, vec4<f32>(normalized_sum, 0.0, 0.0, 0.0));
  textureStore(output_growth_values, coord, vec4<f32>(growth_val, 0.0, 0.0, 0.0));
}
