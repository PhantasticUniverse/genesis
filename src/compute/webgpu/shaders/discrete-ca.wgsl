/**
 * Discrete Cellular Automata Compute Shader
 * Supports Game of Life and other Life-like automata (B/S notation)
 */

struct Params {
    width: u32,
    height: u32,
    // Birth rules encoded as bitmask (bit i = birth on i neighbors)
    birth_mask: u32,
    // Survival rules encoded as bitmask (bit i = survive on i neighbors)
    survival_mask: u32,
}

@group(0) @binding(0) var state_in: texture_2d<f32>;
@group(0) @binding(1) var state_out: texture_storage_2d<r32float, write>;
@group(0) @binding(2) var<uniform> params: Params;

// Moore neighborhood offsets (8 neighbors)
const MOORE_OFFSETS: array<vec2<i32>, 8> = array<vec2<i32>, 8>(
    vec2<i32>(-1, -1), vec2<i32>(0, -1), vec2<i32>(1, -1),
    vec2<i32>(-1,  0),                   vec2<i32>(1,  0),
    vec2<i32>(-1,  1), vec2<i32>(0,  1), vec2<i32>(1,  1)
);

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let coord = vec2<i32>(global_id.xy);
    let size = vec2<i32>(i32(params.width), i32(params.height));

    // Bounds check
    if (coord.x >= size.x || coord.y >= size.y) {
        return;
    }

    // Get current cell state
    let current = textureLoad(state_in, vec2<u32>(coord), 0).r;
    let is_alive = current > 0.5;

    // Count neighbors (Moore neighborhood with toroidal wrapping)
    var neighbor_count: u32 = 0u;

    for (var i = 0u; i < 8u; i++) {
        let offset = MOORE_OFFSETS[i];
        // Toroidal wrapping
        let neighbor_coord = (coord + offset + size) % size;
        let neighbor = textureLoad(state_in, vec2<u32>(neighbor_coord), 0).r;
        neighbor_count += u32(neighbor > 0.5);
    }

    // Apply Birth/Survival rules using bitmasks
    var new_state: f32 = 0.0;

    if (is_alive) {
        // Check survival rule
        if ((params.survival_mask & (1u << neighbor_count)) != 0u) {
            new_state = 1.0;
        }
    } else {
        // Check birth rule
        if ((params.birth_mask & (1u << neighbor_count)) != 0u) {
            new_state = 1.0;
        }
    }

    textureStore(state_out, vec2<u32>(coord), vec4<f32>(new_state, 0.0, 0.0, 1.0));
}
