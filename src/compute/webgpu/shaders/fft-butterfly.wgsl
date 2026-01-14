/**
 * FFT Butterfly Shader (Stockham Algorithm)
 * Performs one pass of the FFT butterfly operation
 *
 * Complex numbers are stored as vec2<f32> (real, imaginary)
 * The texture format is rg32float for complex values
 */

struct FFTParams {
  size: u32,           // FFT size (must be power of 2)
  stage: u32,          // Current FFT stage (0 to log2(size)-1)
  direction: i32,      // 1 for forward FFT, -1 for inverse FFT
  horizontal: u32,     // 1 for horizontal pass, 0 for vertical
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var output_texture: texture_storage_2d<rg32float, write>;
@group(0) @binding(2) var<uniform> params: FFTParams;

const PI: f32 = 3.14159265359;

// Complex multiplication: (a + bi) * (c + di) = (ac - bd) + (ad + bc)i
fn complex_mul(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  return vec2<f32>(
    a.x * b.x - a.y * b.y,
    a.x * b.y + a.y * b.x
  );
}

// Twiddle factor: e^(-2*pi*i*k/N) for forward, e^(2*pi*i*k/N) for inverse
// For DFT: forward uses negative angle, inverse uses positive angle
fn twiddle(k: u32, n: u32, direction: i32) -> vec2<f32> {
  // direction=1 for forward (needs -angle), direction=-1 for inverse (needs +angle)
  let angle = -f32(direction) * 2.0 * PI * f32(k) / f32(n);
  return vec2<f32>(cos(angle), sin(angle));
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let x = global_id.x;
  let y = global_id.y;

  if (x >= params.size || y >= params.size) {
    return;
  }

  // Determine which dimension we're working on
  let pos = select(y, x, params.horizontal == 1u);
  let other = select(x, y, params.horizontal == 1u);

  // Calculate butterfly indices for Stockham algorithm
  let stage_size = 1u << (params.stage + 1u);  // 2^(stage+1)
  let half_stage = stage_size >> 1u;           // 2^stage

  // Which butterfly group and position within group
  let group = pos / stage_size;
  let pos_in_group = pos % stage_size;

  // Determine if we're computing the top or bottom of butterfly
  let is_top = pos_in_group < half_stage;
  let butterfly_pos = pos_in_group % half_stage;

  // Source indices
  let src_top = group * stage_size + butterfly_pos;
  let src_bot = src_top + half_stage;

  // Load source values
  var coord_top: vec2<i32>;
  var coord_bot: vec2<i32>;

  if (params.horizontal == 1u) {
    coord_top = vec2<i32>(i32(src_top), i32(other));
    coord_bot = vec2<i32>(i32(src_bot), i32(other));
  } else {
    coord_top = vec2<i32>(i32(other), i32(src_top));
    coord_bot = vec2<i32>(i32(other), i32(src_bot));
  }

  let val_top = textureLoad(input_texture, coord_top, 0).rg;
  let val_bot = textureLoad(input_texture, coord_bot, 0).rg;

  // Compute twiddle factor
  let twiddle_idx = butterfly_pos * (params.size / stage_size);
  let w = twiddle(twiddle_idx, params.size, params.direction);

  // Butterfly operation
  let wb = complex_mul(w, val_bot);
  var result: vec2<f32>;

  if (is_top) {
    result = val_top + wb;
  } else {
    result = val_top - wb;
  }

  // Write output
  var out_coord: vec2<i32>;
  if (params.horizontal == 1u) {
    out_coord = vec2<i32>(i32(x), i32(y));
  } else {
    out_coord = vec2<i32>(i32(x), i32(y));
  }

  textureStore(output_texture, out_coord, vec4<f32>(result, 0.0, 0.0));
}
