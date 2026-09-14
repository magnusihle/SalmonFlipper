import * as THREE from 'three'

/** Classic 2D Perlin noise (Gustavson's cnoise) plus a small fbm stack. */
const PERLIN = /* glsl */ `
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec2 fade(vec2 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod(Pi, 289.0);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = 2.0 * fract(i * 0.0243902439) - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = 1.79284291400159 - 0.85373472095314 *
    vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
  return 2.3 * n_xy;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * cnoise(p);
    p = p * 2.03 + vec2(17.1, 9.7);
    a *= 0.5;
  }
  return v;
}
`

const VERT = /* glsl */ `
varying vec2 vUv;
varying float vHeight;
void main() {
  vUv = uv;
  vHeight = position.z;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAG = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform float uCoverage;
uniform vec3 uColor;
uniform sampler2D uNormalMap;
uniform sampler2D uAlphaMap;
varying vec2 vUv;
varying float vHeight;
${PERLIN}

void main() {
  vec2 p = vUv * uScale;
  // two drifting layers so the foam churns instead of sliding as one sheet
  float n1 = fbm(p + vec2(uTime * 0.045, uTime * 0.02));
  float n2 = fbm(p * 1.7 - vec2(uTime * 0.03, -uTime * 0.05) + 31.0);
  float n = n1 * 0.65 + n2 * 0.35;

  // ripple slope and crest height both whip up more foam
  vec3 nm = texture2D(uNormalMap, vUv).xyz * 2.0 - 1.0;
  float slope = clamp(length(nm.xy) * 2.5, 0.0, 1.0);
  float crest = clamp(vHeight * 60.0, 0.0, 1.0);
  float agitation = max(slope, crest * 0.7);

  float threshold = mix(0.45, 0.0, uCoverage) - agitation * 0.45;
  float foam = smoothstep(threshold, threshold + 0.22, n);
  // lacy edges: a finer noise eats holes in the sheet
  float lace = smoothstep(-0.25, 0.35, cnoise(p * 6.0 + uTime * 0.1));
  foam *= mix(0.55, 1.0, lace);

  float edge = texture2D(uAlphaMap, vUv).r;
  float alpha = foam * edge * (0.55 + agitation * 0.45);
  if (alpha < 0.005) discard;
  gl_FragColor = vec4(uColor, alpha);
}
`

export interface FoamOptions {
  /** noise cells across the pool */
  scale?: number
  /** 0 = only where the water is agitated, 1 = nearly everywhere */
  coverage?: number
  color?: THREE.ColorRepresentation
}

export function makeFoamMaterial(normalMap: THREE.Texture, alphaMap: THREE.Texture, opts: FoamOptions = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: opts.scale ?? 7 },
      uCoverage: { value: opts.coverage ?? 0.42 },
      uColor: { value: new THREE.Color(opts.color ?? '#f4fbfd') },
      uNormalMap: { value: normalMap },
      uAlphaMap: { value: alphaMap },
    },
    transparent: true,
    depthWrite: false,
  })
}
