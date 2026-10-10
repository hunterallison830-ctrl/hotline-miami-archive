// Hatch: velocity-driven RGB-split / glitch card material.
// Uniforms: uTex, uVelocity (0..~1), uTime, uOpacity.
import * as THREE from 'three';

const vert = /* glsl */`
uniform float uVelocity;
uniform float uTime;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  // slight bend along scroll speed so cards feel like they drag
  p.z += sin(uv.y * 3.14159) * uVelocity * 0.12;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const frag = /* glsl */`
precision highp float;
uniform sampler2D uTex;
uniform float uVelocity;
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  float v = clamp(uVelocity, 0.0, 1.5);
  vec2 uv = vUv;

  // horizontal slice tearing, only when moving
  float band = floor(uv.y * 24.0);
  float t = floor(uTime * 18.0);
  float r = hash(vec2(band, t));
  float tear = step(1.0 - v * 0.35, r) * (r - 0.5) * 0.08 * v;
  uv.x += tear;

  // RGB split grows with velocity
  float s = 0.004 + v * 0.025;
  vec2 dir = vec2(1.0, 0.25);
  float cr = texture2D(uTex, uv + dir * s).r;
  vec4  cg = texture2D(uTex, uv);
  float cb = texture2D(uTex, uv - dir * s).b;
  vec3 col = vec3(cr, cg.g, cb);

  // scanlines + neon tint on fast motion
  col *= 0.94 + 0.06 * sin(vUv.y * 800.0 + uTime * 10.0);
  col += vec3(1.0, 0.18, 0.63) * v * 0.08 * step(0.5, hash(vec2(band, t + 1.0)));

  // soft rounded-ish edge fade
  vec2 e = smoothstep(0.0, 0.015, vUv) * smoothstep(0.0, 0.015, 1.0 - vUv);
  gl_FragColor = vec4(col, cg.a * uOpacity * e.x * e.y);
}`;

export function createGlitchMaterial(texture) {
  if (texture) texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.ShaderMaterial({
    uniforms: {
      uTex: { value: texture },
      uVelocity: { value: 0 },
      uTime: { value: 0 },
      uOpacity: { value: 1 },
    },
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    side: THREE.DoubleSide,
  });
}
