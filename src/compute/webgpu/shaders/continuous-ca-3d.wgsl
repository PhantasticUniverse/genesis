/**
 * 3D Continuous CA Shader (3D Lenia)
 * Uses 3D convolution with spherical kernels and growth functions
 */

struct Params {
    width: u32,
    height: u32,
    depth: u32,
    kernel_radius: u32,
    growth_center: f32,    // μ
    growth_width: f32,     // σ
    dt: f32,               // Time step
    _padding: u32,         // Padding for alignment
}

@group(0) @binding(0) var state_in: texture_3d<f32>;
@group(0) @binding(1) var state_out: texture_storage_3d<r32float, write>;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var kernel_texture: texture_3d<f32>;

// Gaussian growth function
// g(n) = 2 * exp(-((n - μ)^2) / (2σ^2)) - 1
fn growth_gaussian(n: f32, mu: f32, sigma: f32) -> f32 {
    let d = (n - mu) / sigma;
    return 2.0 * exp(-0.5 * d * d) - 1.0;
}

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;
    let z = global_id.z;

    // Bounds check
    if (x >= params.width || y >= params.height || z >= params.depth) {
        return;
    }

    let coord = vec3<i32>(i32(x), i32(y), i32(z));
    let radius = i32(params.kernel_radius);
    let kernel_size = radius * 2 + 1;

    // Current state
    let current_state = textureLoad(state_in, vec3<u32>(coord), 0).r;

    // 3D Convolution: sum of (neighbor * kernel_weight)
    var weighted_sum: f32 = 0.0;
    var kernel_sum: f32 = 0.0;

    for (var kz: i32 = 0; kz < kernel_size; kz = kz + 1) {
        for (var ky: i32 = 0; ky < kernel_size; ky = ky + 1) {
            for (var kx: i32 = 0; kx < kernel_size; kx = kx + 1) {
                // Neighbor position with toroidal wrapping
                var nx = coord.x + kx - radius;
                var ny = coord.y + ky - radius;
                var nz = coord.z + kz - radius;

                // Toroidal wrap for X
                if (nx < 0) { nx = nx + i32(params.width); }
                if (nx >= i32(params.width)) { nx = nx - i32(params.width); }

                // Toroidal wrap for Y
                if (ny < 0) { ny = ny + i32(params.height); }
                if (ny >= i32(params.height)) { ny = ny - i32(params.height); }

                // Toroidal wrap for Z
                if (nz < 0) { nz = nz + i32(params.depth); }
                if (nz >= i32(params.depth)) { nz = nz - i32(params.depth); }

                // Get neighbor state
                let neighbor_state = textureLoad(state_in, vec3<u32>(u32(nx), u32(ny), u32(nz)), 0).r;

                // Get kernel weight
                let kernel_weight = textureLoad(kernel_texture, vec3<u32>(u32(kx), u32(ky), u32(kz)), 0).r;

                weighted_sum = weighted_sum + neighbor_state * kernel_weight;
                kernel_sum = kernel_sum + kernel_weight;
            }
        }
    }

    // Normalize convolution result (potential field)
    var potential: f32 = 0.0;
    if (kernel_sum > 0.0) {
        potential = weighted_sum / kernel_sum;
    }

    // Calculate growth using Gaussian growth function
    let growth = growth_gaussian(
        potential,
        params.growth_center,
        params.growth_width
    );

    // Apply growth with time integration
    var new_state = current_state + params.dt * growth;

    // Clamp to valid range [0, 1]
    new_state = clamp(new_state, 0.0, 1.0);

    // Write output
    textureStore(state_out, vec3<u32>(coord), vec4<f32>(new_state, 0.0, 0.0, 1.0));
}
