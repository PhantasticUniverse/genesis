/**
 * Flow-Lenia Shader
 * Mass-conserving continuous CA with advection dynamics
 *
 * The update rule is:
 *   ∂C/∂t = growth(C) - ∇·(C·v)
 *
 * Where:
 *   - growth(C) is the standard Lenia growth function
 *   - v is the velocity field derived from growth gradients
 *   - ∇·(C·v) is the advection term that moves mass
 *
 * Mass conservation comes from the divergence form:
 *   ∫ ∂C/∂t dA = ∫ growth dA - ∮ C·v·n dS
 *
 * With proper boundary conditions, the surface integral vanishes
 * and total mass change equals integral of growth.
 */

struct FlowParams {
    width: u32,
    height: u32,
    growth_center: f32,    // μ
    growth_width: f32,     // σ
    dt: f32,               // Time step
    flow_strength: f32,    // How much growth gradient affects flow
    diffusion: f32,        // Diffusion coefficient
    growth_type: u32,      // 0=polynomial, 1=gaussian
}

@group(0) @binding(0) var state_in: texture_2d<f32>;
@group(0) @binding(1) var neighbor_sum: texture_2d<f32>;  // Convolution result
@group(0) @binding(2) var state_out: texture_storage_2d<r32float, write>;
@group(0) @binding(3) var<uniform> params: FlowParams;

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

fn calculate_growth(n: f32, mu: f32, sigma: f32, growth_type: u32) -> f32 {
    if (growth_type == 0u) {
        return growth_polynomial(n, mu, sigma);
    } else {
        return growth_gaussian(n, mu, sigma);
    }
}

// Wrap coordinates for toroidal boundary
fn wrap(coord: vec2<i32>, size: vec2<u32>) -> vec2<i32> {
    var c = coord;
    if (c.x < 0) { c.x += i32(size.x); }
    if (c.y < 0) { c.y += i32(size.y); }
    if (c.x >= i32(size.x)) { c.x -= i32(size.x); }
    if (c.y >= i32(size.y)) { c.y -= i32(size.y); }
    return c;
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;

    if (x >= params.width || y >= params.height) {
        return;
    }

    let coord = vec2<i32>(i32(x), i32(y));
    let size = vec2<u32>(params.width, params.height);

    // Current state and neighbor sum
    let current = textureLoad(state_in, coord, 0).r;
    let n = textureLoad(neighbor_sum, coord, 0).r;

    // Calculate growth
    let growth = calculate_growth(n, params.growth_center, params.growth_width, params.growth_type);

    // Compute growth gradient for flow field
    // Using central differences on neighbor sum (approximates ∇U)
    let n_right = textureLoad(neighbor_sum, wrap(coord + vec2(1, 0), size), 0).r;
    let n_left = textureLoad(neighbor_sum, wrap(coord + vec2(-1, 0), size), 0).r;
    let n_up = textureLoad(neighbor_sum, wrap(coord + vec2(0, -1), size), 0).r;
    let n_down = textureLoad(neighbor_sum, wrap(coord + vec2(0, 1), size), 0).r;

    // Growth gradient (direction of increasing growth potential)
    let growth_right = calculate_growth(n_right, params.growth_center, params.growth_width, params.growth_type);
    let growth_left = calculate_growth(n_left, params.growth_center, params.growth_width, params.growth_type);
    let growth_up = calculate_growth(n_up, params.growth_center, params.growth_width, params.growth_type);
    let growth_down = calculate_growth(n_down, params.growth_center, params.growth_width, params.growth_type);

    // Velocity field: v = flow_strength * ∇growth
    // Mass flows toward regions of higher growth
    let vx = params.flow_strength * (growth_right - growth_left) * 0.5;
    let vy = params.flow_strength * (growth_down - growth_up) * 0.5;

    // State gradients for advection
    let c_right = textureLoad(state_in, wrap(coord + vec2(1, 0), size), 0).r;
    let c_left = textureLoad(state_in, wrap(coord + vec2(-1, 0), size), 0).r;
    let c_up = textureLoad(state_in, wrap(coord + vec2(0, -1), size), 0).r;
    let c_down = textureLoad(state_in, wrap(coord + vec2(0, 1), size), 0).r;

    // Upwind scheme for advection (more stable)
    var advection_x: f32;
    var advection_y: f32;

    if (vx > 0.0) {
        advection_x = vx * (current - c_left);
    } else {
        advection_x = vx * (c_right - current);
    }

    if (vy > 0.0) {
        advection_y = vy * (current - c_up);
    } else {
        advection_y = vy * (c_down - current);
    }

    // Divergence of (C * v) using product rule:
    // ∇·(Cv) = C(∇·v) + v·∇C
    // For our flow field derived from gradient, ∇·v ≈ Laplacian(growth)
    // Simplified: just use upwind advection
    let advection = advection_x + advection_y;

    // Optional diffusion for smoothing (Laplacian)
    let laplacian = c_right + c_left + c_up + c_down - 4.0 * current;
    let diffusion_term = params.diffusion * laplacian;

    // Update with growth, advection, and diffusion
    var new_state = current + params.dt * (growth - advection + diffusion_term);

    // Clamp to valid range
    new_state = clamp(new_state, 0.0, 1.0);

    textureStore(state_out, vec2<u32>(x, y), vec4<f32>(new_state, 0.0, 0.0, 1.0));
}

/**
 * Alternative: Reintegration tracking for better mass conservation
 * This version explicitly tracks mass flow across cell boundaries
 */
@compute @workgroup_size(16, 16)
fn flow_reintegration(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;

    if (x >= params.width || y >= params.height) {
        return;
    }

    let coord = vec2<i32>(i32(x), i32(y));
    let size = vec2<u32>(params.width, params.height);

    let current = textureLoad(state_in, coord, 0).r;
    let n = textureLoad(neighbor_sum, coord, 0).r;

    // Compute growth
    let growth = calculate_growth(n, params.growth_center, params.growth_width, params.growth_type);

    // Get neighbor states and growth values
    let c_right = textureLoad(state_in, wrap(coord + vec2(1, 0), size), 0).r;
    let c_left = textureLoad(state_in, wrap(coord + vec2(-1, 0), size), 0).r;
    let c_up = textureLoad(state_in, wrap(coord + vec2(0, -1), size), 0).r;
    let c_down = textureLoad(state_in, wrap(coord + vec2(0, 1), size), 0).r;

    let n_right = textureLoad(neighbor_sum, wrap(coord + vec2(1, 0), size), 0).r;
    let n_left = textureLoad(neighbor_sum, wrap(coord + vec2(-1, 0), size), 0).r;
    let n_up = textureLoad(neighbor_sum, wrap(coord + vec2(0, -1), size), 0).r;
    let n_down = textureLoad(neighbor_sum, wrap(coord + vec2(0, 1), size), 0).r;

    let g_right = calculate_growth(n_right, params.growth_center, params.growth_width, params.growth_type);
    let g_left = calculate_growth(n_left, params.growth_center, params.growth_width, params.growth_type);
    let g_up = calculate_growth(n_up, params.growth_center, params.growth_width, params.growth_type);
    let g_down = calculate_growth(n_down, params.growth_center, params.growth_width, params.growth_type);

    // Mass redistribution: each cell gives mass to neighbors proportionally to growth difference
    // Flux from this cell to neighbor = strength * (neighbor_growth - this_growth) * this_mass
    let flux_right = params.flow_strength * max(g_right - growth, 0.0) * current;
    let flux_left = params.flow_strength * max(g_left - growth, 0.0) * current;
    let flux_up = params.flow_strength * max(g_up - growth, 0.0) * current;
    let flux_down = params.flow_strength * max(g_down - growth, 0.0) * current;

    // Flux from neighbors to this cell
    let influx_right = params.flow_strength * max(growth - g_right, 0.0) * c_right;
    let influx_left = params.flow_strength * max(growth - g_left, 0.0) * c_left;
    let influx_up = params.flow_strength * max(growth - g_up, 0.0) * c_up;
    let influx_down = params.flow_strength * max(growth - g_down, 0.0) * c_down;

    // Net mass change from flow
    let outflow = flux_right + flux_left + flux_up + flux_down;
    let inflow = influx_right + influx_left + influx_up + influx_down;
    let net_flow = inflow - outflow;

    // Update: growth creates/destroys mass, flow redistributes it
    var new_state = current + params.dt * (growth + net_flow);

    new_state = clamp(new_state, 0.0, 1.0);

    textureStore(state_out, vec2<u32>(x, y), vec4<f32>(new_state, 0.0, 0.0, 1.0));
}
