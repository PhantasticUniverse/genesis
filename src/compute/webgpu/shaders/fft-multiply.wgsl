/**
 * FFT Multiply Shader
 * Performs pointwise complex multiplication in frequency domain
 *
 * For convolution: result = state * kernel (in frequency domain)
 * Also handles scaling for inverse FFT normalization
 */

struct MultiplyParams {
  width: u32,
  height: u32,
  scale: f32,      // Normalization factor (1/(width*height) for inverse)
  _padding: u32,
}

@group(0) @binding(0) var state_fft: texture_2d<f32>;
@group(0) @binding(1) var kernel_fft: texture_2d<f32>;
@group(0) @binding(2) var output_texture: texture_storage_2d<rg32float, write>;
@group(0) @binding(3) var<uniform> params: MultiplyParams;

// Complex multiplication: (a + bi) * (c + di) = (ac - bd) + (ad + bc)i
fn complex_mul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(
    a.x * b.x - a.y * b.y,
    a.x * b.y + a.y * b.x
  );
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let x = global_id.x;
  let y = global_id.y;

  if (x >= params.width || y >= params.height) {
    return;
  }

  let coord = vec2<i32>(i32(x), i32(y));

  // Load complex values
  let state_val = textureLoad(state_fft, coord, 0).rg;
  let kernel_val = textureLoad(kernel_fft, coord, 0).rg;

  // Multiply in frequency domain
  var result = complex_mul(state_val, kernel_val);

  // Apply scaling
  result *= params.scale;

  textureStore(output_texture, coord, vec4<f32>(result, 0.0, 0.0));
}

/**
 * Alternative entry point for extracting real part after inverse FFT
 */
@compute @workgroup_size(16, 16)
fn extract_real(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let x = global_id.x;
  let y = global_id.y;

  if (x >= params.width || y >= params.height) {
    return;
  }

  let coord = vec2<i32>(i32(x), i32(y));

  // Load complex value and extract real part
  let complex_val = textureLoad(state_fft, coord, 0).rg;
  let real_val = complex_val.x * params.scale;

  // Store as single-channel result
  textureStore(output_texture, coord, vec4<f32>(real_val, 0.0, 0.0, 0.0));
}
