"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DetonationOrigin } from "./events";

/*
 * The SlideToDetonate easter egg: a blast at the handle, then a burn front that
 * eats the whole viewport. One WebGL2 pass draws scorch, char, the glowing edge,
 * flames, fireball, shockwave and flash; a 2D canvas on top throws sparks and
 * embers. JS owns the timeline and feeds the shader plain numbers.
 */

const VERTEX_SHADER = `#version 300 es
void main() {
  vec2 position = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uScale;
uniform float uTime;
uniform vec2 uOrigin;
uniform float uRadius;
uniform float uHeat;
uniform float uFlash;
uniform vec2 uShock;
uniform float uFireball;
out vec4 outColor;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

const mat2 ROT = mat2(0.8, 0.6, -0.6, 0.8);

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = ROT * p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v / 0.9375;
}

// Blackbody-ish: 0 deep red, 0.5 orange, 1 white-hot.
vec3 fireRamp(float x) {
  x = clamp(x, 0.0, 1.0);
  return vec3(min(1.0, x * 1.7), pow(x, 1.8) * 1.05, pow(x, 4.0) * 0.85);
}

// Pixels behind the burn front (negative = not burnt yet).
float burnAt(vec2 p) {
  float lobes = fbm(p / 230.0) - 0.5;
  float rag = noise(p / 24.0) - 0.5;
  float amp = min(300.0, uRadius * 0.6);
  return uRadius - (length(p - uOrigin) + lobes * amp + rag * 28.0);
}

// Where the paper is actively on fire: just behind the front.
float onFire(float b) {
  return smoothstep(0.0, 14.0, b) * (1.0 - smoothstep(60.0, 230.0, b));
}

const float FLAME_HEIGHT = 170.0;

float flames(vec2 p) {
  // Stretched vertical noise scrolling up reads as licking tongues.
  float tongue = fbm(vec2(p.x / 22.0, p.y / 64.0 + uTime * 3.4));
  float sway = noise(vec2(p.x / 60.0, p.y / 60.0 + uTime * 1.2)) - 0.5;
  float f = 0.0;
  for (int i = 0; i < 5; i++) {
    float h = float(i) * 0.25 * FLAME_HEIGHT;
    vec2 base = p + vec2(sway * 50.0 * float(i) * 0.25, h);
    float lit = onFire(burnAt(base));
    float reach = clamp((tongue * 1.45 - h / FLAME_HEIGHT) * 2.2, 0.0, 1.0);
    f = max(f, lit * reach);
  }
  return f;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uResolution.y * uScale - gl_FragCoord.y) / uScale;
  float b = burnAt(p);
  float d0 = length(p - uOrigin);

  // Paper browning ahead of the front.
  float scorch = smoothstep(-110.0, 0.0, b);
  vec3 color = vec3(0.30, 0.15, 0.04);
  float alpha = scorch * scorch * 0.72;

  // Char behind it: grain, ash flecks, smouldering cracks, drifting smoke.
  float charred = smoothstep(0.0, 5.0, b);
  if (charred > 0.0) {
    float grain = fbm(p / 34.0);
    vec3 charColor = mix(vec3(0.028, 0.022, 0.02), vec3(0.1, 0.085, 0.075), grain);
    charColor += smoothstep(0.82, 0.95, noise(p / 3.2)) * 0.06;
    float ridge = 1.0 - abs(fbm(p / 70.0 + 3.1) * 2.0 - 1.0);
    float smoulder = mix(0.3, 1.0, exp(-b / 240.0)) * uHeat;
    float flicker = 0.6 + 0.4 * noise(p / 30.0 + vec2(uTime * 1.3, -uTime * 0.9));
    charColor += fireRamp(0.55) * pow(ridge, 14.0) * smoulder * flicker * 1.4;
    float smoke = fbm(p / 150.0 + vec2(0.0, uTime * 0.25));
    charColor = mix(charColor, vec3(0.13, 0.12, 0.115), smoke * smoke * 0.5);
    color = mix(color, charColor, charred);
    alpha = mix(alpha, 0.975, charred);
  }

  // The white-hot line where paper turns to char.
  float edge = smoothstep(-4.0, 0.0, b) * exp(-max(b, 0.0) / 10.0);
  color = mix(color, fireRamp(0.72 + 0.28 * exp(-max(b, 0.0) / 4.0)), edge);
  alpha = max(alpha, edge);

  vec3 pm = color * alpha;

  // Firelight thrown onto the page ahead of the front.
  float halo = exp(-abs(b) / 80.0) * (1.0 - charred * 0.5) * 0.4 * uHeat;
  pm += fireRamp(0.5) * halo;
  alpha += halo * 0.6 * (1.0 - alpha);

  // Flames only near the front; skip the loop everywhere else.
  if (uHeat > 0.0 && b > -FLAME_HEIGHT - 80.0 && b < 320.0) {
    float f = flames(p) * uHeat;
    float fa = smoothstep(0.05, 0.4, f);
    pm = pm * (1.0 - fa) + fireRamp(f * 1.15) * fa;
    alpha += fa * (1.0 - alpha);
  }

  if (uFireball > 0.0) {
    float turb = fbm(p / 28.0 + vec2(0.0, uTime * 2.5)) - 0.5;
    float ball = smoothstep(uFireball, uFireball * 0.15, d0 + turb * uFireball * 0.7);
    pm = pm * (1.0 - ball) + fireRamp(ball * 1.2) * ball;
    alpha += ball * (1.0 - alpha);
  }

  float ring = exp(-pow((d0 - uShock.x) / 22.0, 2.0)) * uShock.y;
  pm += vec3(1.0, 0.8, 0.55) * ring * 0.7;
  alpha += ring * 0.5 * (1.0 - alpha);

  vec3 flash = mix(vec3(1.0, 0.95, 0.85), vec3(1.0, 0.55, 0.2), smoothstep(0.0, 1400.0, d0));
  pm = pm * (1.0 - uFlash) + flash * uFlash;
  alpha += uFlash * (1.0 - alpha);

  alpha = clamp(alpha, 0.0, 1.0);
  outColor = vec4(min(pm, vec3(alpha)), alpha);
}
`;

/** Seconds before the paper catches. */
const IGNITE = 0.12;
/** Seconds for the front to sweep past the farthest corner. */
const SPREAD = 4.6;
const SPREAD_REDUCED = 1.6;
/** Instant scorch the blast leaves around the handle. */
const POP = 170;
/** How far past the farthest corner the front runs, so the flames clear the screen. */
const OVERRUN = 460;
/** Seconds for the fire to retreat when rebuilding. */
const REBUILD = 1.5;
const FADE_OUT = 0.35;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  age: number;
  size: number;
  hue: number;
  kind: "spark" | "ember";
};

type Phase = "burning" | "burnt" | "rebuilding";

function farthestCorner(origin: DetonationOrigin, width: number, height: number) {
  return Math.max(
    Math.hypot(origin.x, origin.y),
    Math.hypot(width - origin.x, origin.y),
    Math.hypot(origin.x, height - origin.y),
    Math.hypot(width - origin.x, height - origin.y),
  );
}

function compile(gl: WebGL2RenderingContext) {
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, VERTEX_SHADER],
    [gl.FRAGMENT_SHADER, FRAGMENT_SHADER],
  ] as const) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      return null;
    }
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

function shake(reduceMotion: boolean) {
  if (reduceMotion) return;
  const frames: Keyframe[] = [];
  for (let i = 0; i <= 12; i++) {
    const falloff = Math.pow(1 - i / 12, 2);
    const x = (Math.random() * 2 - 1) * 16 * falloff;
    const y = (Math.random() * 2 - 1) * 12 * falloff;
    const r = (Math.random() * 2 - 1) * 0.6 * falloff;
    frames.push({ transform: `translate(${x}px, ${y}px) rotate(${r}deg)` });
  }
  document.body.animate(frames, { duration: 700, easing: "linear" });
}

export default function DetonationOverlay({
  origin,
  onDone,
}: {
  origin: DetonationOrigin;
  onDone: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sparksRef = useRef<HTMLCanvasElement | null>(null);
  const rebuildButtonRef = useRef<HTMLButtonElement | null>(null);
  const phaseRef = useRef<Phase>("burning");
  const rebuildRef = useRef<{ start: number; from: number } | null>(null);
  const onDoneRef = useRef(onDone);
  const [phase, setPhase] = useState<Phase>("burning");

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const rebuild = useCallback(() => {
    if (phaseRef.current === "rebuilding") return;
    phaseRef.current = "rebuilding";
    setPhase("rebuilding");
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") rebuild();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rebuild]);

  useEffect(() => {
    if (phase !== "burnt") return;
    rebuildButtonRef.current?.focus({ preventScroll: true });
  }, [phase]);

  // Hand focus back to whatever had it (usually the slider) once the page is rebuilt.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus?.({ preventScroll: true });
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const sparksCanvas = sparksRef.current;
    if (!root || !sparksCanvas) return;
    const ctx = sparksCanvas.getContext("2d");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const spread = reduceMotion ? SPREAD_REDUCED : SPREAD;

    // A fresh canvas per mount: Strict Mode re-runs this effect, and a canvas whose
    // context was lost in cleanup can't be reused.
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.className = "absolute inset-0 size-full";
    root.prepend(canvas);
    const gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false });
    const program = gl ? compile(gl) : null;
    if (!gl || !program) {
      // No WebGL2: a plain char disc still eats the page.
      root.style.background = "#0b0908";
      root.style.clipPath = `circle(var(--burn-radius, 0px) at ${origin.x}px ${origin.y}px)`;
    }

    const uniform = (name: string) => (gl && program ? gl.getUniformLocation(program, name) : null);
    const u = {
      resolution: uniform("uResolution"),
      scale: uniform("uScale"),
      time: uniform("uTime"),
      origin: uniform("uOrigin"),
      radius: uniform("uRadius"),
      heat: uniform("uHeat"),
      flash: uniform("uFlash"),
      shock: uniform("uShock"),
      fireball: uniform("uFireball"),
    };

    let width = 0;
    let height = 0;
    let scale = 1;
    let sparkScale = 1;
    let maxRadius = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      // Fire is soft; one shader pixel per CSS pixel is plenty, even on retina.
      scale = Math.min(window.devicePixelRatio || 1, 1);
      sparkScale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      sparksCanvas.width = Math.round(width * sparkScale);
      sparksCanvas.height = Math.round(height * sparkScale);
      maxRadius = farthestCorner(origin, width, height) + OVERRUN;
    };
    resize();
    window.addEventListener("resize", resize);

    const particles: Particle[] = [];
    if (!reduceMotion) {
      for (let i = 0; i < 160; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 250 + Math.pow(Math.random(), 1.6) * 1300;
        particles.push({
          x: origin.x,
          y: origin.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 200,
          life: 0.5 + Math.random() * 1.2,
          age: 0,
          size: 1 + Math.random() * 1.8,
          hue: 28 + Math.random() * 22,
          kind: "spark",
        });
      }
      shake(reduceMotion);
    }

    const spawnEmber = (x: number, y: number) => {
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) return;
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 40,
        vy: -(50 + Math.random() * 110),
        life: 1.4 + Math.random() * 2.2,
        age: 0,
        size: 0.8 + Math.random() * 1.6,
        hue: 18 + Math.random() * 26,
        kind: "ember",
      });
    };

    const radiusAt = (t: number) => {
      const pop = POP * easeOutCubic(clamp01(t / 0.35));
      const run = (maxRadius - POP) * Math.pow(clamp01((t - IGNITE - 0.15) / spread), 1.35);
      return t < IGNITE ? 0 : pop + run;
    };

    const start = performance.now();
    let last = start;
    let frame = 0;
    let burntAt: number | null = null;
    let doneAt: number | null = null;
    let radius = 0;

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      let heat = 1;
      let fade = 1;
      if (phaseRef.current === "rebuilding") {
        rebuildRef.current ??= { start: now, from: radius };
        const k = clamp01((now - rebuildRef.current.start) / 1000 / REBUILD);
        radius = rebuildRef.current.from * (1 - easeInOutCubic(k));
        if (k >= 1) {
          doneAt ??= now;
          fade = 1 - clamp01((now - doneAt) / 1000 / FADE_OUT);
          if (fade <= 0) {
            onDoneRef.current();
            return;
          }
        }
      } else {
        radius = radiusAt(t);
        if (radius >= maxRadius && burntAt === null) {
          burntAt = now;
          phaseRef.current = "burnt";
          setPhase("burnt");
        }
        // Once everything has burnt, the fire settles into a smoulder.
        if (burntAt !== null) heat = 1 - 0.7 * clamp01((now - burntAt) / 2400);
      }

      const flash = reduceMotion ? 0 : 0.9 * Math.exp(-t * 7);
      const shockK = clamp01(t / 0.9);
      const shockRadius = 2600 * easeOutCubic(shockK);
      const shockStrength = reduceMotion ? 0 : Math.pow(1 - shockK, 2);
      const fireball = reduceMotion
        ? 0
        : 230 * easeOutCubic(clamp01(t / 0.2)) * (1 - easeInOutCubic(clamp01((t - 0.25) / 1.1)));

      root.style.opacity = String(fade);

      if (gl && program) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(program);
        gl.uniform2f(u.resolution, width, height);
        gl.uniform1f(u.scale, scale);
        gl.uniform1f(u.time, t);
        gl.uniform2f(u.origin, origin.x, origin.y);
        gl.uniform1f(u.radius, radius);
        gl.uniform1f(u.heat, heat);
        gl.uniform1f(u.flash, flash);
        gl.uniform2f(u.shock, shockRadius, shockStrength);
        gl.uniform1f(u.fireball, fireball);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      } else {
        root.style.setProperty("--burn-radius", `${radius}px`);
      }

      // Embers lift off the burning front, then off the smouldering char.
      if (!reduceMotion && radius > 0) {
        const rate = phaseRef.current === "burnt" ? 14 * heat : 70;
        let count = rate * dt;
        while (count > 0) {
          if (count < 1 && Math.random() > count) break;
          count -= 1;
          const angle = Math.random() * Math.PI * 2;
          const r =
            phaseRef.current === "burnt"
              ? Math.random() * maxRadius
              : Math.max(0, radius - 40 - Math.random() * 180);
          spawnEmber(origin.x + Math.cos(angle) * r, origin.y + Math.sin(angle) * r);
        }
      }

      if (ctx) {
        ctx.setTransform(sparkScale, 0, 0, sparkScale, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.age += dt;
          if (p.age >= p.life) {
            particles.splice(i, 1);
            continue;
          }
          const life = 1 - p.age / p.life;
          if (p.kind === "spark") {
            p.vx *= 1 - 1.6 * dt;
            p.vy = p.vy * (1 - 1.6 * dt) + 900 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            ctx.strokeStyle = `hsla(${p.hue}, 100%, ${55 + life * 35}%, ${life})`;
            ctx.lineWidth = p.size;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.025, p.y - p.vy * 0.025);
            ctx.stroke();
          } else {
            p.vx += Math.sin(p.age * 3 + p.hue) * 30 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            const flicker = 0.6 + 0.4 * Math.sin(p.age * 18 + p.hue * 3);
            ctx.fillStyle = `hsla(${p.hue}, 100%, ${50 + life * 25}%, ${life * flicker})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, [origin]);

  return createPortal(
    <div
      ref={rootRef}
      className="fixed inset-0 z-[2147483000] cursor-default touch-none overflow-hidden select-none"
    >
      <canvas
        ref={sparksRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full"
      />
      <p role="status" className="sr-only">
        {phase === "rebuilding" ? "Rebuilding the page." : "The page is on fire."}
      </p>
      {phase === "burnt" ? (
        <div
          role="alertdialog"
          aria-labelledby="detonation-title"
          aria-describedby="detonation-note"
          className="absolute inset-0 flex items-center justify-center p-6"
        >
          <div className="flex animate-in flex-col items-center text-center duration-700 fade-in zoom-in-95">
            <p className="font-pixel-display text-xs tracking-[0.3em] text-orange-300/70 uppercase">
              Easter egg found
            </p>
            <h2
              id="detonation-title"
              className="mt-3 font-pixel-display text-4xl tracking-tight text-orange-50 drop-shadow-[0_0_24px_rgb(255_120_40/0.55)] sm:text-6xl"
            >
              You burned it all down.
            </h2>
            <p id="detonation-note" className="mt-3 max-w-sm text-sm text-orange-100/60">
              The slider literally said detonate. What did you think would happen?
            </p>
            <button
              ref={rebuildButtonRef}
              type="button"
              onClick={rebuild}
              className="mt-8 inline-flex h-10 items-center rounded-full bg-orange-50 px-5 text-sm font-medium text-neutral-950 shadow-[0_0_0_1px_rgb(255_255_255/0.2),0_0_32px_-4px_rgb(255_120_40/0.7)] transition hover:bg-white focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none"
            >
              Rebuild the page
            </button>
            <p className="mt-3 text-xs text-orange-100/40">or press Esc</p>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
