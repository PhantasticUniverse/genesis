/**
 * Multi-Kernel Lenia CA Shader (Direct Convolution Path)
 * Processes up to 4 kernels simultaneously with independent growth functions
 */

// Maximum supported kernels
const MAX_KERNELS: u32 = 4u;

// Per-kernel growth parameters (packed for alignment)
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
    kernel_max_size: u32,      // Size of largest kernel (for texture array)
    _padding0: u32,
    _padding1: u32,
    // Per-kernel radii (4 values packed)
    kernel_radii: vec4<u32>,
    // Per-kernel growth params (4 structs, 16 floats total)
    growth_params: array<KernelGrowthParams, 4>,
}

@group(0) @binding(0) var state_in: texture_2d<f32>;
@group(0) @binding(1) var state_out: texture_storage_2d<r32float, write>;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var kernel_textures: texture_2d_array<f32>;

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

// Get kernel radius for given index
fn get_kernel_radius(index: u32) -> u32 {
    switch (index) {
        case 0u: { return params.kernel_radii.x; }
        case 1u: { return params.kernel_radii.y; }
        case 2u: { return params.kernel_radii.z; }
        case 3u: { return params.kernel_radii.w; }
        default: { return params.kernel_radii.x; }
    }
}

// Perform convolution for a single kernel
fn convolve_kernel(coord: vec2<i32>, kernel_index: u32) -> f32 {
    let radius = i32(get_kernel_radius(kernel_index));
    let kernel_size = 2 * radius + 1;
    let max_size = i32(params.kernel_max_size);

    // Calculate padding offset to center smaller kernels in texture array
    let padding = (max_size - kernel_size) / 2;

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

            // Get neighbor state
            let neighbor_state = textureLoad(state_in, vec2<u32>(u32(nx), u32(ny)), 0).r;

            // Get kernel weight (with padding offset)
            let kernel_coord = vec2<u32>(u32(kx + padding), u32(ky + padding));
            let kernel_weight = textureLoad(kernel_textures, kernel_coord, kernel_index).r;

            weighted_sum = weighted_sum + neighbor_state * kernel_weight;
            kernel_sum = kernel_sum + kernel_weight;
        }
    }

    // Normalize convolution result
    if (kernel_sum > 0.0) {
        return weighted_sum / kernel_sum;
    }
    return 0.0;
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

    // Current state
    let current_state = textureLoad(state_in, vec2<u32>(coord), 0).r;

    // Process each kernel and accumulate growth
    var total_growth: f32 = 0.0;
    var total_weight: f32 = 0.0;

    let num_kernels = min(params.num_kernels, MAX_KERNELS);

    for (var i: u32 = 0u; i < num_kernels; i = i + 1u) {
        // Get convolution result for this kernel
        let n = convolve_kernel(coord, i);

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
    var new_state = current_state + params.dt * final_growth;

    // Clamp to valid range
    new_state = clamp(new_state, 0.0, 1.0);

    // Write output
    textureStore(state_out, vec2<u32>(coord), vec4<f32>(new_state, 0.0, 0.0, 1.0));
}
