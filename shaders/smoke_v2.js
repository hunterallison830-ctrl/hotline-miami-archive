// Hatch: smoke v2. Same look as smoke.js, but the fbm renders into a quarter-res
// target (1/4 width x 1/4 height = 1/16 the pixels) and is upscaled with linear
// filtering. Grain is added at full res so the upscale doesn't look blurry/banded.
import * as THREE from 'three';

const SCALE = 0.25;

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
  col *= smoothstep(0.25, 0.85, n) * 0.64;
  col += vec3(0.035, 0.012, 0.06); // lifted floor so the void isn't pure black

  // vignette keeps cards readable
  float vig = mix(0.18, 1.0, smoothstep(1.3, 0.3, length(vUv - 0.5) * 1.6));
  col *= vig;
  gl_FragColor = vec4(col, 1.0);
}`;

const blitFrag = /* glsl */`
precision mediump float;
uniform sampler2D uSmoke;
uniform float uTime;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 col = texture2D(uSmoke, vUv).rgb;
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.015; // full-res grain hides upscale
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSmokeBackground(renderer, scene) {
  const full = renderer.getDrawingBufferSize(new THREE.Vector2());
  const lowSize = () => [Math.max(1, Math.floor(full.x * SCALE)), Math.max(1, Math.floor(full.y * SCALE))];
  let [w, h] = lowSize();

  const rt = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: false, generateMipmaps: false,
  });

  const geo = new THREE.PlaneGeometry(2, 2);
  const smokeMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uRes: { value: new THREE.Vector2(w, h) } },
    vertexShader: vert, fragmentShader: frag,
    depthWrite: false, depthTest: false,
  });
  const smokeScene = new THREE.Scene();
  const smokeMesh = new THREE.Mesh(geo, smokeMat);
  smokeMesh.frustumCulled = false;
  smokeScene.add(smokeMesh);
  const cam = new THREE.Camera();

  const blitMat = new THREE.ShaderMaterial({
    uniforms: { uSmoke: { value: rt.texture }, uTime: { value: 0 } },
    vertexShader: vert, fragmentShader: blitFrag,
    depthWrite: false, depthTest: false,
  });
  const blit = new THREE.Mesh(geo, blitMat);
  blit.frustumCulled = false;
  blit.renderOrder = -1000;
  scene.add(blit);

  return {
    update(t) {
      renderer.getDrawingBufferSize(full);
      const [nw, nh] = lowSize();
      if (nw !== w || nh !== h) { w = nw; h = nh; rt.setSize(w, h); smokeMat.uniforms.uRes.value.set(w, h); }
      smokeMat.uniforms.uTime.value = t;
      blitMat.uniforms.uTime.value = t;
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.render(smokeScene, cam);
      renderer.setRenderTarget(prev);
    },
    dispose() {
      scene.remove(blit);
      geo.dispose(); smokeMat.dispose(); blitMat.dispose(); rt.dispose();
    },
  };
}
