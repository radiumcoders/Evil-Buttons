/*
 * @evilbuttons · OpenShaders
 * https://openshaders.com/@evilbuttons
 * Dither field, recoloured to the brand red (oklch hue ~29°) and ported from
 * WebGPU to WebGL2 so it runs in browsers without WebGPU (Linux Chrome, Firefox).
 */

"use client";

import { type CSSProperties, useEffect, useRef } from "react";

const VERTEX_SHADER = `#version 300 es
void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}
`;

const UNIFORMS = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform float uLightMode;
uniform vec3 uDarkBackground;
uniform float uPixelRatio;
uniform vec3 uLightBackground;
out vec4 outColor;
`;

const FIELD_SHADER = `${UNIFORMS}
const float HUE = 0.06;
const float HUE_SPREAD = 0.07;
const float HUE_TRAVEL = 2.43289733;
const float CHROMA = 0.17;
const float LIGHTNESS = 0.542461395;
const float COLOUR_CYCLE = 0.223255605;
const float THETA = 2.13308811;
const float SHEAR = 0.960379541;
const float SHRINK = 0.947900593;
const float LAYERS = 79.0;
const float WARP_FREQ_X = 0.421021253;
const float WARP_FREQ_Y = 2.2612536;
const float WARP_AMP_X = 0.147639409;
const float WARP_AMP_Y = 0.0258083399;
const float ASPECT_X = 1.95389938;
const float ASPECT_Y = 0.17984499;
const float OFFSET_X = 0.32859391;
const float OFFSET_Y = -0.0158194955;
const float TILT = -3.13121653;
const float ZOOM = 0.917030811;
const float CENTRE_X = -0.653302789;
const float CENTRE_Y = 0.165816918;
const float GLOW_SIZE = 0.00124598783;
const float FALLOFF = 0.325866044;
const float VIGNETTE = 0.0486959331;
const float FLOW_SPEED = 0.446218342;
const float FLOW_DIRECTION = -1.0;
const float BREATH_RATE = 0.455271423;
const float BREATH_AMOUNT = 0.104695484;
const float PHASE = 46.253952;
const float ECHO = 0.0;
const float ECHO_SHIFT = 0.154131204;
const float SOFTNESS = 0.00130189431;
const float LIGHT_SWING = 0.152112246;
const float TAU = 6.28318530718;

vec3 oklchToLinear(float L, float C, float h) {
  float a = C * cos(h);
  float b = C * sin(h);
  float l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  float m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  float s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  vec3 lms = vec3(l_, m_, s_);
  lms = lms * lms * lms;
  return mat3(4.0767416621, -1.2684380046, -0.0041960863,
              -3.3077115913, 2.6097574011, -0.7034186147,
              0.2309699292, -0.3413193965, 1.7076147010) * lms;
}

float fmod(float x, float y) { return x - y * floor(x / y); }

float blueNoise(vec2 p, float frame) {
  vec2 q = p + 5.588238 * fmod(frame, 64.0);
  return fract(52.9829189 * fract(0.06711056 * q.x + 0.00583715 * q.y));
}

void main() {
  vec2 R = uResolution;
  vec2 frag = gl_FragCoord.xy;
  vec2 pos = (frag - 0.5 * R) / R.y;
  float t = uTime * FLOW_SPEED * FLOW_DIRECTION + PHASE;
  float breath = (-sin(uTime * BREATH_RATE * 1.5) + sin(uTime * BREATH_RATE + 1.0)) * 0.25 + 0.5;

  vec2 p = (pos - vec2(CENTRE_X, CENTRE_Y)) * (ZOOM - breath * BREATH_AMOUNT);
  float ct = cos(TILT);
  float st = sin(TILT);
  p = mat2(ct, st, -st, ct) * p;

  mat2 fold = mat2(cos(THETA), sin(THETA), -SHEAR, cos(THETA));

  float hue0 = HUE * TAU;
  float hue1 = hue0 + HUE_SPREAD * TAU;
  vec3 color = vec3(0.0);

  for (float i = 1.0; i <= 96.0; i += 1.0) {
    if (i > LAYERS) break;
    p.x += -sin(p.y * WARP_FREQ_X + t + i * 0.007) * WARP_AMP_X;
    p.y += -sin(p.x * WARP_FREQ_Y - t + i * 0.02) * WARP_AMP_Y;
    p = fold * p * SHRINK;

    vec2 q = p - vec2(OFFSET_X + breath * 0.1, OFFSET_Y);
    vec2 s = vec2(q.x * ASPECT_X, q.y * ASPECT_Y);
    float glow = GLOW_SIZE / (dot(s, s) + SOFTNESS);
    if (ECHO > 0.0) {
      vec2 e = vec2((q.x - ECHO_SHIFT) * ASPECT_X, s.y);
      glow += ECHO * GLOW_SIZE / (dot(e, e) + SOFTNESS);
    }
    glow *= 0.25 + breath * 0.4;

    float r = length(p);
    float k = sin(i * COLOUR_CYCLE + t * 1.2 + r * HUE_TRAVEL) * 0.5 + 0.5;
    vec3 tint = clamp(oklchToLinear(LIGHTNESS + LIGHT_SWING * k, CHROMA * (0.75 + 0.35 * k), mix(hue0, hue1, k)), vec3(0.0), vec3(1.0));
    color += glow * tint * exp2(-r * FALLOFF);
  }

  vec3 x = max(color, vec3(0.0));
  color = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  color = pow(clamp(color, vec3(0.0), vec3(1.0)), vec3(0.85, 0.92, 0.98));

  float edge = smoothstep(0.5, 1.6, length(pos));
  color *= 1.0 - edge * VIGNETTE;

  vec3 dark = uDarkBackground + color * (1.0 - uDarkBackground);
  float strength = max(color.r, max(color.g, color.b));
  vec3 light = uLightBackground * (1.0 - strength) + color * 0.96;
  color = mix(dark, light, vec3(uLightMode));

  color += (blueNoise(frag, floor(uTime * 24.0)) - 0.5) / 255.0;
  outColor = vec4(clamp(color, vec3(0.0), vec3(1.0)), 1.0);
}
`;

const RARITY_SHADER = `${UNIFORMS}
uniform sampler2D tScene;

const float STRENGTH = 1.12953091;
const float SCALE = 1.1694684;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec3 toInk(vec3 c) { return mix(c - uDarkBackground, uLightBackground - c, vec3(uLightMode)); }
vec3 fromInk(vec3 ink) { return mix(uDarkBackground + ink, uLightBackground - ink, vec3(uLightMode)); }
vec3 sceneInk(vec2 uv) {
  return toInk(texture(tScene, clamp(uv, vec2(0.0), vec2(1.0))).rgb);
}

vec2 fmod2(vec2 x, float y) { return x - y * floor(x / y); }

const mat4 BAYER = mat4(
  0.94118, 0.29412, 0.76471, 0.05882,
  0.47059, 0.70588, 0.23529, 0.52941,
  0.82353, 0.11765, 0.88235, 0.17647,
  0.35294, 0.58824, 0.41176, 0.64706
);

vec3 dither(vec2 frag) {
  float cell = max(2.0, floor(SCALE * 2.2 * uPixelRatio + 0.5));
  vec2 grid = floor(frag / cell);
  vec3 soft = sceneInk(frag / uResolution);
  vec3 ink = sceneInk((grid + 0.5) * cell / uResolution);
  float level = dot(ink, LUMA);
  float levels = 8.0;
  ivec2 b = ivec2(fmod2(grid, 4.0));
  float v = pow(max(level, 0.0), 0.8) * levels + BAYER[b.x][b.y];
  float quantised = pow(floor(v) / levels, 1.25);
  vec3 dithered = ink * (quantised / max(level, 1e-4));
  float presence = smoothstep(0.03, 0.14, level) * (0.38 + 0.2 * STRENGTH);
  return mix(soft, dithered, vec3(presence));
}

void main() {
  vec3 ink = dither(gl_FragCoord.xy);
  vec3 color = fromInk(clamp(ink, vec3(0.0), vec3(1.0)));
  outColor = vec4(clamp(color, vec3(0.0), vec3(1.0)), 1.0);
}
`;

export type ShaderTheme = "dark" | "light";

export type ShaderOptions = {
  theme?: ShaderTheme;
  background?: { dark?: string; light?: string };
  autoplay?: boolean;
  signal?: AbortSignal;
  onError?: (error: Error) => void;
};

export type ShaderHandle = {
  setTheme(theme: ShaderTheme): void;

  render(time: number): void;
  destroy(): void;
};

export type EvilShaderProps = {
  theme?: ShaderTheme;
  background?: { dark?: string; light?: string };
  time?: number;
  onError?: (error: Error) => void;
  className?: string;
  style?: CSSProperties;
};

export function EvilShader({ theme = "dark", background, time, onError, className, style }: EvilShaderProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const shader = useRef<ShaderHandle | null>(null);
  const latestTheme = useRef(theme);
  const latestTime = useRef(time);
  const latestOnError = useRef(onError);
  const dark = background?.dark ?? "#0a0a0a";
  const light = background?.light ?? "#ffffff";
  const animated = time === undefined;

  useEffect(() => {
    latestTheme.current = theme;
    shader.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    latestTime.current = time;
    if (time !== undefined) shader.current?.render(time);
  }, [time]);

  useEffect(() => {
    latestOnError.current = onError;
  }, [onError]);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    let handle: ShaderHandle | null = null;
    const controller = new AbortController();
    const options: ShaderOptions = {
      theme: latestTheme.current,
      background: { dark, light },
      autoplay: animated,
      signal: controller.signal,
      onError: (error) => {
        if (controller.signal.aborted) return;
        if (latestOnError.current) latestOnError.current(error);
        else console.error(error);
      },
    };

    createShader(element, options).then((created) => {
      if (controller.signal.aborted) { created.destroy(); return; }
      handle = created;
      shader.current = created;
      if (latestTheme.current !== options.theme) created.setTheme(latestTheme.current);
      if (latestTime.current !== undefined) created.render(latestTime.current);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) options.onError?.(error instanceof Error ? error : new Error(String(error)));
    });
    return () => {
      controller.abort();
      handle?.destroy();
      shader.current = null;
    };
  }, [dark, light, animated]);

  return <canvas ref={canvas} className={className} style={{ display: "block", width: "100%", height: "100%", ...style }} aria-hidden="true" />;
}

const MAX_PIXELS = 2400000;
const THEME_EASE = 7;

function parseHex(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) throw new Error(`Background colours must be #rrggbb, got "${hex}".`);
  return [0, 2, 4].map((i) => parseInt(match[1].slice(i, i + 2), 16) / 255) as [number, number, number];
}

function animate(options: ShaderOptions, draw: (time: number, theme: number, pixelRatio: number) => void, canvas: HTMLCanvasElement, release: () => void, maxDimension = Infinity): ShaderHandle {
  const autoplay = options.autoplay !== false;
  const stillness = window.matchMedia("(prefers-reduced-motion: reduce)");
  let resolution = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
  let deviceRatio = window.devicePixelRatio || 1;
  let width = canvas.clientWidth, height = canvas.clientHeight;
  let visible = true;
  let disposed = false;
  let targetTheme = options.theme === "light" ? 1 : 0;
  let theme = targetTheme;
  let frame = 0;
  let elapsed = 0;
  let lastTime = 0;
  let previous: number | null = null;

  function canDraw() {
    return !disposed && !document.hidden && visible && width > 0 && height > 0;
  }

  function fitCanvas() {
    const scale = Math.min(deviceRatio, 2, Math.sqrt(MAX_PIXELS / (width * height)), maxDimension / width, maxDimension / height);
    const w = Math.max(1, Math.floor(width * scale)), h = Math.max(1, Math.floor(height * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return w / width;
  }

  function render(time: number) {
    if (disposed) return;
    lastTime = time;
    if (!canDraw()) return;
    try {
      draw(time, theme, fitCanvas());
    } catch (error) {
      destroy();
      const failure = error instanceof Error ? error : new Error(String(error));
      if (options.onError) options.onError(failure);
      else console.error(failure);
    }
  }

  function schedule() {
    if (!frame && canDraw()) frame = requestAnimationFrame(tick);
  }

  function refresh() {
    if (!canDraw()) {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = null;
    } else schedule();
  }

  function tick(now: number) {
    frame = 0;
    if (!canDraw()) { previous = null; return; }
    const delta = previous === null ? 0 : Math.min((now - previous) / 1000, 0.1);
    previous = now;
    if (autoplay) {
      if (!stillness.matches) elapsed += delta;
      theme += (targetTheme - theme) * (1 - Math.exp(-delta * THEME_EASE));
      if (Math.abs(targetTheme - theme) < 0.002) theme = targetTheme;
    }
    render(autoplay ? elapsed : lastTime);
    if (autoplay && (!stillness.matches || theme !== targetTheme)) schedule();
    else previous = null;
  }

  function pixelRatioChanged() {
    if (disposed) return;
    const next = window.devicePixelRatio || 1;
    if (deviceRatio === next) return;
    deviceRatio = next;
    resolution.removeEventListener("change", pixelRatioChanged);
    resolution = window.matchMedia(`(resolution: ${next}dppx)`);
    resolution.addEventListener("change", pixelRatioChanged);
    refresh();
  }

  const observer = new ResizeObserver(([entry]) => {
    if (disposed || !entry) return;
    const next = entry.contentRect;
    if (width === next.width && height === next.height) return;
    width = next.width;
    height = next.height;
    refresh();
  });
  const intersection = new IntersectionObserver(([entry]) => {
    if (disposed || !entry || visible === entry.isIntersecting) return;
    visible = entry.isIntersecting;
    refresh();
  });

  function destroy() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    frame = 0;
    observer.disconnect();
    intersection.disconnect();
    resolution.removeEventListener("change", pixelRatioChanged);
    stillness.removeEventListener("change", refresh);
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("resize", pixelRatioChanged);
    options.signal?.removeEventListener("abort", destroy);
    release();
  }

  observer.observe(canvas);
  intersection.observe(canvas);
  resolution.addEventListener("change", pixelRatioChanged);
  stillness.addEventListener("change", refresh);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("resize", pixelRatioChanged);
  options.signal?.addEventListener("abort", destroy, { once: true });
  if (options.signal?.aborted) destroy();
  else schedule();

  return {
    setTheme(next: ShaderTheme) {
      if (disposed) return;
      targetTheme = next === "light" ? 1 : 0;
      if (autoplay) refresh();
      else { theme = targetTheme; render(lastTime); }
    },
    render,
    destroy,
  };
}

const UNIFORM_NAMES = ["uResolution", "uTime", "uLightMode", "uDarkBackground", "uPixelRatio", "uLightBackground"] as const;
type UniformName = (typeof UNIFORM_NAMES)[number];

function compileProgram(gl: WebGL2RenderingContext, fragmentSource: string) {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("A WebGL shader could not be created.");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile failed: ${log}`);
    }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Shader link failed: ${log}`);
  }
  const uniforms = Object.fromEntries(UNIFORM_NAMES.map((name) => [name, gl.getUniformLocation(program, name)])) as Record<UniformName, WebGLUniformLocation | null>;
  return { program, uniforms };
}

export async function createShader(canvas: HTMLCanvasElement, options: ShaderOptions = {}): Promise<ShaderHandle> {
  const dark = parseHex(options.background?.dark ?? "#0a0a0a");
  const light = parseHex(options.background?.light ?? "#ffffff");
  options.signal?.throwIfAborted();
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: "low-power" });
  if (!gl) throw new Error("WebGL2 is not available in this browser.");
  let released = false;
  let handle: ShaderHandle | null = null;
  let field: ReturnType<typeof compileProgram> | null = null;
  let post: ReturnType<typeof compileProgram> | null = null;
  let vao: WebGLVertexArrayObject | null = null;
  let scene: WebGLTexture | null = null;
  let framebuffer: WebGLFramebuffer | null = null;

  function release() {
    if (released) return;
    released = true;
    options.signal?.removeEventListener("abort", abort);
    canvas.removeEventListener("webglcontextlost", contextLost);
    if (!gl) return;
    if (field) gl.deleteProgram(field.program);
    if (post) gl.deleteProgram(post.program);
    gl.deleteVertexArray(vao);
    gl.deleteTexture(scene);
    gl.deleteFramebuffer(framebuffer);
  }

  function abort() {
    if (handle) handle.destroy();
    else release();
  }

  function contextLost(event: Event) {
    event.preventDefault();
    if (released) return;
    const error = new Error("WebGL context lost.");
    if (handle) handle.destroy();
    else release();
    if (options.onError) options.onError(error);
    else console.error(error);
  }

  options.signal?.addEventListener("abort", abort, { once: true });
  canvas.addEventListener("webglcontextlost", contextLost);

  try {
    field = compileProgram(gl, FIELD_SHADER);
    post = compileProgram(gl, RARITY_SHADER);
    vao = gl.createVertexArray();
    scene = gl.createTexture();
    framebuffer = gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D, scene);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.useProgram(post.program);
    gl.uniform1i(gl.getUniformLocation(post.program, "tScene"), 0);
    options.signal?.throwIfAborted();

    const programs = { field, post };
    let sceneWidth = 0;
    let sceneHeight = 0;

    function sizeScene(width: number, height: number) {
      if (!gl || (sceneWidth === width && sceneHeight === height)) return;
      sceneWidth = width;
      sceneHeight = height;
      gl.bindTexture(gl.TEXTURE_2D, scene);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, scene, 0);
    }

    handle = animate(options, (time, theme, pixelRatio) => {
      if (gl.isContextLost()) return;
      const { width, height } = canvas;
      sizeScene(width, height);
      gl.bindVertexArray(vao);
      gl.viewport(0, 0, width, height);

      const setUniforms = ({ program, uniforms }: ReturnType<typeof compileProgram>, mode: number) => {
        gl.useProgram(program);
        gl.uniform2f(uniforms.uResolution, width, height);
        gl.uniform1f(uniforms.uTime, time);
        gl.uniform1f(uniforms.uLightMode, mode);
        gl.uniform3f(uniforms.uDarkBackground, dark[0], dark[1], dark[2]);
        gl.uniform1f(uniforms.uPixelRatio, pixelRatio);
        gl.uniform3f(uniforms.uLightBackground, light[0], light[1], light[2]);
      };

      const drawThemed = (mode: number, blend: boolean) => {
        gl.disable(gl.BLEND);
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
        setUniforms(programs.field, mode);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, scene);
        setUniforms(programs.post, mode);
        if (blend) {
          gl.enable(gl.BLEND);
          gl.blendColor(theme, theme, theme, theme);
          gl.blendFuncSeparate(gl.CONSTANT_COLOR, gl.ONE_MINUS_CONSTANT_COLOR, gl.ONE, gl.ZERO);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      if (theme <= 0 || theme >= 1) { drawThemed(theme, false); return; }
      drawThemed(0, false);
      drawThemed(1, true);
    }, canvas, release, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
    return handle;
  } catch (error) {
    release();
    throw error;
  }
}
