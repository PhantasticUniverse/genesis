/**
 * Multi-Channel Render Shader
 * Displays multiple channels with configurable colors
 */

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

struct ChannelColors {
    channel0: vec4<f32>,  // RGB + intensity for channel 0
    channel1: vec4<f32>,  // RGB + intensity for channel 1
    channel2: vec4<f32>,  // RGB + intensity for channel 2
    channel3: vec4<f32>,  // RGB + intensity for channel 3
}

// Full-screen triangle vertices
@vertex
fn vs_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    var out: VertexOutput;

    let x = f32((vertex_index << 1u) & 2u);
    let y = f32(vertex_index & 2u);

    out.position = vec4<f32>(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
    out.uv = vec2<f32>(x, y);

    return out;
}

@group(0) @binding(0) var state_texture: texture_2d<f32>;
@group(0) @binding(1) var<uniform> texture_size: vec2<u32>;
@group(0) @binding(2) var<uniform> colors: ChannelColors;

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let texel = vec2<u32>(in.uv * vec2<f32>(texture_size));
    let state = textureLoad(state_texture, texel, 0);

    // Mix colors based on channel values
    var color = vec3<f32>(0.0);

    color = color + state.r * colors.channel0.rgb * colors.channel0.a;
    color = color + state.g * colors.channel1.rgb * colors.channel1.a;
    color = color + state.b * colors.channel2.rgb * colors.channel2.a;
    color = color + state.a * colors.channel3.rgb * colors.channel3.a;

    // Clamp and return
    return vec4<f32>(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

// Alternative: Show individual channel
@fragment
fn fs_channel0(in: VertexOutput) -> @location(0) vec4<f32> {
    let texel = vec2<u32>(in.uv * vec2<f32>(texture_size));
    let v = textureLoad(state_texture, texel, 0).r;
    return vec4<f32>(v * 0.2, v, v * 0.3, 1.0);
}

@fragment
fn fs_channel1(in: VertexOutput) -> @location(0) vec4<f32> {
    let texel = vec2<u32>(in.uv * vec2<f32>(texture_size));
    let v = textureLoad(state_texture, texel, 0).g;
    return vec4<f32>(v, v * 0.4, v * 0.1, 1.0);
}
