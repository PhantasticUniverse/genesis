/**
 * Continuous CA Growth Shader
 * Applies growth function to convolution result (used with FFT path)
 *
 * Input: convolution result (neighbor sum) texture
 * Output: updated state texture
 */

struct Params {
    width: u32,
    height: u32,
    growth_center: f32,    // μ
    growth_width: f32,     // σ
    dt: f32,               // Time step
    growth_type: u32,      // 0=polynomial, 1=gaussian, 2=step
    normalization_factor: f32, // Mass conservation factor (1.0 = disabled)
    _padding0: u32,
}

@group(0) @binding(0) var current_state: texture_2d<f32>;
@group(0) @binding(1) var convolution_result: texture_2d<f32>;
@group(0) @binding(2) var state_out: texture_storage_2d<r32float, write>;
@group(0) @binding(3) var<uniform> params: Params;

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

// Calculate growth based on type
fn calculate_growth(n: f32, current: f32, mu: f32, sigma: f32, growth_type: u32) -> f32 {
    switch (growth_type) {
        case 0u: {
            return growth_polynomial(n, mu, sigma);
        }
        case 1u: {
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

    let coord = vec2<u32>(x, y);

    // Load current state
    let current = textureLoad(current_state, coord, 0).r;

    // Load convolution result (normalized neighbor sum from FFT)
    let n = textureLoad(convolution_result, coord, 0).r;

    // Calculate growth
    let growth = calculate_growth(
        n,
        current,
        params.growth_center,
        params.growth_width,
        params.growth_type
    );

    // Apply growth with time integration
    // Multiply delta by normalization factor for mass conservation
    var delta = params.dt * growth * params.normalization_factor;
    var new_state = current + delta;

    // Clamp to valid range
    new_state = clamp(new_state, 0.0, 1.0);

    // Write output
    textureStore(state_out, coord, vec4<f32>(new_state, 0.0, 0.0, 1.0));
}
