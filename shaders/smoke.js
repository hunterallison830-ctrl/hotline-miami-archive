// Hatch: pink/cyan/purple neon smoke background. One fullscreen quad, 4-octave noise.
import * as THREE from 'three';

const vert = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`;

const frag = /* glsl */`
precision mediump float;
uniform float uTime;
uniform vec2 uRes;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p = p * 2.03 + 1.7; a *= 0.5; }
  return s;
}

void main() {
  vec2 uv = vUv;
  uv.x *= uRes.x / uRes.y;
  float t = uTime * 0.04;

  // domain-warped smoke
  vec2 q = vec2(fbm(uv * 1.6 + t), fbm(uv * 1.6 - t + 4.2));
  float n = fbm(uv * 2.2 + q * 1.8 + vec2(t * 2.0, -t));

  vec3 pink   = vec3(1.0, 0.184, 0.627);   // #ff2fa0
  vec3 cyan   = vec3(0.0, 0.941, 1.0);     // #00f0ff
  vec3 purple = vec3(0.478, 0.173, 1.0);   // #7a2cff

  vec3 col = mix(purple, pink, smoothstep(0.3, 0.7, q.x));
  col = mix(col, cyan, smoothstep(0.55, 0.85, q.y) * 0.6);
  col *= smoothstep(0.25, 0.85, n) * 0.55;

  // vignette keeps cards readable
  float vig = smoothstep(1.2, 0.3, length(vUv - 0.5) * 1.6);
  col *= vig;
  col += (hash(vUv * uRes + uTime) - 0.5) * 0.015; // film grain, kills banding
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSmokeBackground(renderer, scene) {
  const size = renderer.getSize(new THREE.Vector2());
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uRes: { value: size } },
    vertexShader: vert,
    fragmentShader: frag,
    depthWrite: false,
    depthTest: false,
  });
  const geo = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  scene.add(mesh);

  return {
    update(t) {
      mat.uniforms.uTime.value = t;
      renderer.getSize(mat.uniforms.uRes.value);
    },
    dispose() {
      scene.remove(mesh);
      geo.dispose();
      mat.dispose();
    },
  };
}
