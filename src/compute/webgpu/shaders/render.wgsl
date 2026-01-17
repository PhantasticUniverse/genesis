/**
 * Render Shader
 * Converts CA state texture to displayable RGBA with multiple colormaps
 */

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

struct RenderUniforms {
    texture_size: vec2<u32>,
    colormap_id: u32,
    show_obstacles: u32,  // 1 = show obstacles overlay, 0 = hide
}

// Full-screen triangle vertices
@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var out: VertexOutput;

    // Generate full-screen triangle
    let x = f32((vertex_index << 1u) & 2u);
    let y = f32(vertex_index & 2u);

    out.position = vec4<f32>(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
    out.uv = vec2<f32>(x, y);

    return out;
}

@group(0) @binding(0) var state_texture: texture_2d<f32>;
@group(0) @binding(1) var<uniform> uniforms: RenderUniforms;
@group(0) @binding(2) var obstacle_texture: texture_2d<f32>;  // RGBA: G channel = obstacles

// Helper: linear interpolation between colors
fn lerp_color(a: vec3<f32>, b: vec3<f32>, t: f32) -> vec3<f32> {
    return a + (b - a) * t;
}

// Colormap 0: Grayscale
fn colormap_grayscale(v: f32) -> vec3<f32> {
    return vec3<f32>(v, v, v);
}

// Colormap 1: Classic green (Matrix style)
fn colormap_classic(v: f32) -> vec3<f32> {
    return vec3<f32>(v * 0.4, v, v * 0.4);
}

// Colormap 2: Viridis
fn colormap_viridis(v: f32) -> vec3<f32> {
    let c0 = vec3<f32>(0.267, 0.004, 0.329);
    let c1 = vec3<f32>(0.282, 0.141, 0.458);
    let c2 = vec3<f32>(0.243, 0.290, 0.537);
    let c3 = vec3<f32>(0.192, 0.407, 0.557);
    let c4 = vec3<f32>(0.149, 0.510, 0.557);
    let c5 = vec3<f32>(0.122, 0.619, 0.537);
    let c6 = vec3<f32>(0.208, 0.718, 0.475);
    let c7 = vec3<f32>(0.427, 0.804, 0.349);
    let c8 = vec3<f32>(0.706, 0.871, 0.173);
    let c9 = vec3<f32>(0.993, 0.906, 0.145);

    if (v < 0.111) { return lerp_color(c0, c1, v / 0.111); }
    if (v < 0.222) { return lerp_color(c1, c2, (v - 0.111) / 0.111); }
    if (v < 0.333) { return lerp_color(c2, c3, (v - 0.222) / 0.111); }
    if (v < 0.444) { return lerp_color(c3, c4, (v - 0.333) / 0.111); }
    if (v < 0.556) { return lerp_color(c4, c5, (v - 0.444) / 0.111); }
    if (v < 0.667) { return lerp_color(c5, c6, (v - 0.556) / 0.111); }
    if (v < 0.778) { return lerp_color(c6, c7, (v - 0.667) / 0.111); }
    if (v < 0.889) { return lerp_color(c7, c8, (v - 0.778) / 0.111); }
    return lerp_color(c8, c9, (v - 0.889) / 0.111);
}

// Colormap 3: Plasma
fn colormap_plasma(v: f32) -> vec3<f32> {
    let c0 = vec3<f32>(0.051, 0.031, 0.529);
    let c1 = vec3<f32>(0.294, 0.012, 0.631);
    let c2 = vec3<f32>(0.490, 0.012, 0.659);
    let c3 = vec3<f32>(0.659, 0.133, 0.588);
    let c4 = vec3<f32>(0.796, 0.275, 0.475);
    let c5 = vec3<f32>(0.898, 0.420, 0.365);
    let c6 = vec3<f32>(0.973, 0.580, 0.255);
    let c7 = vec3<f32>(0.992, 0.765, 0.157);
    let c8 = vec3<f32>(0.941, 0.976, 0.129);

    let t = v * 8.0;
    let i = u32(floor(t));
    let f = fract(t);

    switch (i) {
        case 0u: { return lerp_color(c0, c1, f); }
        case 1u: { return lerp_color(c1, c2, f); }
        case 2u: { return lerp_color(c2, c3, f); }
        case 3u: { return lerp_color(c3, c4, f); }
        case 4u: { return lerp_color(c4, c5, f); }
        case 5u: { return lerp_color(c5, c6, f); }
        case 6u: { return lerp_color(c6, c7, f); }
        case 7u: { return lerp_color(c7, c8, f); }
        default: { return c8; }
    }
}

// Colormap 4: Inferno
fn colormap_inferno(v: f32) -> vec3<f32> {
    let c0 = vec3<f32>(0.0, 0.0, 0.016);
    let c1 = vec3<f32>(0.157, 0.043, 0.329);
    let c2 = vec3<f32>(0.396, 0.082, 0.431);
    let c3 = vec3<f32>(0.624, 0.165, 0.388);
    let c4 = vec3<f32>(0.831, 0.282, 0.259);
    let c5 = vec3<f32>(0.961, 0.490, 0.082);
    let c6 = vec3<f32>(0.980, 0.757, 0.153);
    let c7 = vec3<f32>(0.988, 1.0, 0.643);

    let t = v * 7.0;
    let i = u32(floor(t));
    let f = fract(t);

    switch (i) {
        case 0u: { return lerp_color(c0, c1, f); }
        case 1u: { return lerp_color(c1, c2, f); }
        case 2u: { return lerp_color(c2, c3, f); }
        case 3u: { return lerp_color(c3, c4, f); }
        case 4u: { return lerp_color(c4, c5, f); }
        case 5u: { return lerp_color(c5, c6, f); }
        case 6u: { return lerp_color(c6, c7, f); }
        default: { return c7; }
    }
}

// Colormap 5: Fire
fn colormap_fire(v: f32) -> vec3<f32> {
    let c0 = vec3<f32>(0.0, 0.0, 0.0);
    let c1 = vec3<f32>(0.376, 0.0, 0.0);
    let c2 = vec3<f32>(0.627, 0.125, 0.0);
    let c3 = vec3<f32>(0.878, 0.376, 0.0);
    let c4 = vec3<f32>(1.0, 0.627, 0.125);
    let c5 = vec3<f32>(1.0, 0.878, 0.502);
    let c6 = vec3<f32>(1.0, 1.0, 0.878);

    let t = v * 6.0;
    let i = u32(floor(t));
    let f = fract(t);

    switch (i) {
        case 0u: { return lerp_color(c0, c1, f); }
        case 1u: { return lerp_color(c1, c2, f); }
        case 2u: { return lerp_color(c2, c3, f); }
        case 3u: { return lerp_color(c3, c4, f); }
        case 4u: { return lerp_color(c4, c5, f); }
        case 5u: { return lerp_color(c5, c6, f); }
        default: { return c6; }
    }
}

// Colormap 6: Ocean
fn colormap_ocean(v: f32) -> vec3<f32> {
    let c0 = vec3<f32>(0.0, 0.027, 0.114);
    let c1 = vec3<f32>(0.0, 0.110, 0.278);
    let c2 = vec3<f32>(0.0, 0.231, 0.439);
    let c3 = vec3<f32>(0.0, 0.404, 0.596);
    let c4 = vec3<f32>(0.106, 0.584, 0.714);
    let c5 = vec3<f32>(0.420, 0.765, 0.824);
    let c6 = vec3<f32>(0.733, 0.914, 0.945);

    let t = v * 6.0;
    let i = u32(floor(t));
    let f = fract(t);

    switch (i) {
        case 0u: { return lerp_color(c0, c1, f); }
        case 1u: { return lerp_color(c1, c2, f); }
        case 2u: { return lerp_color(c2, c3, f); }
        case 3u: { return lerp_color(c3, c4, f); }
        case 4u: { return lerp_color(c4, c5, f); }
        case 5u: { return lerp_color(c5, c6, f); }
        default: { return c6; }
    }
}

// Colormap 7: Rainbow
fn colormap_rainbow(v: f32) -> vec3<f32> {
    let c0 = vec3<f32>(0.588, 0.0, 0.353);
    let c1 = vec3<f32>(0.0, 0.0, 0.784);
    let c2 = vec3<f32>(0.0, 0.588, 1.0);
    let c3 = vec3<f32>(0.0, 1.0, 0.588);
    let c4 = vec3<f32>(0.588, 1.0, 0.0);
    let c5 = vec3<f32>(1.0, 0.784, 0.0);
    let c6 = vec3<f32>(1.0, 0.0, 0.0);

    let t = v * 6.0;
    let i = u32(floor(t));
    let f = fract(t);

    switch (i) {
        case 0u: { return lerp_color(c0, c1, f); }
        case 1u: { return lerp_color(c1, c2, f); }
        case 2u: { return lerp_color(c2, c3, f); }
        case 3u: { return lerp_color(c3, c4, f); }
        case 4u: { return lerp_color(c4, c5, f); }
        case 5u: { return lerp_color(c5, c6, f); }
        default: { return c6; }
    }
}

// Colormap 8: Neon
fn colormap_neon(v: f32) -> vec3<f32> {
    let c0 = vec3<f32>(0.0, 0.0, 0.0);
    let c1 = vec3<f32>(0.078, 0.0, 0.157);
    let c2 = vec3<f32>(0.235, 0.0, 0.392);
    let c3 = vec3<f32>(0.471, 0.0, 0.706);
    let c4 = vec3<f32>(0.706, 0.0, 1.0);
    let c5 = vec3<f32>(1.0, 0.314, 1.0);
    let c6 = vec3<f32>(1.0, 0.706, 1.0);

    let t = v * 6.0;
    let i = u32(floor(t));
    let f = fract(t);

    switch (i) {
        case 0u: { return lerp_color(c0, c1, f); }
        case 1u: { return lerp_color(c1, c2, f); }
        case 2u: { return lerp_color(c2, c3, f); }
        case 3u: { return lerp_color(c3, c4, f); }
        case 4u: { return lerp_color(c4, c5, f); }
        case 5u: { return lerp_color(c5, c6, f); }
        default: { return c6; }
    }
}

// Colormap 9: Turbo (improved rainbow)
fn colormap_turbo(v: f32) -> vec3<f32> {
    // Approximate turbo colormap using polynomial
    let r = clamp(0.13572138 + v * (4.61539260 + v * (-42.66032258 + v * (132.13108234 + v * (-152.94239396 + v * 59.28637943)))), 0.0, 1.0);
    let g = clamp(0.09140261 + v * (2.19418839 + v * (4.84296658 + v * (-14.18503333 + v * (4.27729857 + v * 2.82956604)))), 0.0, 1.0);
    let b = clamp(0.10667330 + v * (12.64194608 + v * (-60.58204836 + v * (110.36276771 + v * (-89.90310912 + v * 27.34824973)))), 0.0, 1.0);
    return vec3<f32>(r, g, b);
}

// Colormap 10: Earth (natural tones)
fn colormap_earth(v: f32) -> vec3<f32> {
    let c0 = vec3<f32>(0.086, 0.149, 0.098);
    let c1 = vec3<f32>(0.263, 0.353, 0.196);
    let c2 = vec3<f32>(0.525, 0.608, 0.353);
    let c3 = vec3<f32>(0.761, 0.718, 0.561);
    let c4 = vec3<f32>(0.902, 0.824, 0.667);
    let c5 = vec3<f32>(1.0, 0.961, 0.863);

    let t = v * 5.0;
    let i = u32(floor(t));
    let f = fract(t);

    switch (i) {
        case 0u: { return lerp_color(c0, c1, f); }
        case 1u: { return lerp_color(c1, c2, f); }
        case 2u: { return lerp_color(c2, c3, f); }
        case 3u: { return lerp_color(c3, c4, f); }
        case 4u: { return lerp_color(c4, c5, f); }
        default: { return c5; }
    }
}

// Colormap 11: Magma
fn colormap_magma(v: f32) -> vec3<f32> {
    let c0 = vec3<f32>(0.0, 0.0, 0.016);
    let c1 = vec3<f32>(0.110, 0.063, 0.267);
    let c2 = vec3<f32>(0.310, 0.071, 0.482);
    let c3 = vec3<f32>(0.506, 0.145, 0.506);
    let c4 = vec3<f32>(0.710, 0.212, 0.478);
    let c5 = vec3<f32>(0.898, 0.314, 0.392);
    let c6 = vec3<f32>(0.984, 0.529, 0.380);
    let c7 = vec3<f32>(0.996, 0.761, 0.529);
    let c8 = vec3<f32>(0.988, 0.992, 0.749);

    let t = v * 8.0;
    let i = u32(floor(t));
    let f = fract(t);

    switch (i) {
        case 0u: { return lerp_color(c0, c1, f); }
        case 1u: { return lerp_color(c1, c2, f); }
        case 2u: { return lerp_color(c2, c3, f); }
        case 3u: { return lerp_color(c3, c4, f); }
        case 4u: { return lerp_color(c4, c5, f); }
        case 5u: { return lerp_color(c5, c6, f); }
        case 6u: { return lerp_color(c6, c7, f); }
        case 7u: { return lerp_color(c7, c8, f); }
        default: { return c8; }
    }
}

// Apply colormap based on ID
fn apply_colormap(value: f32, colormap_id: u32) -> vec3<f32> {
    let v = clamp(value, 0.0, 1.0);

    switch (colormap_id) {
        case 0u: { return colormap_grayscale(v); }
        case 1u: { return colormap_classic(v); }
        case 2u: { return colormap_viridis(v); }
        case 3u: { return colormap_plasma(v); }
        case 4u: { return colormap_inferno(v); }
        case 5u: { return colormap_fire(v); }
        case 6u: { return colormap_ocean(v); }
        case 7u: { return colormap_rainbow(v); }
        case 8u: { return colormap_neon(v); }
        case 9u: { return colormap_turbo(v); }
        case 10u: { return colormap_earth(v); }
        case 11u: { return colormap_magma(v); }
        default: { return colormap_viridis(v); }
    }
}

// Obstacle overlay color (orange-red)
const OBSTACLE_COLOR: vec3<f32> = vec3<f32>(1.0, 0.3, 0.1);

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // Convert UV to texel coordinates and use textureLoad (for unfilterable r32float)
    let texel = vec2<u32>(in.uv * vec2<f32>(uniforms.texture_size));
    let value = textureLoad(state_texture, texel, 0).r;

    var color = apply_colormap(value, uniforms.colormap_id);

    // Blend obstacle overlay if enabled
    if (uniforms.show_obstacles == 1u) {
        let obstacle_data = textureLoad(obstacle_texture, texel, 0);
        let obstacle_value = obstacle_data.g;  // Obstacles stored in G channel

        if (obstacle_value > 0.01) {
            // Blend obstacle color with existing color
            // Use additive blend for visibility on dark backgrounds
            let obstacle_alpha = min(obstacle_value * 0.8, 0.9);
            color = lerp_color(color, OBSTACLE_COLOR, obstacle_alpha);
        }
    }

    return vec4<f32>(color, 1.0);
}
