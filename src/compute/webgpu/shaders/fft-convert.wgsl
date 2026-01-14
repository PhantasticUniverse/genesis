/**
 * FFT Format Conversion Shaders
 * Convert between real (r32float) and complex (rg32float) formats
 */

struct ConvertParams {
  width: u32,
  height: u32,
  scale: f32,
  _padding: u32,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var output_texture: texture_storage_2d<rg32float, write>;
@group(0) @binding(2) var<uniform> params: ConvertParams;

/**
 * Convert real texture (r32float) to complex (rg32float)
 * Sets imaginary part to 0
 */
@compute @workgroup_size(16, 16)
fn real_to_complex(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let x = global_id.x;
  let y = global_id.y;

  if (x >= params.width || y >= params.height) {
    return;
  }

  let coord = vec2<i32>(i32(x), i32(y));
  let real_val = textureLoad(input_texture, coord, 0).r;

  // Store as complex: (real, 0)
  textureStore(output_texture, coord, vec4<f32>(real_val, 0.0, 0.0, 0.0));
}

// Separate binding for extracting real part
@group(0) @binding(3) var output_real: texture_storage_2d<r32float, write>;

/**
 * Extract real part from complex texture
 * Applies scaling (for FFT normalization)
 */
@compute @workgroup_size(16, 16)
fn complex_to_real(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let x = global_id.x;
  let y = global_id.y;

  if (x >= params.width || y >= params.height) {
    return;
  }

  let coord = vec2<i32>(i32(x), i32(y));
  let complex_val = textureLoad(input_texture, coord, 0).rg;

  // Extract and scale real part
  let real_val = complex_val.x * params.scale;

  textureStore(output_real, coord, vec4<f32>(real_val, 0.0, 0.0, 0.0));
}

/**
 * Apply growth function after convolution
 * Combines FFT result with growth calculation
 */
@compute @workgroup_size(16, 16)
fn apply_growth(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let x = global_id.x;
  let y = global_id.y;

  if (x >= params.width || y >= params.height) {
    return;
  }

  let coord = vec2<i32>(i32(x), i32(y));

  // Load convolution result (neighbor sum from FFT)
  let neighbor_sum = textureLoad(input_texture, coord, 0).r;

  // Apply polynomial growth function
  // growth(n) = 2 * (1 - ((n - mu) / (3 * sigma))^2)^4 - 1
  let mu = 0.15;    // Will be passed via uniform
  let sigma = 0.03;
  let dt = 0.1;

  let x_val = (neighbor_sum - mu) / (3.0 * sigma);
  var growth_val: f32;

  if (abs(x_val) >= 1.0) {
    growth_val = -1.0;
  } else {
    let t = 1.0 - x_val * x_val;
    growth_val = 2.0 * t * t * t * t - 1.0;
  }

  // Read current state and update
  // Note: This would need a separate current state binding
  // let current = textureLoad(current_state, coord, 0).r;
  // let new_val = clamp(current + dt * growth_val, 0.0, 1.0);

  // For now, just output the growth value
  textureStore(output_real, coord, vec4<f32>(growth_val, 0.0, 0.0, 0.0));
}
