"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type MotionValue,
} from "motion/react";
import { cn } from "@/lib/utils";

export interface ThrusterButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
  > {
  /** Net thruster acceleration in px/s². Lower values drift, higher values snap. */
  thrust?: number;
  /** Maximum bank in degrees while the craft accelerates sideways. */
  tilt?: number;
  /** Classes for the playground, which fills the nearest positioned ancestor by default. */
  playgroundClassName?: string;
}

type Side = "left" | "right" | "bottom";

// Autopilot gains: a slightly underdamped spring, so the craft overshoots the
// pointer and fires its opposite jets to brake.
const KP = 90;
const KD = 2 * 0.55 * Math.sqrt(KP);
// There are no top jets, so the craft descends by easing off the bottom ones.
const GRAVITY = 1100;
// Jet visuals are scaled against this fixed force, not the `thrust` prop, so the
// same push always looks the same: a stronger craft only blasts harder when it
// actually accelerates harder.
const FULL_BLAST = 3200;
// Valve chatter in px at full blast.
const RUMBLE = 0.35;
// Nozzle length in px; gas leaves from its mouth.
const NOZZLE = 5;
// Bottom pair sits this far in from the corners; side pairs this far from the middle.
const BOTTOM_INSET = 14;
const SIDE_SPREAD = 8;
// Gap kept between the craft and the playground walls.
const WALL_GAP = 2;
// How long the smoke keeps drifting after the craft docks.
const LINGER = 2.2;

// Two valves per edge. Each is drawn pointing down, then rotated onto its edge.
const NOZZLES: {
  side: Side;
  left: string;
  top: string;
  rotate: number;
}[] = [
  { side: "bottom", left: `${BOTTOM_INSET}px`, top: "100%", rotate: 0 },
  { side: "bottom", left: `calc(100% - ${BOTTOM_INSET}px)`, top: "100%", rotate: 0 },
  { side: "left", left: "0px", top: `calc(50% - ${SIDE_SPREAD}px)`, rotate: 90 },
  { side: "left", left: "0px", top: `calc(50% + ${SIDE_SPREAD}px)`, rotate: 90 },
  { side: "right", left: "100%", top: `calc(50% - ${SIDE_SPREAD}px)`, rotate: -90 },
  { side: "right", left: "100%", top: `calc(50% + ${SIDE_SPREAD}px)`, rotate: -90 },
];

/** Resolves any CSS color (oklch included) to 0–1 RGB. */
function toRgb(color: string): [number, number, number] {
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const ctx = probe.getContext("2d");
  if (!ctx) return [0.8, 0.8, 0.8];
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

/* ------------------------------------------------------------------------ */
/* Smoke: a small GPU stable-fluids solver (advect, project, confine curl). */
/* ------------------------------------------------------------------------ */

const MAX_JETS = 6;
const SIM_RES = 128;
const DYE_RES = 384;
const PRESSURE_ITERATIONS = 20;
const VORTICITY = 25;
const VELOCITY_DISSIPATION = 0.6;
const DYE_DISSIPATION = 1.5;

const VERTEX = `#version 300 es
in vec2 aPosition;
out vec2 vUv, vL, vR, vT, vB;
uniform vec2 texelSize;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const HEADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv, vL, vR, vT, vB;
out vec4 fragColor;
`;

const SHADERS = {
  // Elongated gaussians stretched along each jet's direction. Velocity is
  // pinned to the jet's (an inflow), while smoke density accumulates.
  splat: `${HEADER}
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform float radius;
uniform bool pin;
uniform int count;
uniform vec2 points[${MAX_JETS}];
uniform vec2 dirs[${MAX_JETS}];
uniform vec3 values[${MAX_JETS}];
void main() {
  vec3 base = texture(uTarget, vUv).xyz;
  for (int i = 0; i < ${MAX_JETS}; i++) {
    if (i >= count) break;
    vec2 p = vUv - points[i];
    p.x *= aspectRatio;
    float along = dot(p, dirs[i]);
    float across = dot(p, vec2(-dirs[i].y, dirs[i].x));
    float g = exp(-(along * along * 0.3 + across * across) / radius);
    base = pin ? mix(base, values[i], min(g, 1.0)) : base + values[i] * g;
  }
  fragColor = vec4(base, 1.0);
}`,
  advection: `${HEADER}
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 velocityTexel;
uniform float dt;
uniform float dissipation;
void main() {
  vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * velocityTexel;
  fragColor = texture(uSource, coord) / (1.0 + dissipation * dt);
}`,
  divergence: `${HEADER}
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).x;
  float R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y;
  float B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x;
  if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y;
  if (vB.y < 0.0) B = -C.y;
  fragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,
  curl: `${HEADER}
uniform sampler2D uVelocity;
void main() {
  float L = texture(uVelocity, vL).y;
  float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x;
  float B = texture(uVelocity, vB).x;
  fragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,
  // Vorticity confinement feeds the small eddies back so the smoke keeps curling.
  vorticity: `${HEADER}
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float curl;
uniform float dt;
void main() {
  float L = texture(uCurl, vL).x;
  float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x;
  float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C;
  force.y *= -1.0;
  vec2 velocity = texture(uVelocity, vUv).xy + force * dt;
  fragColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);
}`,
  pressure: `${HEADER}
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main() {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  fragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
}`,
  gradientSubtract: `${HEADER}
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main() {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  vec2 velocity = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
  fragColor = vec4(velocity, 0.0, 1.0);
}`,
  scale: `${HEADER}
uniform sampler2D uTexture;
uniform float value;
void main() {
  fragColor = value * texture(uTexture, vUv);
}`,
  // Density becomes flat, soft smoke in the tint color.
  display: `${HEADER}
uniform sampler2D uTexture;
uniform vec3 tint;
uniform float opacity;
void main() {
  float alpha = (1.0 - exp(-texture(uTexture, vUv).r * 1.8)) * opacity;
  fragColor = vec4(tint * alpha, alpha);
}`,
} as const;

type ShaderName = keyof typeof SHADERS;

type Target = {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
};

type DoubleTarget = { read: Target; write: Target; swap: () => void };

type Jet = {
  /** Mouth position in canvas UV, y up. */
  x: number;
  y: number;
  /** Unit direction in aspect-corrected space, y up. */
  dx: number;
  dy: number;
  /** Jet speed in px/s. */
  speed: number;
  /** Smoke emitted this frame. */
  density: number;
};

function createSmoke(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
  });
  if (!gl || !gl.getExtension("EXT_color_buffer_float")) return null;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, VERTEX);

  const programs = {} as Record<
    ShaderName,
    { program: WebGLProgram; uniform: (name: string) => WebGLUniformLocation | null }
  >;
  for (const name of Object.keys(SHADERS) as ShaderName[]) {
    const program = gl.createProgram()!;
    gl.attachShader(program, vertex);
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, SHADERS[name]));
    gl.bindAttribLocation(program, 0, "aPosition");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
    const cache = new Map<string, WebGLUniformLocation | null>();
    programs[name] = {
      program,
      uniform: (uniform) => {
        if (!cache.has(uniform)) cache.set(uniform, gl.getUniformLocation(program, uniform));
        return cache.get(uniform)!;
      },
    };
  }

  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const targets: Target[] = [];
  const createTarget = (width: number, height: number): Target => {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const target = { texture, fbo, width, height };
    targets.push(target);
    return target;
  };
  const createDouble = (width: number, height: number): DoubleTarget => {
    const pair = {
      read: createTarget(width, height),
      write: createTarget(width, height),
      swap: () => {
        [pair.read, pair.write] = [pair.write, pair.read];
      },
    };
    return pair;
  };

  let velocity: DoubleTarget;
  let dye: DoubleTarget;
  let pressure: DoubleTarget;
  let divergence: Target;
  let curl: Target;
  let aspect = 1;

  const program = (name: ShaderName) => {
    const entry = programs[name];
    gl.useProgram(entry.program);
    return entry.uniform;
  };
  const bindTexture = (
    uniform: (name: string) => WebGLUniformLocation | null,
    name: string,
    target: Target,
    unit: number,
  ) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, target.texture);
    gl.uniform1i(uniform(name), unit);
  };
  const draw = (
    uniform: (name: string) => WebGLUniformLocation | null,
    target: Target | null,
    texel: Target,
  ) => {
    gl.uniform2f(uniform("texelSize"), 1 / texel.width, 1 / texel.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, target ? target.width : gl.drawingBufferWidth, target ? target.height : gl.drawingBufferHeight);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const gridFor = (base: number) =>
    aspect >= 1
      ? [Math.round(base * aspect), base]
      : [base, Math.round(base / aspect)];

  const resize = (width: number, height: number) => {
    for (const target of targets.splice(0)) {
      gl.deleteTexture(target.texture);
      gl.deleteFramebuffer(target.fbo);
    }
    aspect = width / height;
    const [simW, simH] = gridFor(SIM_RES);
    const [dyeW, dyeH] = gridFor(DYE_RES);
    velocity = createDouble(simW, simH);
    pressure = createDouble(simW, simH);
    divergence = createTarget(simW, simH);
    curl = createTarget(simW, simH);
    dye = createDouble(dyeW, dyeH);
  };

  const splat = (
    field: DoubleTarget,
    jets: Jet[],
    radius: number,
    pin: boolean,
    value: (jet: Jet) => number[],
  ) => {
    const u = program("splat");
    bindTexture(u, "uTarget", field.read, 0);
    gl.uniform1i(u("pin"), pin ? 1 : 0);
    gl.uniform1f(u("aspectRatio"), aspect);
    gl.uniform1f(u("radius"), radius);
    gl.uniform1i(u("count"), jets.length);
    gl.uniform2fv(u("points"), jets.flatMap((jet) => [jet.x, jet.y]));
    gl.uniform2fv(u("dirs"), jets.flatMap((jet) => [jet.dx, jet.dy]));
    gl.uniform3fv(u("values"), jets.flatMap(value));
    draw(u, field.write, field.read);
    field.swap();
  };

  return {
    resize,
    clear() {
      for (const target of targets) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    },
    /** `cssWidth`/`cssHeight` map jet speeds in px/s onto the grid. */
    step(dt: number, jets: Jet[], jetRadiusPx: number, cssWidth: number, cssHeight: number) {
      gl.disable(gl.BLEND);

      if (jets.length) {
        const radius = (jetRadiusPx / cssHeight) ** 2;
        const pxToGridX = velocity.read.width / cssWidth;
        const pxToGridY = velocity.read.height / cssHeight;
        splat(velocity, jets, radius, true, (jet) => [
          jet.dx * jet.speed * pxToGridX,
          jet.dy * jet.speed * pxToGridY,
          0,
        ]);
        splat(dye, jets, radius, false, (jet) => [jet.density, jet.density, jet.density]);
      }

      let u = program("curl");
      bindTexture(u, "uVelocity", velocity.read, 0);
      draw(u, curl, velocity.read);

      u = program("vorticity");
      bindTexture(u, "uVelocity", velocity.read, 0);
      bindTexture(u, "uCurl", curl, 1);
      gl.uniform1f(u("curl"), VORTICITY);
      gl.uniform1f(u("dt"), dt);
      draw(u, velocity.write, velocity.read);
      velocity.swap();

      u = program("divergence");
      bindTexture(u, "uVelocity", velocity.read, 0);
      draw(u, divergence, velocity.read);

      u = program("scale");
      bindTexture(u, "uTexture", pressure.read, 0);
      gl.uniform1f(u("value"), 0.8);
      draw(u, pressure.write, pressure.read);
      pressure.swap();

      u = program("pressure");
      bindTexture(u, "uDivergence", divergence, 1);
      for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
        bindTexture(u, "uPressure", pressure.read, 0);
        draw(u, pressure.write, pressure.read);
        pressure.swap();
      }

      u = program("gradientSubtract");
      bindTexture(u, "uPressure", pressure.read, 0);
      bindTexture(u, "uVelocity", velocity.read, 1);
      draw(u, velocity.write, velocity.read);
      velocity.swap();

      u = program("advection");
      gl.uniform2f(u("velocityTexel"), 1 / velocity.read.width, 1 / velocity.read.height);
      gl.uniform1f(u("dt"), dt);
      bindTexture(u, "uVelocity", velocity.read, 0);
      bindTexture(u, "uSource", velocity.read, 1);
      gl.uniform1f(u("dissipation"), VELOCITY_DISSIPATION);
      draw(u, velocity.write, velocity.read);
      velocity.swap();

      bindTexture(u, "uVelocity", velocity.read, 0);
      bindTexture(u, "uSource", dye.read, 1);
      gl.uniform1f(u("dissipation"), DYE_DISSIPATION);
      draw(u, dye.write, dye.read);
      dye.swap();
    },
    render(tint: [number, number, number], opacity: number) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const u = program("display");
      bindTexture(u, "uTexture", dye.read, 0);
      gl.uniform3f(u("tint"), ...tint);
      gl.uniform1f(u("opacity"), opacity);
      draw(u, null, dye.read);
    },
    // Frees GPU memory but keeps the context alive: the same canvas can be set
    // up again (an effect re-run, or Strict Mode's double mount), and a lost
    // context would come back dead.
    dispose() {
      for (const target of targets.splice(0)) {
        gl.deleteTexture(target.texture);
        gl.deleteFramebuffer(target.fbo);
      }
      for (const { program } of Object.values(programs)) gl.deleteProgram(program);
      gl.deleteShader(vertex);
      gl.deleteBuffer(quad);
    },
  };
}

type Smoke = NonNullable<ReturnType<typeof createSmoke>>;

/* ------------------------------------------------------------------------ */

function Nozzle({
  left,
  top,
  rotate,
  power,
}: {
  left: string;
  top: string;
  rotate: number;
  power: MotionValue<number>;
}) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute size-0"
      style={{ left, top, rotate: `${rotate}deg` }}
    >
      {/* Valve body */}
      <span className="absolute top-0 left-0 h-[5px] w-2 -translate-x-1/2 rounded-b-[2px] border border-t-0 border-border bg-muted shadow-[inset_0_-1px_0_rgb(0_0_0/0.12)] dark:shadow-[inset_0_-1px_0_rgb(0_0_0/0.5)]" />
      {/* Jet core: the narrow, fast stream right at the mouth */}
      <motion.span
        className="absolute top-[5px] left-0 h-4 w-[3px] -translate-x-1/2 origin-top rounded-full bg-[linear-gradient(to_bottom,rgb(148_163_184/0.6),rgb(148_163_184/0))] blur-[0.5px] dark:bg-[linear-gradient(to_bottom,rgb(226_232_240/0.65),rgb(226_232_240/0))]"
        style={{ scaleY: power, opacity: power }}
      />
    </span>
  );
}

const ThrusterButton = React.forwardRef<HTMLButtonElement, ThrusterButtonProps>(
  (
    {
      children,
      className,
      thrust = 3200,
      tilt = 10,
      playgroundClassName,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const playgroundRef = React.useRef<HTMLDivElement>(null);
    const craftRef = React.useRef<HTMLSpanElement>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const reduceMotion = useReducedMotion();

    // Offset from the landing pad at the bottom middle; y is negative in the air.
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const bank = useMotionValue(0);
    const rotate = useSpring(bank, { stiffness: 220, damping: 18 });
    const jetLeft = useMotionValue(0);
    const jetRight = useMotionValue(0);
    const jetBottom = useMotionValue(0);

    // Read live by the flight loop, so tuning these mid-flight doesn't restart it.
    const settings = React.useRef({ thrust, tilt });
    React.useEffect(() => {
      settings.current = { thrust, tilt };
    }, [thrust, tilt]);

    React.useEffect(() => {
      const playground = playgroundRef.current;
      const craft = craftRef.current;
      if (!playground || !craft || reduceMotion || disabled) return;

      const pos = { x: x.get(), y: 0 };
      const vel = { x: 0, y: 0 };
      const target = { x: 0, y: 0 };
      let mode: "landed" | "flying" | "landing" = "landed";
      let frame = 0;
      let last = 0;
      let lingering = 0;
      // Set on landing so the next frame blasts a cloud along the floor.
      let touchdown = false;
      // undefined: not tried yet; null: no WebGL2, so the craft flies without smoke.
      let smoke: Smoke | null | undefined;
      let tint: [number, number, number] = [0.8, 0.8, 0.8];
      let opacity = 0.6;
      let width = 0;
      let height = 0;
      let simW = 0;
      let simH = 0;
      let halfW = 0;
      let halfH = 0;

      // How far the craft can travel from its pad before touching a wall.
      const bounds = () => {
        const reachX = Math.max(0, width / 2 - halfW - NOZZLE - WALL_GAP);
        const ceiling = Math.min(0, -(height - NOZZLE - halfH * 2 - WALL_GAP));
        return { reachX, ceiling };
      };

      const measure = () => {
        width = playground.clientWidth;
        height = playground.clientHeight;
        halfW = craft.offsetWidth / 2;
        halfH = craft.offsetHeight / 2;
      };

      const prepareSmoke = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (smoke === undefined) smoke = createSmoke(canvas);
        if (!smoke) return;
        if (width !== simW || height !== simH) {
          simW = width;
          simH = height;
          const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
          canvas.width = Math.max(1, Math.round(width * dpr));
          canvas.height = Math.max(1, Math.round(height * dpr));
          smoke.resize(Math.max(width, 1), Math.max(height, 1));
        }
        // The smoke tint follows the theme through the canvas's text color.
        const style = getComputedStyle(canvas);
        tint = toRgb(style.color);
        opacity = Number.parseFloat(style.getPropertyValue("--smoke-opacity")) || 0.6;
      };

      const jetPower = (force: number, max: number) => {
        if (force <= max * 0.03) return 0;
        return Math.min(1, force / max) ** 0.7;
      };

      const cutJets = () => {
        jetLeft.set(0);
        jetRight.set(0);
        jetBottom.set(0);
        bank.set(0);
      };

      const step = (now: number) => {
        const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
        last = now;
        const jets: Jet[] = [];
        const sideThrust = Math.max(settings.current.thrust, 1);
        // The bottom jets also carry the craft's weight.
        const liftThrust = sideThrust + GRAVITY;
        if (touchdown && smoke) {
          touchdown = false;
          // Trapped air bursts out sideways from under the craft as it settles.
          const floorY = 1 - (height - 1) / height;
          for (const side of [-1, 1]) {
            for (const reach of [0.4, 1]) {
              jets.push({
                x: (width / 2 + pos.x + side * halfW * reach) / width,
                y: floorY,
                dx: side,
                dy: 0.15,
                speed: 900,
                density: 0.8,
              });
            }
          }
        }

        if (mode !== "landed") {
          const { reachX, ceiling } = bounds();
          const wantX = KP * (target.x - pos.x) - KD * vel.x;
          let wantY = KP * (target.y - pos.y) - KD * vel.y;
          // Only gravity can stop a climb, so cut lift once the craft would
          // need all of it to stop in the height that's left.
          if (vel.y < 0) {
            const stopping = (vel.y * vel.y) / (2 * GRAVITY * 0.7);
            if (stopping >= pos.y - target.y) wantY = Math.max(wantY, GRAVITY * 0.7);
          }
          const sideForce = Math.max(-sideThrust, Math.min(sideThrust, wantX));
          // Thrusting up is negative y; the jets can only push, never pull.
          const liftForce = Math.max(0, Math.min(liftThrust, GRAVITY - wantY));

          vel.x += sideForce * dt;
          vel.y += (GRAVITY - liftForce) * dt;
          pos.x += vel.x * dt;
          pos.y += vel.y * dt;

          // Walls and ceiling knock it back; the floor soaks up most of the hit.
          if (Math.abs(pos.x) > reachX) {
            pos.x = Math.sign(pos.x) * reachX;
            vel.x *= -0.35;
          }
          if (pos.y < ceiling) {
            pos.y = ceiling;
            vel.y *= -0.35;
          }
          if (pos.y > 0) {
            pos.y = 0;
            if (vel.y > 0) vel.y *= -0.2;
            vel.x *= 0.85;
          }

          if (mode === "landing" && pos.y > -0.5 && Math.hypot(vel.x, vel.y) < 8) {
            // Touched down: valves shut and the smoke is left to drift.
            mode = "landed";
            lingering = LINGER;
            touchdown = true;
            pos.y = 0;
            vel.x = vel.y = 0;
            x.set(pos.x);
            y.set(0);
            cutJets();
          } else {
            // Pushing right means the left jets fire, and so on.
            const power: Record<Side, number> = {
              left: jetPower(sideForce, FULL_BLAST),
              right: jetPower(-sideForce, FULL_BLAST),
              bottom: jetPower(liftForce, FULL_BLAST + GRAVITY),
            };
            jetLeft.set(power.left);
            jetRight.set(power.right);
            jetBottom.set(power.bottom);
            bank.set(Math.max(-1, Math.min(1, sideForce / FULL_BLAST)) * settings.current.tilt);

            const blast = Math.max(power.left, power.right, power.bottom) * RUMBLE;
            x.set(pos.x + (Math.random() - 0.5) * blast);
            y.set(Math.min(0, pos.y + (Math.random() - 0.5) * blast));

            if (smoke) {
              // Craft center in playground pixels, and its current bank.
              const centerX = width / 2 + pos.x;
              const centerY = height - NOZZLE - halfH + pos.y;
              const angle = (rotate.get() * Math.PI) / 180;
              const cos = Math.cos(angle);
              const sin = Math.sin(angle);
              const mouths: [Side, number, number, number, number][] = [
                ["bottom", -halfW + BOTTOM_INSET, halfH + NOZZLE, 0, 1],
                ["bottom", halfW - BOTTOM_INSET, halfH + NOZZLE, 0, 1],
                ["left", -halfW - NOZZLE, -SIDE_SPREAD, -1, 0],
                ["left", -halfW - NOZZLE, SIDE_SPREAD, -1, 0],
                ["right", halfW + NOZZLE, -SIDE_SPREAD, 1, 0],
                ["right", halfW + NOZZLE, SIDE_SPREAD, 1, 0],
              ];
              for (const [side, mx, my, dx, dy] of mouths) {
                const p = power[side];
                if (p <= 0) continue;
                const ex = dx * cos - dy * sin;
                const ey = dx * sin + dy * cos;
                // Valves sputter a little, so paired jets never look identical.
                const sputter = 0.75 + Math.random() * 0.5;
                jets.push({
                  x: (centerX + mx * cos - my * sin) / width,
                  y: 1 - (centerY + mx * sin + my * cos) / height,
                  dx: ex,
                  dy: -ey,
                  speed: (380 + 520 * p) * sputter,
                  density: p * 0.3 * sputter * dt * 60,
                });
              }
            }
          }
        } else {
          lingering -= dt;
        }

        if (smoke) {
          smoke.step(dt, jets, 3, width, height);
          // Ease the last of the smoke out before the loop stops and clears it.
          const fade = mode === "landed" ? Math.min(1, lingering / 1.2) : 1;
          smoke.render(tint, opacity * Math.max(0, fade));
        }

        if (mode === "landed" && lingering <= 0) {
          smoke?.clear();
          smoke?.render(tint, opacity);
          frame = 0;
          last = 0;
          return;
        }
        frame = requestAnimationFrame(step);
      };

      const ignite = () => {
        if (frame) return;
        measure();
        prepareSmoke();
        frame = requestAnimationFrame(step);
      };

      const land = () => {
        if (mode !== "flying") return;
        // Come straight down from wherever it is.
        mode = "landing";
        target.x = pos.x;
        target.y = 0;
        ignite();
      };

      const onPointerMove = (event: PointerEvent) => {
        const rect = playground.getBoundingClientRect();
        measure();
        // Back out any ancestor scale so the pointer lands in layout pixels.
        const px = (event.clientX - rect.left) * (width / (rect.width || 1));
        const py = (event.clientY - rect.top) * (height / (rect.height || 1));
        if (px < 0 || py < 0 || px > width || py > height) {
          land();
          return;
        }

        const { reachX, ceiling } = bounds();
        // Fly the craft's center onto the pointer, as far as the walls allow.
        target.x = Math.max(-reachX, Math.min(reachX, px - width / 2));
        target.y = Math.max(ceiling, Math.min(0, py - (height - NOZZLE - halfH)));
        mode = "flying";
        ignite();
      };

      const onPointerEnd = (event: PointerEvent) => {
        if (event.pointerType === "touch") land();
      };

      // Keep a landed craft inside the playground when it resizes.
      const observer = new ResizeObserver(() => {
        measure();
        const { reachX } = bounds();
        if (Math.abs(pos.x) > reachX) {
          pos.x = Math.sign(pos.x) * reachX;
          if (mode === "landed") x.set(pos.x);
        }
      });
      observer.observe(playground);

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerdown", onPointerMove, { passive: true });
      window.addEventListener("pointerup", onPointerEnd);
      window.addEventListener("pointercancel", onPointerEnd);
      document.documentElement.addEventListener("pointerleave", land);
      window.addEventListener("blur", land);
      return () => {
        observer.disconnect();
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerdown", onPointerMove);
        window.removeEventListener("pointerup", onPointerEnd);
        window.removeEventListener("pointercancel", onPointerEnd);
        document.documentElement.removeEventListener("pointerleave", land);
        window.removeEventListener("blur", land);
        cancelAnimationFrame(frame);
        smoke?.dispose();
        x.set(pos.x);
        y.set(0);
        cutJets();
      };
    }, [
      reduceMotion,
      disabled,
      x,
      y,
      bank,
      rotate,
      jetLeft,
      jetRight,
      jetBottom,
    ]);

    return (
      <div
        ref={playgroundRef}
        className={cn(
          "pointer-events-none absolute inset-0 overflow-hidden",
          playgroundClassName,
        )}
      >
        {/* Smoke fills the playground; its floor is the bottom edge. */}
        <canvas
          ref={canvasRef}
          aria-hidden
          width={0}
          height={0}
          className="absolute inset-0 size-full text-slate-400 [--smoke-opacity:0.6] dark:text-slate-200 dark:[--smoke-opacity:0.55]"
        />
        <motion.span
          ref={craftRef}
          className="pointer-events-auto absolute left-1/2 inline-flex -translate-x-1/2"
          style={{ bottom: NOZZLE, x, y, rotate }}
        >
          {NOZZLES.map((nozzle, i) => (
            <Nozzle
              key={i}
              left={nozzle.left}
              top={nozzle.top}
              rotate={nozzle.rotate}
              power={
                nozzle.side === "left"
                  ? jetLeft
                  : nozzle.side === "right"
                    ? jetRight
                    : jetBottom
              }
            />
          ))}
          <motion.button
            ref={ref}
            type={type}
            disabled={disabled}
            whileTap={disabled ? undefined : { scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className={cn(
              "relative inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.05),0_2px_6px_-3px_rgb(0_0_0/0.07),inset_0_-1px_0_rgb(0_0_0/0.03)] dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),inset_0_1px_0_rgb(255_255_255/0.05)] outline-none select-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
            {...props}
          >
            {children}
          </motion.button>
        </motion.span>
      </div>
    );
  },
);

ThrusterButton.displayName = "ThrusterButton";

export { ThrusterButton };
export default ThrusterButton;
