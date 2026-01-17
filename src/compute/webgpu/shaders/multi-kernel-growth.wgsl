/**
 * Multi-Kernel Lenia Growth Shader (FFT Path)
 * Applies growth functions to pre-computed convolution results from FFT
 *
 * This shader receives up to 4 convolution result textures (one per kernel)
 * and combines them according to the growth parameters and combination mode.
 */

// Maximum supported kernels
const MAX_KERNELS: u32 = 4u;

// Per-kernel growth parameters
struct KernelGrowthParams {
    growth_center: f32,    // mu
    growth_width: f32,     // sigma
    weight: f32,           // kernel contribution weight
    growth_type: u32,      // 0=polynomial, 1=gaussian, 2=step
}

struct Params {
    width: u32,
    height: u32,
    num_kernels: u32,
    combination_mode: u32,     // 0=sum, 1=average, 2=weighted
    dt: f32,
    _padding0: u32,
    _padding1: u32,
    _padding2: u32,
    // Per-kernel growth params (4 structs)
    growth_params: array<KernelGrowthParams, 4>,
}

@group(0) @binding(0) var current_state: texture_2d<f32>;
@group(0) @binding(1) var convolution_results: texture_2d_array<f32>;  // Up to 4 layers, one per kernel
@group(0) @binding(2) var state_out: texture_storage_2d<r32float, write>;
@group(0) @binding(3) var<uniform> params: Params;

// Polynomial growth function (Lenia style)
fn growth_polynomial(n: f32, mu: f32, sigma: f32) -> f32 {
    let x = (n - mu) / (3.0 * sigma);
    if (abs(x) >= 1.0) {
        return -1.0;
    }
    let t = 1.0 - x * x;
    return 2.0 * t * t * t * t - 1.0;
}

// Gaussian growth function
fn growth_gaussian(n: f32, mu: f32, sigma: f32) -> f32 {
    let d = (n - mu) / sigma;
    return 2.0 * exp(-0.5 * d * d) - 1.0;
}

// Calculate growth based on type
fn calculate_growth(n: f32, mu: f32, sigma: f32, growth_type: u32) -> f32 {
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

    // Process each kernel and accumulate growth
    var total_growth: f32 = 0.0;
    var total_weight: f32 = 0.0;

    let num_kernels = min(params.num_kernels, MAX_KERNELS);

    for (var i: u32 = 0u; i < num_kernels; i = i + 1u) {
        // Get convolution result for this kernel from texture array layer
        let n = textureLoad(convolution_results, coord, i).r;

        // Get growth parameters for this kernel
        let gp = params.growth_params[i];

        // Calculate growth for this kernel
        let growth = calculate_growth(n, gp.growth_center, gp.growth_width, gp.growth_type);

        // Accumulate based on combination mode
        switch (params.combination_mode) {
            case 0u: {
                // Sum mode: add weighted growths
                total_growth = total_growth + gp.weight * growth;
            }
            case 1u: {
                // Average mode: equal contribution
                total_growth = total_growth + growth;
                total_weight = total_weight + 1.0;
            }
            case 2u: {
                // Weighted average mode
                total_growth = total_growth + gp.weight * growth;
                total_weight = total_weight + gp.weight;
            }
            default: {
                total_growth = total_growth + gp.weight * growth;
            }
        }
    }

    // Finalize growth based on combination mode
    var final_growth: f32;
    switch (params.combination_mode) {
        case 0u: {
            // Sum mode: already computed
            final_growth = total_growth;
        }
        case 1u: {
            // Average mode
            if (total_weight > 0.0) {
                final_growth = total_growth / total_weight;
            } else {
                final_growth = 0.0;
            }
        }
        case 2u: {
            // Weighted average mode
            if (total_weight > 0.0) {
                final_growth = total_growth / total_weight;
            } else {
                final_growth = 0.0;
            }
        }
        default: {
            final_growth = total_growth;
        }
    }

    // Apply growth with time integration
    var new_state = current + params.dt * final_growth;

    // Clamp to valid range
    new_state = clamp(new_state, 0.0, 1.0);

    // Write output
    textureStore(state_out, coord, vec4<f32>(new_state, 0.0, 0.0, 1.0));
}
