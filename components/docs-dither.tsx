"use client";

import { useEffect, useRef } from "react";
import { useAppTheme } from "@/hooks/use-app-theme";
import { cn } from "@/lib/utils";

/*
 * A dithered band that pours down from the top of a docs page and ends in a
 * slow, wavy edge with one deep drip, like paint running down a wall.
 *
 * The colour inside is the god-shaders silk field (an iterated fold with
 * Lorentzian glow, after OpenShaders), rolled from the seed "evil-docs-wpawuo"
 * by the kit's constrained sampler and passed by its critic (52% coverage,
 * 3% blown). The canvas renders one pixel per 4px cell and is scaled up with
 * `image-rendering: pixelated`, so every cell is a crisp square, and each cell
 * is 1-bit Bayer-dithered. Unlit cells are transparent, so the band
 * always sits on the page's own background.
 */

export const CELL = 4;

const SEED_PARAMS = {
  HUE: 0.0185411201,
  HUE_SPREAD: -0.461210867,
  HUE_TRAVEL: 1.7406013,
  CHROMA: 0.113430876,
  LIGHTNESS: 0.579636829,
  COLOUR_CYCLE: 0.225940828,
  THETA: 2.13223689,
  SHEAR: 0.97069797,
  SHRINK: 0.951905733,
  LAYERS: 70,
  WARP_FREQ_X: 0.392441326,
  WARP_FREQ_Y: 2.1747607,
  WARP_AMP_X: 0.101316376,
  WARP_AMP_Y: 0.0269762957,
  ASPECT_X: 1.85953624,
  ASPECT_Y: 0.13128386,
  OFFSET_X: 0.411082882,
  OFFSET_Y: 0.0465288171,
  TILT: -2.01360213,
  ZOOM: 1.13632178,
  CENTRE_X: 0.271244393,
  CENTRE_Y: -0.483572503,
  GLOW_SIZE: 0.00197522985,
  FALLOFF: 0.364788277,
  FLOW_SPEED: 0.619851803,
  FLOW_DIRECTION: 1,
  BREATH_RATE: 0.440122166,
  BREATH_AMOUNT: 0.0550335315,
  PHASE: 5.29338825,
  SOFTNESS: 0.00139758228,
  LIGHT_SWING: 0.173019158,
};

const glslFloat = (value: number) => (Number.isInteger(value) ? value.toFixed(1) : String(value));

const VERTEX_SHADER = `#version 300 es
void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uDark;
out vec4 outColor;

${Object.entries(SEED_PARAMS)
  .map(([name, value]) => `const float ${name} = ${glslFloat(value)};`)
  .join("\n")}
const float TAU = 6.28318530718;
const float CELL = ${glslFloat(CELL)};
// How many field units the band spans across, and where the frame sits.
const float SPAN = 2.1;
const vec2 FRAME = vec2(0.0, -0.18);

vec3 oklchToLinear(float L, float C, float h) {
  float a = C * cos(h);
  float b = C * sin(h);
  vec3 lms = vec3(L + 0.3963377774 * a + 0.2158037573 * b,
                  L - 0.1055613458 * a - 0.0638541728 * b,
                  L - 0.0894841775 * a - 1.2914855480 * b);
  lms = lms * lms * lms;
  return mat3(4.0767416621, -1.2684380046, -0.0041960863,
              -3.3077115913, 2.6097574011, -0.7034186147,
              0.2309699292, -0.3413193965, 1.7076147010) * lms;
}

// The seeded silk field, HDR-accumulated and ACES-tonemapped.
vec3 silk(vec2 pos) {
  float t = uTime * FLOW_SPEED * FLOW_DIRECTION + PHASE;
  float breath = (-sin(uTime * BREATH_RATE * 1.5) + sin(uTime * BREATH_RATE + 1.0)) * 0.25 + 0.5;
  vec2 u = (pos - vec2(CENTRE_X, CENTRE_Y)) * (ZOOM - breath * BREATH_AMOUNT);
  float ct = cos(TILT), st = sin(TILT);
  u = mat2(ct, st, -st, ct) * u;
  mat2 fold = mat2(cos(THETA), sin(THETA), -SHEAR, cos(THETA));
  float hue0 = HUE * TAU, hue1 = hue0 + HUE_SPREAD * TAU;
  vec3 color = vec3(0.0);
  for (float i = 1.0; i <= LAYERS; i += 1.0) {
    u.x += -sin(u.y * WARP_FREQ_X + t + i * 0.007) * WARP_AMP_X;
    u.y += -sin(u.x * WARP_FREQ_Y - t + i * 0.02) * WARP_AMP_Y;
    u = fold * u * SHRINK;
    vec2 q = u - vec2(OFFSET_X + breath * 0.1, OFFSET_Y);
    vec2 s = vec2(q.x * ASPECT_X, q.y * ASPECT_Y);
    float glow = GLOW_SIZE / (dot(s, s) + SOFTNESS) * (0.25 + breath * 0.4);
    float r = length(u);
    float k = sin(i * COLOUR_CYCLE + t * 1.2 + r * HUE_TRAVEL) * 0.5 + 0.5;
    vec3 tint = clamp(oklchToLinear(LIGHTNESS + LIGHT_SWING * k, CHROMA * (0.75 + 0.35 * k), mix(hue0, hue1, k)), 0.0, 1.0);
    color += glow * tint * exp2(-r * FALLOFF);
  }
  vec3 x = max(color, 0.0);
  color = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  return pow(clamp(color, 0.0, 1.0), vec3(0.85, 0.92, 0.98));
}

// 8x8 Bayer threshold, built by interleaving and reversing the bits of x^y and x.
float bayer(vec2 cell) {
  ivec2 p = ivec2(mod(cell, 8.0));
  int xy = p.x ^ p.y;
  int v = ((xy & 1) << 5) | ((p.x & 1) << 4) | ((xy & 2) << 2)
        | ((p.x & 2) << 1) | ((xy & 4) >> 1) | ((p.x & 4) >> 2);
  return (float(v) + 0.5) / 64.0;
}

// Depth of the wavy edge below the top, as a fraction of the band height.
// x is in CSS pixels so the waves keep their size on any width.
float edge(float x, float width, float t) {
  float u = x / 140.0;
  float depth = 0.44
    + 0.10 * sin(u * 1.3 + t * 0.35)
    + 0.06 * sin(u * 2.9 - t * 0.5 + 1.7)
    + 0.035 * sin(u * 6.1 + t * 0.8 + 4.0);
  float centre = width * (0.38 + 0.14 * sin(t * 0.13));
  float d = (x - centre) / (width * 0.04 + 26.0);
  depth += 0.4 * exp(-d * d);
  return clamp(depth, 0.16, 0.94);
}

void main() {
  vec2 cell = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) - 0.5;
  vec2 css = (cell + 0.5) * CELL;
  vec2 size = uResolution * CELL;

  float e = edge(css.x, size.x, uTime) * size.y;
  if (css.y > e) { outColor = vec4(0.0); return; }

  vec2 pos = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.x * SPAN + FRAME;
  vec3 color = silk(pos);
  float peak = max(color.r, max(color.g, color.b));

  // Dense at the top, thinning out as it runs down to the edge.
  float depth = css.y / e;
  float fade = 1.0 - depth;
  float level = min(pow(peak, 1.2) * mix(0.55, 0.95, fade) + 0.45 * fade * fade, 0.94);
  bool rim = e - css.y < CELL;
  if (!rim && level <= bayer(cell)) { outColor = vec4(0.0); return; }

  // 1-bit: every lit cell is a pure palette colour, the brightness lives in
  // how many cells are lit. Dim parts of the field fall back to brand red.
  vec3 tint = color / max(peak, 0.05);
  // On white, darken and saturate so the bright core doesn't wash out.
  float luma = dot(tint, vec3(0.2126, 0.7152, 0.0722));
  tint = mix(clamp(luma * 0.55 + (tint - luma) * 1.4, 0.0, 1.0), tint, uDark);
  vec3 brand = clamp(oklchToLinear(mix(0.6, 0.66, uDark), 0.23, mix(29.0, 32.0, uDark) / 360.0 * TAU), 0.0, 1.0);
  tint = mix(brand, tint, smoothstep(0.08, 0.35, peak));
  outColor = vec4(tint, 1.0);
}
`;

export function DocsDither({ className }: { className?: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useAppTheme();
  const darkRef = useRef(theme === "dark" ? 1 : 0);
  const redrawRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    darkRef.current = theme === "dark" ? 1 : 0;
    redrawRef.current();
  }, [theme]);

  useEffect(() => {
    const frameElement = frameRef.current;
    const canvas = canvasRef.current;
    if (!frameElement || !canvas) return;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
        throw new Error(`Docs dither shader failed: ${gl.getShaderInfoLog(shader)}`);
      }
      return shader;
    };

    let program: WebGLProgram;
    try {
      program = gl.createProgram();
      const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
      const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
    } catch (error) {
      console.warn(error);
      return;
    }

    const vao = gl.createVertexArray();
    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const uResolution = uniform("uResolution");
    const uTime = uniform("uTime");
    const uDark = uniform("uDark");

    const stillness = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = frameElement.clientWidth;
    let height = frameElement.clientHeight;
    let visible = true;
    let frame = 0;
    let elapsed = 0;
    let previous: number | null = null;
    let lost = false;

    const canDraw = () => !lost && !document.hidden && visible && width > 0 && height > 0;

    function draw() {
      if (!canDraw()) return;
      // One canvas pixel per cell, drawn at exactly CELL css px so every cell is the same size.
      const w = Math.ceil(width / CELL);
      const h = Math.ceil(height / CELL);
      if (canvas!.width !== w || canvas!.height !== h) {
        canvas!.width = w;
        canvas!.height = h;
        canvas!.style.width = `${w * CELL}px`;
        canvas!.style.height = `${h * CELL}px`;
      }
      gl!.viewport(0, 0, w, h);
      gl!.useProgram(program);
      gl!.bindVertexArray(vao);
      gl!.uniform2f(uResolution, w, h);
      gl!.uniform1f(uTime, elapsed);
      gl!.uniform1f(uDark, darkRef.current);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);
    }

    function tick(now: number) {
      frame = 0;
      if (!canDraw()) { previous = null; return; }
      elapsed += previous === null ? 0 : Math.min((now - previous) / 1000, 0.1);
      previous = now;
      draw();
      if (!stillness.matches) frame = requestAnimationFrame(tick);
      else previous = null;
    }

    function refresh() {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = null;
      if (canDraw()) frame = requestAnimationFrame(tick);
    }

    redrawRef.current = () => { if (!frame) draw(); };

    const resize = new ResizeObserver(([entry]) => {
      if (!entry) return;
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      refresh();
    });
    const intersection = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      visible = entry.isIntersecting;
      refresh();
    });
    const contextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      refresh();
    };

    resize.observe(frameElement);
    intersection.observe(frameElement);
    stillness.addEventListener("change", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("resize", refresh);
    canvas.addEventListener("webglcontextlost", contextLost);
    refresh();

    return () => {
      cancelAnimationFrame(frame);
      redrawRef.current = () => undefined;
      resize.disconnect();
      intersection.disconnect();
      stillness.removeEventListener("change", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("resize", refresh);
      canvas.removeEventListener("webglcontextlost", contextLost);
      gl.deleteProgram(program);
      gl.deleteVertexArray(vao);
    };
  }, []);

  return (
    <div ref={frameRef} aria-hidden="true" className={cn("overflow-hidden", className)}>
      <canvas ref={canvasRef} className="block [image-rendering:pixelated]" />
    </div>
  );
}
