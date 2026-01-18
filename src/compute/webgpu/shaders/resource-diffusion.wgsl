/**
 * Resource Diffusion Shader
 * Implements resource dynamics with:
 * - Logistic growth with carrying capacity
 * - Spatial diffusion via Laplacian
 * - Consumption by creatures
 * - Environmental gradients
 * - Lotka-Volterra inspired population dynamics
 */

struct ResourceParams {
    width: u32,
    height: u32,
    num_resources: u32,
    dt: f32,

    // Resource 0 (e.g., food/plants)
    r0_growth_rate: f32,           // Intrinsic growth rate
    r0_carrying_capacity: f32,     // Maximum sustainable density
    r0_diffusion_rate: f32,        // Spatial spread rate
    r0_base_production: f32,       // Background production

    // Resource 1 (e.g., secondary nutrient)
    r1_growth_rate: f32,
    r1_carrying_capacity: f32,
    r1_diffusion_rate: f32,
    r1_base_production: f32,

    // Consumption parameters
    consumption_rate: f32,         // How fast creatures consume resources
    conversion_efficiency: f32,    // Energy conversion (0-1)
    starvation_rate: f32,          // Death rate without food

    // Environmental gradient (0=none, 1=radial, 2=vertical, 3=horizontal)
    gradient_type: u32,
    gradient_center_x: f32,
    gradient_center_y: f32,
    gradient_strength: f32,
}

struct PopulationParams {
    // Prey parameters (channel 0)
    prey_birth_rate: f32,
    prey_death_rate: f32,
    prey_diffusion: f32,
    prey_carrying_capacity: f32,

    // Predator parameters (channel 1)
    predator_birth_rate: f32,
    predator_death_rate: f32,
    predator_diffusion: f32,
    predator_efficiency: f32,      // Conversion of prey to predator biomass

    // Interaction parameters
    predation_rate: f32,           // Predator hunting efficiency
    competition_rate: f32,         // Intra-species competition
    saturation_constant: f32,      // Holling Type II functional response

    _pad0: f32,
}

@group(0) @binding(0) var resource_in: texture_2d<f32>;
@group(0) @binding(1) var resource_out: texture_storage_2d<rgba32float, write>;
@group(0) @binding(2) var creature_state: texture_2d<f32>;
@group(0) @binding(3) var<uniform> params: ResourceParams;
@group(0) @binding(4) var<uniform> pop_params: PopulationParams;

// 9-point Laplacian stencil for smooth diffusion
fn compute_laplacian_9pt(coord: vec2<i32>, channel: u32) -> f32 {
    // Weights: center = -1, adjacent = 0.2, diagonal = 0.05
    let center = textureLoad(resource_in, vec2<u32>(coord), 0);
    var center_val: f32;
    switch (channel) {
        case 0u: { center_val = center.r; }
        case 1u: { center_val = center.g; }
        case 2u: { center_val = center.b; }
        default: { center_val = center.a; }
    }

    var sum: f32 = 0.0;
    let w = i32(params.width);
    let h = i32(params.height);

    // 8 neighbors with appropriate weights
    let offsets = array<vec2<i32>, 8>(
        vec2<i32>(-1, 0), vec2<i32>(1, 0),
        vec2<i32>(0, -1), vec2<i32>(0, 1),
        vec2<i32>(-1, -1), vec2<i32>(1, -1),
        vec2<i32>(-1, 1), vec2<i32>(1, 1)
    );
    let weights = array<f32, 8>(0.2, 0.2, 0.2, 0.2, 0.05, 0.05, 0.05, 0.05);

    for (var i = 0u; i < 8u; i++) {
        var nx = coord.x + offsets[i].x;
        var ny = coord.y + offsets[i].y;

        // Toroidal wrapping
        if (nx < 0) { nx += w; }
        if (ny < 0) { ny += h; }
        if (nx >= w) { nx -= w; }
        if (ny >= h) { ny -= h; }

        let neighbor = textureLoad(resource_in, vec2<u32>(u32(nx), u32(ny)), 0);
        var neighbor_val: f32;
        switch (channel) {
            case 0u: { neighbor_val = neighbor.r; }
            case 1u: { neighbor_val = neighbor.g; }
            case 2u: { neighbor_val = neighbor.b; }
            default: { neighbor_val = neighbor.a; }
        }

        sum += weights[i] * (neighbor_val - center_val);
    }

    return sum;
}

// Environmental gradient modifier
fn get_gradient_modifier(x: u32, y: u32) -> f32 {
    if (params.gradient_type == 0u) {
        return 1.0;
    }

    let fx = f32(x) / f32(params.width);
    let fy = f32(y) / f32(params.height);

    var modifier: f32 = 1.0;

    switch (params.gradient_type) {
        case 1u: {
            // Radial gradient (fertile center)
            let dx = fx - params.gradient_center_x;
            let dy = fy - params.gradient_center_y;
            let dist = sqrt(dx * dx + dy * dy);
            modifier = 1.0 - dist * params.gradient_strength;
        }
        case 2u: {
            // Vertical gradient (fertility increases with y)
            modifier = 1.0 - (1.0 - fy) * params.gradient_strength;
        }
        case 3u: {
            // Horizontal gradient (fertility increases with x)
            modifier = 1.0 - (1.0 - fx) * params.gradient_strength;
        }
        case 4u: {
            // Patchy environment (periodic)
            let px = sin(fx * 6.283185 * 3.0) * 0.5 + 0.5;
            let py = sin(fy * 6.283185 * 3.0) * 0.5 + 0.5;
            modifier = 0.5 + 0.5 * px * py * params.gradient_strength;
        }
        default: {}
    }

    return clamp(modifier, 0.1, 2.0);
}

// Logistic growth: dR/dt = r*R*(1 - R/K)
fn logistic_growth(resource: f32, growth_rate: f32, carrying_capacity: f32) -> f32 {
    if (carrying_capacity <= 0.0) {
        return 0.0;
    }
    return growth_rate * resource * (1.0 - resource / carrying_capacity);
}

// Holling Type II functional response: consumption = a*R / (1 + a*h*R)
fn functional_response(resource: f32, consumption_rate: f32, saturation: f32) -> f32 {
    let numerator = consumption_rate * resource;
    let denominator = 1.0 + consumption_rate * saturation * resource;
    return numerator / max(denominator, 0.001);
}

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;

    if (x >= params.width || y >= params.height) {
        return;
    }

    let coord = vec2<i32>(i32(x), i32(y));

    // Current resource state
    let resources = textureLoad(resource_in, vec2<u32>(coord), 0);
    let r0 = resources.r;  // Primary resource (food/plants)
    let r1 = resources.g;  // Secondary resource

    // Current creature state (prey in r, predator in g)
    let creatures = textureLoad(creature_state, vec2<u32>(coord), 0);
    let prey = creatures.r;
    let predator = creatures.g;

    // Environmental gradient modifier
    let gradient = get_gradient_modifier(x, y);

    // ========================================
    // Resource 0 dynamics (primary food source)
    // ========================================

    // Logistic growth with environmental modification
    let r0_growth = logistic_growth(
        r0,
        params.r0_growth_rate * gradient,
        params.r0_carrying_capacity * gradient
    );

    // Diffusion
    let r0_diffusion = compute_laplacian_9pt(coord, 0u) * params.r0_diffusion_rate;

    // Base production (e.g., constant nutrient input)
    let r0_production = params.r0_base_production * gradient;

    // Consumption by prey
    let r0_consumption = functional_response(r0, params.consumption_rate, pop_params.saturation_constant) * prey;

    // Net change for resource 0
    let dr0 = r0_growth + r0_diffusion + r0_production - r0_consumption;

    // ========================================
    // Resource 1 dynamics (secondary nutrient)
    // ========================================

    let r1_growth = logistic_growth(
        r1,
        params.r1_growth_rate * gradient,
        params.r1_carrying_capacity * gradient
    );

    let r1_diffusion = compute_laplacian_9pt(coord, 1u) * params.r1_diffusion_rate;
    let r1_production = params.r1_base_production * gradient;

    let dr1 = r1_growth + r1_diffusion + r1_production;

    // ========================================
    // Population dynamics (Lotka-Volterra + resource)
    // ========================================

    // Prey dynamics
    // dH/dt = r*H*(1 - H/K) + e*c*R*H - a*H*P / (1 + a*h*H) - d*H
    let prey_reproduction = pop_params.prey_birth_rate * prey * (1.0 - prey / max(pop_params.prey_carrying_capacity, 0.01));
    let prey_feeding = params.conversion_efficiency * r0_consumption;
    let predation = functional_response(prey, pop_params.predation_rate, pop_params.saturation_constant) * predator;
    let prey_starvation = select(0.0, params.starvation_rate * prey, r0 < 0.05);
    let prey_death = pop_params.prey_death_rate * prey;
    let prey_diffusion = compute_laplacian_9pt(coord, 0u) * pop_params.prey_diffusion;

    let d_prey = prey_reproduction + prey_feeding - predation - prey_starvation - prey_death + prey_diffusion;

    // Predator dynamics
    // dP/dt = e*a*H*P / (1 + a*h*H) - d*P - m*P*P
    let predator_feeding = pop_params.predator_efficiency * predation;
    let predator_starvation = select(0.0, pop_params.predator_death_rate * 2.0 * predator, prey < 0.05);
    let predator_death = pop_params.predator_death_rate * predator;
    let predator_competition = pop_params.competition_rate * predator * predator;
    let predator_diffusion = compute_laplacian_9pt(coord, 1u) * pop_params.predator_diffusion;

    let d_predator = predator_feeding - predator_starvation - predator_death - predator_competition + predator_diffusion;

    // ========================================
    // Update and clamp
    // ========================================

    var new_resources = vec4<f32>(
        r0 + params.dt * dr0,
        r1 + params.dt * dr1,
        prey + params.dt * d_prey,
        predator + params.dt * d_predator
    );

    // Clamp to valid ranges
    new_resources = max(new_resources, vec4<f32>(0.0));
    new_resources.r = min(new_resources.r, params.r0_carrying_capacity * 2.0);
    new_resources.g = min(new_resources.g, params.r1_carrying_capacity * 2.0);
    new_resources.b = min(new_resources.b, 1.0);  // Prey
    new_resources.a = min(new_resources.a, 1.0);  // Predator

    textureStore(resource_out, vec2<u32>(coord), new_resources);
}

// ============================================================================
// Separate pass: Resource-only dynamics (no population)
// ============================================================================

@compute @workgroup_size(16, 16, 1)
fn resource_only(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;

    if (x >= params.width || y >= params.height) {
        return;
    }

    let coord = vec2<i32>(i32(x), i32(y));
    let resources = textureLoad(resource_in, vec2<u32>(coord), 0);

    let gradient = get_gradient_modifier(x, y);

    // Resource 0
    let r0 = resources.r;
    let dr0 = logistic_growth(r0, params.r0_growth_rate * gradient, params.r0_carrying_capacity * gradient)
            + compute_laplacian_9pt(coord, 0u) * params.r0_diffusion_rate
            + params.r0_base_production * gradient;

    // Resource 1
    let r1 = resources.g;
    let dr1 = logistic_growth(r1, params.r1_growth_rate * gradient, params.r1_carrying_capacity * gradient)
            + compute_laplacian_9pt(coord, 1u) * params.r1_diffusion_rate
            + params.r1_base_production * gradient;

    var new_resources = vec4<f32>(
        clamp(r0 + params.dt * dr0, 0.0, params.r0_carrying_capacity * 2.0),
        clamp(r1 + params.dt * dr1, 0.0, params.r1_carrying_capacity * 2.0),
        resources.b,
        resources.a
    );

    textureStore(resource_out, vec2<u32>(coord), new_resources);
}
