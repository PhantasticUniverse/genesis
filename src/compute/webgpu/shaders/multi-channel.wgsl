/**
 * Multi-Channel CA Shader (Enhanced Ecology)
 * Handles multiple interacting species/fields with:
 * - Decay and diffusion
 * - Chemical signaling (pheromones)
 * - Energy/metabolism
 * - Predator-prey dynamics
 * Uses RGBA texture for up to 4 channels
 */

struct Params {
    width: u32,
    height: u32,
    num_channels: u32,
    num_interactions: u32,
    dt: f32,
    // Per-channel decay rates (packed)
    decay_r: f32,
    decay_g: f32,
    decay_b: f32,
    decay_a: f32,
    // Per-channel diffusion rates
    diffuse_r: f32,
    diffuse_g: f32,
    diffuse_b: f32,
    diffuse_a: f32,
    // Pheromone emission (which channel emits to which)
    pheromone_source: u32,
    pheromone_target: u32,
    pheromone_rate: f32,
    _pad: f32,
}

// Interaction definition (packed for GPU)
struct Interaction {
    source_channel: u32,
    target_channel: u32,
    kernel_radius: f32,
    growth_center: f32,
    growth_width: f32,
    weight: f32,
    interaction_type: u32,  // 0=lenia, 1=predation, 2=symbiosis
    _pad: f32,
}

@group(0) @binding(0) var state_in: texture_2d<f32>;
@group(0) @binding(1) var state_out: texture_storage_2d<rgba32float, write>;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var<storage, read> interactions: array<Interaction>;

// Polynomial growth function (Lenia standard)
fn growth_polynomial(n: f32, mu: f32, sigma: f32) -> f32 {
    let x = (n - mu) / (3.0 * sigma);
    if (abs(x) >= 1.0) {
        return -1.0;
    }
    let t = 1.0 - x * x;
    return 2.0 * t * t * t * t - 1.0;
}

// Gaussian growth function (smoother response)
fn growth_gaussian(n: f32, mu: f32, sigma: f32) -> f32 {
    let d = (n - mu) / sigma;
    return 2.0 * exp(-0.5 * d * d) - 1.0;
}

// Gaussian kernel weight (smooth bump)
fn kernel_weight(dx: f32, dy: f32, radius: f32) -> f32 {
    let r = sqrt(dx * dx + dy * dy) / radius;
    if (r > 1.0) {
        return 0.0;
    }
    // Polynomial bump kernel
    let t = 1.0 - r * r;
    return t * t * t * t;
}

// Exponential kernel (sharper, for predation)
fn kernel_exponential(dx: f32, dy: f32, radius: f32) -> f32 {
    let r = sqrt(dx * dx + dy * dy) / radius;
    if (r > 1.0) {
        return 0.0;
    }
    return exp(-3.0 * r * r);
}

// Ring kernel (for pheromone detection)
fn kernel_ring(dx: f32, dy: f32, radius: f32, inner_ratio: f32) -> f32 {
    let r = sqrt(dx * dx + dy * dy) / radius;
    if (r > 1.0 || r < inner_ratio) {
        return 0.0;
    }
    // Smooth ring
    let outer = 1.0 - r;
    let inner = (r - inner_ratio) / (1.0 - inner_ratio);
    return outer * inner * 4.0;
}

// Get channel value from RGBA
fn get_channel(pixel: vec4<f32>, channel: u32) -> f32 {
    switch (channel) {
        case 0u: { return pixel.r; }
        case 1u: { return pixel.g; }
        case 2u: { return pixel.b; }
        case 3u: { return pixel.a; }
        default: { return 0.0; }
    }
}

// Set channel value in vec4
fn set_channel(pixel: vec4<f32>, channel: u32, value: f32) -> vec4<f32> {
    var result = pixel;
    switch (channel) {
        case 0u: { result.r = value; }
        case 1u: { result.g = value; }
        case 2u: { result.b = value; }
        case 3u: { result.a = value; }
        default: {}
    }
    return result;
}

// Get decay rate for channel
fn get_decay(channel: u32) -> f32 {
    switch (channel) {
        case 0u: { return params.decay_r; }
        case 1u: { return params.decay_g; }
        case 2u: { return params.decay_b; }
        case 3u: { return params.decay_a; }
        default: { return 0.0; }
    }
}

// Get diffusion rate for channel
fn get_diffusion(channel: u32) -> f32 {
    switch (channel) {
        case 0u: { return params.diffuse_r; }
        case 1u: { return params.diffuse_g; }
        case 2u: { return params.diffuse_b; }
        case 3u: { return params.diffuse_a; }
        default: { return 0.0; }
    }
}

// Compute Laplacian for diffusion (3x3 kernel)
fn compute_laplacian(coord: vec2<i32>, channel: u32) -> f32 {
    var sum = 0.0;
    let center = get_channel(textureLoad(state_in, vec2<u32>(coord), 0), channel);

    for (var dy: i32 = -1; dy <= 1; dy++) {
        for (var dx: i32 = -1; dx <= 1; dx++) {
            if (dx == 0 && dy == 0) { continue; }

            var nx = coord.x + dx;
            var ny = coord.y + dy;

            // Toroidal wrap
            if (nx < 0) { nx = nx + i32(params.width); }
            if (ny < 0) { ny = ny + i32(params.height); }
            if (nx >= i32(params.width)) { nx = nx - i32(params.width); }
            if (ny >= i32(params.height)) { ny = ny - i32(params.height); }

            let neighbor = get_channel(textureLoad(state_in, vec2<u32>(u32(nx), u32(ny)), 0), channel);
            sum += neighbor - center;
        }
    }

    return sum / 8.0;  // Average of 8 neighbors
}

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let x = global_id.x;
    let y = global_id.y;

    if (x >= params.width || y >= params.height) {
        return;
    }

    let coord = vec2<i32>(i32(x), i32(y));

    // Current state (all channels)
    let current = textureLoad(state_in, vec2<u32>(coord), 0);

    // Growth accumulator for each channel
    var growth = vec4<f32>(0.0, 0.0, 0.0, 0.0);

    // Process each interaction
    for (var i: u32 = 0u; i < params.num_interactions; i = i + 1u) {
        let interaction = interactions[i];
        let radius = i32(interaction.kernel_radius);

        // Convolution for this interaction
        var weighted_sum: f32 = 0.0;
        var weight_total: f32 = 0.0;

        for (var ky: i32 = -radius; ky <= radius; ky = ky + 1) {
            for (var kx: i32 = -radius; kx <= radius; kx = kx + 1) {
                // Neighbor position with toroidal wrapping
                var nx = coord.x + kx;
                var ny = coord.y + ky;

                if (nx < 0) { nx = nx + i32(params.width); }
                if (ny < 0) { ny = ny + i32(params.height); }
                if (nx >= i32(params.width)) { nx = nx - i32(params.width); }
                if (ny >= i32(params.height)) { ny = ny - i32(params.height); }

                // Choose kernel based on interaction type
                var w: f32;
                switch (interaction.interaction_type) {
                    case 1u: {
                        // Predation: use exponential (sharper)
                        w = kernel_exponential(f32(kx), f32(ky), interaction.kernel_radius);
                    }
                    case 2u: {
                        // Symbiosis: use ring (medium distance)
                        w = kernel_ring(f32(kx), f32(ky), interaction.kernel_radius, 0.3);
                    }
                    default: {
                        // Lenia: use polynomial bump
                        w = kernel_weight(f32(kx), f32(ky), interaction.kernel_radius);
                    }
                }

                // Get source channel value
                let neighbor = textureLoad(state_in, vec2<u32>(u32(nx), u32(ny)), 0);
                let source_val = get_channel(neighbor, interaction.source_channel);

                weighted_sum = weighted_sum + source_val * w;
                weight_total = weight_total + w;
            }
        }

        // Normalize and calculate growth
        var n: f32 = 0.0;
        if (weight_total > 0.0) {
            n = weighted_sum / weight_total;
        }

        var g: f32;
        switch (interaction.interaction_type) {
            case 1u: {
                // Predation: asymmetric growth - predator gains when prey present
                g = growth_polynomial(n, interaction.growth_center, interaction.growth_width);
                // Enhance predator growth when prey density is higher
                g = g * (1.0 + n * 0.5);
            }
            case 2u: {
                // Symbiosis: mutual benefit at moderate densities
                g = growth_gaussian(n, interaction.growth_center, interaction.growth_width);
            }
            default: {
                // Lenia: standard polynomial growth
                g = growth_polynomial(n, interaction.growth_center, interaction.growth_width);
            }
        }

        // Add to target channel's growth
        let contribution = g * interaction.weight;
        switch (interaction.target_channel) {
            case 0u: { growth.r = growth.r + contribution; }
            case 1u: { growth.g = growth.g + contribution; }
            case 2u: { growth.b = growth.b + contribution; }
            case 3u: { growth.a = growth.a + contribution; }
            default: {}
        }
    }

    // Apply decay for each channel
    let decay = vec4<f32>(
        get_decay(0u),
        get_decay(1u),
        get_decay(2u),
        get_decay(3u)
    );
    growth = growth - current * decay;

    // Apply diffusion for each channel
    let diffusion = vec4<f32>(
        compute_laplacian(coord, 0u) * get_diffusion(0u),
        compute_laplacian(coord, 1u) * get_diffusion(1u),
        compute_laplacian(coord, 2u) * get_diffusion(2u),
        compute_laplacian(coord, 3u) * get_diffusion(3u)
    );
    growth = growth + diffusion;

    // Pheromone emission: creatures emit signals
    if (params.pheromone_rate > 0.0) {
        let source_val = get_channel(current, params.pheromone_source);
        if (source_val > 0.1) {
            let emission = source_val * params.pheromone_rate;
            switch (params.pheromone_target) {
                case 0u: { growth.r = growth.r + emission; }
                case 1u: { growth.g = growth.g + emission; }
                case 2u: { growth.b = growth.b + emission; }
                case 3u: { growth.a = growth.a + emission; }
                default: {}
            }
        }
    }

    // Apply growth with time integration
    var new_state = current + params.dt * growth;

    // Clamp all channels
    new_state = clamp(new_state, vec4<f32>(0.0), vec4<f32>(1.0));

    // Write output
    textureStore(state_out, vec2<u32>(coord), new_state);
}
