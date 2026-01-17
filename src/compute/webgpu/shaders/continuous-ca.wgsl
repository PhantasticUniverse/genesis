/**
 * Continuous CA Shader (Lenia / SmoothLife)
 * Uses convolution with smooth kernels and growth functions
 */

struct Params {
    width: u32,
    height: u32,
    kernel_radius: u32,
    kernel_size: u32,
    growth_center: f32,    // μ
    growth_width: f32,     // σ
    dt: f32,               // Time step
    growth_type: u32,      // 0=polynomial, 1=gaussian, 2=step
    normalization_factor: f32, // Mass conservation factor (1.0 = disabled)
    boundary_mode: u32,    // 0=periodic, 1=clamped, 2=reflected, 3=zero
    _padding1: u32,
    _padding2: u32,
}

@group(0) @binding(0) var state_in: texture_2d<f32>;
@group(0) @binding(1) var state_out: texture_storage_2d<r32float, write>;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var kernel_texture: texture_2d<f32>;

// Boundary condition result
struct BoundaryResult {
    coord: vec2<i32>,
    valid: bool,  // If false, treat as zero (out of bounds)
}

// Apply boundary conditions based on mode
// 0 = periodic (toroidal wrap)
// 1 = clamped (clamp to edge)
// 2 = reflected (mirror at boundary)
// 3 = zero (out of bounds = 0)
fn apply_boundary(coord: vec2<i32>, width: i32, height: i32, mode: u32) -> BoundaryResult {
    var result: BoundaryResult;
    result.valid = true;

    var x = coord.x;
    var y = coord.y;

    switch (mode) {
        case 0u: {
            // Periodic (toroidal) - wrap around
            if (x < 0) { x = x + width; }
            if (y < 0) { y = y + height; }
            if (x >= width) { x = x - width; }
            if (y >= height) { y = y - height; }
        }
        case 1u: {
            // Clamped - clamp to edge
            x = clamp(x, 0, width - 1);
            y = clamp(y, 0, height - 1);
        }
        case 2u: {
            // Reflected - mirror at boundary
            if (x < 0) { x = -x - 1; }
            if (y < 0) { y = -y - 1; }
            if (x >= width) { x = 2 * width - x - 1; }
            if (y >= height) { y = 2 * height - y - 1; }
            // Additional clamp for safety with large kernels
            x = clamp(x, 0, width - 1);
            y = clamp(y, 0, height - 1);
        }
        case 3u: {
            // Zero - out of bounds returns 0
            if (x < 0 || x >= width || y < 0 || y >= height) {
                result.valid = false;
            }
        }
        default: {
            // Default to periodic
            if (x < 0) { x = x + width; }
            if (y < 0) { y = y + height; }
            if (x >= width) { x = x - width; }
            if (y >= height) { y = y - height; }
        }
    }

    result.coord = vec2<i32>(x, y);
    return result;
}

// Polynomial growth function (Lenia style)
// g(n) = 2 * (1 - ((n - μ) / (3σ))^2)^4 - 1
fn growth_polynomial(n: f32, mu: f32, sigma: f32) -> f32 {
    let x = (n - mu) / (3.0 * sigma);
    if (abs(x) >= 1.0) {
        return -1.0;
    }
    let t = 1.0 - x * x;
    return 2.0 * t * t * t * t - 1.0;
}

// Gaussian growth function
// g(n) = 2 * exp(-((n - μ)^2) / (2σ^2)) - 1
fn growth_gaussian(n: f32, mu: f32, sigma: f32) -> f32 {
    let d = (n - mu) / sigma;
    return 2.0 * exp(-0.5 * d * d) - 1.0;
}

// Sigmoid helper function
fn sigmoid(x: f32, c: f32) -> f32 {
    return 1.0 / (1.0 + exp(-(x - c) * 50.0));
}

// Step growth function (SmoothLife-like)
fn growth_step(n: f32, current: f32, mu: f32, sigma: f32) -> f32 {
    let birth_low = mu - sigma;
    let birth_high = mu + sigma;
    let death_low = mu - 2.0 * sigma;
    let death_high = mu + 4.0 * sigma;

    // Birth/survival probability
    let birth_p = sigmoid(n, birth_low) * (1.0 - sigmoid(n, birth_high));
    let survive_p = sigmoid(n, death_low) * (1.0 - sigmoid(n, death_high));

    let p = current * survive_p + (1.0 - current) * birth_p;
    return 2.0 * p - 1.0;
}

// Calculate growth based on type
fn calculate_growth(n: f32, current: f32, mu: f32, sigma: f32, growth_type: u32) -> f32 {
    switch (growth_type) {
        case 0u: {
            return growth_polynomial(n, mu, sigma);
        }
        case 1u: {
            return growth_gaussian(n, mu, sigma);
        }
        case 2u: {
            // Simplified step - treat as gaussian for now
            return growth_gaussian(n, mu, sigma);
        }
        default: {
            return growth_polynomial(n, mu, sigma);
        }
    }
}

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;

    // Bounds check
    if (x >= params.width || y >= params.height) {
        return;
    }

    let coord = vec2<i32>(i32(x), i32(y));
    let radius = i32(params.kernel_radius);
    let kernel_size = i32(params.kernel_size);

    // Current state
    let current_state = textureLoad(state_in, vec2<u32>(coord), 0).r;

    // Convolution: sum of (neighbor * kernel_weight)
    var weighted_sum: f32 = 0.0;
    var kernel_sum: f32 = 0.0;
    let w = i32(params.width);
    let h = i32(params.height);

    for (var ky: i32 = 0; ky < kernel_size; ky = ky + 1) {
        for (var kx: i32 = 0; kx < kernel_size; kx = kx + 1) {
            // Neighbor position
            let neighbor_coord = vec2<i32>(coord.x + kx - radius, coord.y + ky - radius);

            // Apply boundary conditions
            let boundary = apply_boundary(neighbor_coord, w, h, params.boundary_mode);

            // Get kernel weight (always valid)
            let kernel_weight = textureLoad(kernel_texture, vec2<u32>(u32(kx), u32(ky)), 0).r;

            // Get neighbor state (or 0 if out of bounds in zero mode)
            var neighbor_state: f32 = 0.0;
            if (boundary.valid) {
                neighbor_state = textureLoad(state_in, vec2<u32>(u32(boundary.coord.x), u32(boundary.coord.y)), 0).r;
            }

            weighted_sum = weighted_sum + neighbor_state * kernel_weight;
            kernel_sum = kernel_sum + kernel_weight;
        }
    }

    // Normalize convolution result
    var n: f32 = 0.0;
    if (kernel_sum > 0.0) {
        n = weighted_sum / kernel_sum;
    }

    // Calculate growth
    let growth = calculate_growth(
        n,
        current_state,
        params.growth_center,
        params.growth_width,
        params.growth_type
    );

    // Apply growth with time integration
    // Multiply delta by normalization factor for mass conservation
    var delta = params.dt * growth * params.normalization_factor;
    var new_state = current_state + delta;

    // Clamp to valid range
    new_state = clamp(new_state, 0.0, 1.0);

    // Write output
    textureStore(state_out, vec2<u32>(coord), vec4<f32>(new_state, 0.0, 0.0, 1.0));
}
