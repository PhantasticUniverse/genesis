/**
 * Training Backward Pass Shader
 * Computes gradients for backpropagation through one CA step
 *
 * Inputs:
 * - state_gradient: dL/d(new_state) from next layer
 * - prev_state: State before this step
 * - neighbor_sums: Convolution results from forward pass
 * - growth_values: Growth outputs from forward pass
 *
 * Outputs:
 * - prev_state_gradient: dL/d(prev_state) to propagate backward
 * - param_gradients: Accumulated gradients for μ, σ, dt (stored in reduction buffer)
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

@group(0) @binding(0) var state_gradient: texture_2d<f32>;           // dL/d(new_state)
@group(0) @binding(1) var prev_state: texture_2d<f32>;               // State before step
@group(0) @binding(2) var neighbor_sums: texture_2d<f32>;            // From forward pass
@group(0) @binding(3) var growth_values: texture_2d<f32>;            // From forward pass
@group(0) @binding(4) var kernel_texture: texture_2d<f32>;           // Kernel weights
@group(0) @binding(5) var output_prev_gradient: texture_storage_2d<r32float, write>;  // dL/d(prev_state)
@group(0) @binding(6) var<storage, read_write> param_gradients: array<atomic<u32>, 4>; // μ, σ, dt, count (as fixed-point)
@group(0) @binding(7) var<uniform> params: Params;

// Derivative of soft growth w.r.t. n (neighbor sum)
fn soft_growth_derivative_n(n: f32, mu: f32, sigma: f32) -> f32 {
  let x = (n - mu) / (3.0 * sigma);
  if (abs(x) >= 1.0) {
    return 0.0;
  }
  let t = 1.0 - x * x;
  let t3 = t * t * t;
  // d/dn of 2*(1-x²)⁴ - 1 = 2*4*(1-x²)³*(-2x)*(1/(3σ))
  return 2.0 * 4.0 * t3 * (-2.0 * x) * (1.0 / (3.0 * sigma));
}

// Derivative of soft growth w.r.t. μ
fn soft_growth_derivative_mu(n: f32, mu: f32, sigma: f32) -> f32 {
  // dx/dμ = -1/(3σ), so dg/dμ = dg/dx * dx/dμ = -dg/dn
  return -soft_growth_derivative_n(n, mu, sigma);
}

// Derivative of soft growth w.r.t. σ
fn soft_growth_derivative_sigma(n: f32, mu: f32, sigma: f32) -> f32 {
  let x = (n - mu) / (3.0 * sigma);
  if (abs(x) >= 1.0) {
    return 0.0;
  }
  let t = 1.0 - x * x;
  let t3 = t * t * t;
  // dx/dσ = -x/σ
  let dxds = -x / sigma;
  return 2.0 * 4.0 * t3 * (-2.0 * x) * dxds;
}

// Convert float to fixed-point for atomic accumulation (16.16 format)
fn float_to_fixed(f: f32) -> i32 {
  return i32(f * 65536.0);
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

  // Load values from forward pass
  let grad_new_state = textureLoad(state_gradient, coord, 0).r;
  let prev_val = textureLoad(prev_state, coord, 0).r;
  let n_sum = textureLoad(neighbor_sums, coord, 0).r;
  let growth_val = textureLoad(growth_values, coord, 0).r;

  // Gradient through clamp
  // new_val = clamp(prev + dt * growth, 0, 1)
  // If new_val was clamped, gradient is 0; otherwise pass through
  let new_val_unclamped = prev_val + params.dt * growth_val;
  let clamp_grad = select(0.0, grad_new_state, new_val_unclamped > 0.0 && new_val_unclamped < 1.0);

  // Gradient through state update
  // new = prev + dt * growth
  // dL/d_growth = clamp_grad * dt
  let growth_grad = clamp_grad * params.dt;

  // Accumulate gradient for dt: dL/d_dt = clamp_grad * growth_val
  let dt_grad = clamp_grad * growth_val;

  // Gradient through growth function
  let dgdn = soft_growth_derivative_n(n_sum, params.growth_center, params.growth_width);
  let dgdmu = soft_growth_derivative_mu(n_sum, params.growth_center, params.growth_width);
  let dgdsigma = soft_growth_derivative_sigma(n_sum, params.growth_center, params.growth_width);

  let n_sum_grad = growth_grad * dgdn;
  let mu_grad = growth_grad * dgdmu;
  let sigma_grad = growth_grad * dgdsigma;

  // Accumulate parameter gradients using atomic operations
  // Note: We use fixed-point representation since WebGPU doesn't support atomic floats
  atomicAdd(&param_gradients[0], u32(float_to_fixed(mu_grad)));
  atomicAdd(&param_gradients[1], u32(float_to_fixed(sigma_grad)));
  atomicAdd(&param_gradients[2], u32(float_to_fixed(dt_grad)));
  atomicAdd(&param_gradients[3], 1u);  // Count for averaging

  // Gradient through convolution to previous state
  // n_sum = sum(prev[i] * kernel[i]) / kernel_sum
  // dL/d_prev[j] = sum over all positions where prev[j] was used in convolution
  // This requires scattering gradients back through the kernel

  // Compute kernel sum for normalization
  var kernel_sum = 0.0;
  for (var ky = 0; ky < kernel_size; ky++) {
    for (var kx = 0; kx < kernel_size; kx++) {
      kernel_sum += textureLoad(kernel_texture, vec2<i32>(kx, ky), 0).r;
    }
  }

  // For the gradient to previous state at this position:
  // This position (x,y) is used by all neighbors within kernel radius
  var prev_grad = clamp_grad; // Direct gradient from state update (prev -> new)

  // Add contribution from being a neighbor in other cells' convolutions
  // We need to sum: for each cell (nx, ny) that uses (x,y) as neighbor:
  //   d_n_sum[nx,ny]/d_prev[x,y] * n_sum_grad[nx,ny]
  // = kernel_weight[offset] / kernel_sum * n_sum_grad[nx,ny]

  if (kernel_sum > 0.0) {
    for (var ky = 0; ky < kernel_size; ky++) {
      for (var kx = 0; kx < kernel_size; kx++) {
        // This cell was used as neighbor by cell at offset (-kx+radius, -ky+radius)
        let nx = (i32(x) - kx + radius + i32(params.width)) % i32(params.width);
        let ny = (i32(y) - ky + radius + i32(params.height)) % i32(params.height);

        let neighbor_coord = vec2<i32>(nx, ny);
        let neighbor_n_sum = textureLoad(neighbor_sums, neighbor_coord, 0).r;
        let neighbor_growth_grad = textureLoad(state_gradient, neighbor_coord, 0).r * params.dt;

        let neighbor_dgdn = soft_growth_derivative_n(neighbor_n_sum, params.growth_center, params.growth_width);
        let neighbor_n_sum_grad = neighbor_growth_grad * neighbor_dgdn;

        // Kernel weight at this offset
        let kernel_weight = textureLoad(kernel_texture, vec2<i32>(kx, ky), 0).r;

        prev_grad += neighbor_n_sum_grad * kernel_weight / kernel_sum;
      }
    }
  }

  // Store gradient for previous state
  textureStore(output_prev_gradient, coord, vec4<f32>(prev_grad, 0.0, 0.0, 0.0));
}
