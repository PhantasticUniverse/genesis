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
}

@group(0) @binding(0) var state_in: texture_2d<f32>;
@group(0) @binding(1) var state_out: texture_storage_2d<r32float, write>;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var kernel_texture: texture_2d<f32>;

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

    for (var ky: i32 = 0; ky < kernel_size; ky = ky + 1) {
        for (var kx: i32 = 0; kx < kernel_size; kx = kx + 1) {
            // Neighbor position with toroidal wrapping
            var nx = coord.x + kx - radius;
            var ny = coord.y + ky - radius;

            // Toroidal wrap
            if (nx < 0) { nx = nx + i32(params.width); }
            if (ny < 0) { ny = ny + i32(params.height); }
            if (nx >= i32(params.width)) { nx = nx - i32(params.width); }
            if (ny >= i32(params.height)) { ny = ny - i32(params.height); }

            // Get neighbor state and kernel weight
            let neighbor_state = textureLoad(state_in, vec2<u32>(u32(nx), u32(ny)), 0).r;
            let kernel_weight = textureLoad(kernel_texture, vec2<u32>(u32(kx), u32(ky)), 0).r;

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
    var new_state = current_state + params.dt * growth;

    // Clamp to valid range
    new_state = clamp(new_state, 0.0, 1.0);

    // Write output
    textureStore(state_out, vec2<u32>(coord), vec4<f32>(new_state, 0.0, 0.0, 1.0));
}
