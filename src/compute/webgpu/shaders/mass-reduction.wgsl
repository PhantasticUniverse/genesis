/**
 * Mass Reduction Shader
 * Computes total mass in the grid using parallel reduction
 *
 * Uses a two-pass approach:
 * 1. First pass: Each workgroup sums its region and writes to partial sums buffer
 * 2. Second pass: Sum all partial sums to get total mass
 */

struct ReductionParams {
    width: u32,
    height: u32,
    num_workgroups: u32,
    _padding: u32,
}

// First pass: Reduce grid to partial sums
@group(0) @binding(0) var state_texture: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> partial_sums: array<f32>;
@group(0) @binding(2) var<uniform> params: ReductionParams;

var<workgroup> shared_data: array<f32, 256>;

@compute @workgroup_size(16, 16)
fn reduce_first_pass(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>,
    @builtin(workgroup_id) workgroup_id: vec3<u32>
) {
    let x = global_id.x;
    let y = global_id.y;
    let local_idx = local_id.y * 16u + local_id.x;

    // Load value from texture (0 if out of bounds)
    var value: f32 = 0.0;
    if (x < params.width && y < params.height) {
        value = textureLoad(state_texture, vec2<i32>(i32(x), i32(y)), 0).r;
    }

    // Store in shared memory
    shared_data[local_idx] = value;
    workgroupBarrier();

    // Parallel reduction within workgroup
    for (var stride = 128u; stride > 0u; stride = stride >> 1u) {
        if (local_idx < stride) {
            shared_data[local_idx] += shared_data[local_idx + stride];
        }
        workgroupBarrier();
    }

    // First thread writes workgroup sum to partial sums
    if (local_idx == 0u) {
        let workgroup_idx = workgroup_id.y * ((params.width + 15u) / 16u) + workgroup_id.x;
        partial_sums[workgroup_idx] = shared_data[0];
    }
}

// Second pass: Sum partial sums to get total
// Handles grids with more than 256 workgroups by having each thread sum multiple values
@group(0) @binding(3) var<storage, read_write> total_mass: array<f32>;

@compute @workgroup_size(256)
fn reduce_second_pass(
    @builtin(global_invocation_id) global_id: vec3<u32>,
    @builtin(local_invocation_id) local_id: vec3<u32>
) {
    let idx = local_id.x;

    // Each thread sums multiple partial sums (strided access)
    // This handles grids with more than 256 workgroups
    var value: f32 = 0.0;
    var i = idx;
    while (i < params.num_workgroups) {
        value += partial_sums[i];
        i += 256u;
    }

    // Store in shared memory
    shared_data[idx] = value;
    workgroupBarrier();

    // Parallel reduction
    for (var stride = 128u; stride > 0u; stride = stride >> 1u) {
        if (idx < stride) {
            shared_data[idx] += shared_data[idx + stride];
        }
        workgroupBarrier();
    }

    // First thread writes total
    if (idx == 0u) {
        total_mass[0] = shared_data[0];
    }
}

/**
 * Mass Normalization Shader
 * Scales state to maintain target total mass
 */

struct NormalizeParams {
    width: u32,
    height: u32,
    target_mass: f32,
    current_mass: f32,
}

@group(0) @binding(0) var state_in: texture_2d<f32>;
@group(0) @binding(1) var state_out: texture_storage_2d<r32float, write>;
@group(0) @binding(2) var<uniform> normalize_params: NormalizeParams;

@compute @workgroup_size(16, 16)
fn normalize_mass(
    @builtin(global_invocation_id) global_id: vec3<u32>
) {
    let x = global_id.x;
    let y = global_id.y;

    if (x >= normalize_params.width || y >= normalize_params.height) {
        return;
    }

    let coord = vec2<i32>(i32(x), i32(y));
    let current = textureLoad(state_in, coord, 0).r;

    // Scale to maintain target mass
    var scale: f32 = 1.0;
    if (normalize_params.current_mass > 0.001) {
        scale = normalize_params.target_mass / normalize_params.current_mass;
    }

    // Apply scaling with soft clipping
    let scaled = current * scale;
    let new_value = clamp(scaled, 0.0, 1.0);

    textureStore(state_out, vec2<u32>(x, y), vec4<f32>(new_value, 0.0, 0.0, 1.0));
}
