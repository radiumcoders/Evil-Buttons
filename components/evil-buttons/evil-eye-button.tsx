"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface EvilEyeButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Label used when no children are provided. */
  label?: React.ReactNode;
  /** Iris and glow color, as a hex string. */
  eyeColor?: string;
  /** Brightness multiplier for the flames. */
  intensity?: number;
  /** Size of the slit pupil. Lower values make it tighter. */
  pupilSize?: number;
  /** Width of the iris ring. */
  irisWidth?: number;
  /** Strength of the glow around the iris. */
  glowIntensity?: number;
  /** Zoom of the eye inside the button. Lower values zoom in. */
  scale?: number;
  /** Scale of the flame noise. */
  noiseScale?: number;
  /** How far the pupil tracks the cursor, 0 to 1. */
  pupilFollow?: number;
  /** Speed of the flames licking around the iris. */
  flameSpeed?: number;
  /** Blink every few seconds on its own, as well as on press. */
  blink?: boolean;
  /** Extra classes for the eye layer behind the label. */
  eyeClassName?: string;
  /** Extra classes for the label. */
  labelClassName?: string;
}

/* ---------- Shader ---------- */

const VERTEX = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// The React Bits evil eye: polar-mapped noise makes flames around an iris
// ring, with a vertical slit pupil. uFocus narrows the slit and stokes the
// flames while hovered.
const FRAGMENT = `
precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform sampler2D uNoise;
uniform float uPupilSize;
uniform float uIrisWidth;
uniform float uGlow;
uniform float uIntensity;
uniform float uScale;
uniform float uNoiseScale;
uniform vec2 uLook;
uniform float uFocus;
uniform vec3 uEyeColor;
uniform vec3 uBgColor;

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / uRes.y;
  uv /= uScale;
  float ft = uTime;

  vec2 polarUv = vec2(length(uv) * 2.0, (2.0 * atan(uv.x, uv.y)) / 6.28 * 0.3);
  vec4 noiseA = texture2D(uNoise, polarUv * vec2(0.2, 7.0) * uNoiseScale + vec2(-ft * 0.1, 0.0));
  vec4 noiseB = texture2D(uNoise, polarUv * vec2(0.3, 4.0) * uNoiseScale + vec2(-ft * 0.2, 0.0));
  vec4 noiseC = texture2D(uNoise, polarUv * vec2(0.1, 5.0) * uNoiseScale + vec2(-ft * 0.1, 0.0));

  float distanceMask = 1.0 - length(uv);

  float innerRing = clamp(-1.0 * ((distanceMask - 0.7) / uIrisWidth), 0.0, 1.0);
  innerRing = (innerRing * distanceMask - 0.2) / 0.28;
  innerRing += noiseA.r - 0.5;
  innerRing *= 1.3;
  innerRing = clamp(innerRing, 0.0, 1.0);

  float outerRing = clamp(-1.0 * ((distanceMask - 0.5) / 0.2), 0.0, 1.0);
  outerRing = (outerRing * distanceMask - 0.1) / 0.38;
  outerRing += noiseC.r - 0.5;
  outerRing *= 1.3;
  outerRing = clamp(outerRing, 0.0, 1.0);

  innerRing += outerRing;

  float innerEye = distanceMask - 0.2;
  innerEye *= noiseB.r * 2.0;

  vec2 pupilUv = uv - uLook * 0.32;
  float slit = mix(9.0, 14.0, uFocus);
  float pupil = 1.0 - length(pupilUv * vec2(slit, 2.3));
  pupil *= uPupilSize;
  pupil = clamp(pupil, 0.0, 1.0);
  pupil /= 0.35;

  float outerEyeGlow = 1.0 - length(uv * vec2(0.5, 1.5));
  outerEyeGlow = clamp(outerEyeGlow + 0.5, 0.0, 1.0);
  outerEyeGlow += noiseC.r - 0.5;
  float outerBgGlow = outerEyeGlow;
  outerEyeGlow = pow(outerEyeGlow, 2.0);
  outerEyeGlow += distanceMask;
  outerEyeGlow *= uGlow;
  outerEyeGlow = clamp(outerEyeGlow, 0.0, 1.0);
  outerEyeGlow *= pow(1.0 - distanceMask, 2.0) * 2.5;

  outerBgGlow += distanceMask;
  outerBgGlow = pow(outerBgGlow, 0.5);
  outerBgGlow *= 0.15;

  float lit = clamp(max(innerRing + innerEye, outerEyeGlow + outerBgGlow) - pupil, 0.0, 3.0);
  vec3 color = uEyeColor * uIntensity * (1.0 + uFocus * 0.12) * lit;
  gl_FragColor = vec4(color + uBgColor, 1.0);
}
`;

/** Tileable fractal value noise, built once and shared by every eye. */
let noiseCache: Uint8Array | null = null;

function noiseTexture(size = 256) {
  if (noiseCache) return noiseCache;
  const data = new Uint8Array(size * size * 4);
  const hash = (x: number, y: number, s: number) => {
    let n = x * 374761393 + y * 668265263 + s * 1274126177;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (px: number, py: number, freq: number, seed: number) => {
    const fx = (px / size) * freq;
    const fy = (py / size) * freq;
    const ix = Math.floor(fx);
    const iy = Math.floor(fy);
    const tx = fx - ix;
    const ty = fy - iy;
    const w = freq | 0;
    const wrap = (v: number) => ((v % w) + w) % w;
    const v00 = hash(wrap(ix), wrap(iy), seed);
    const v10 = hash(wrap(ix + 1), wrap(iy), seed);
    const v01 = hash(wrap(ix), wrap(iy + 1), seed);
    const v11 = hash(wrap(ix + 1), wrap(iy + 1), seed);
    return (
      v00 * (1 - tx) * (1 - ty) +
      v10 * tx * (1 - ty) +
      v01 * (1 - tx) * ty +
      v11 * tx * ty
    );
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0;
      let amp = 0.4;
      let total = 0;
      for (let o = 0; o < 8; o++) {
        v += amp * noise(x, y, 32 * (1 << o), o * 31);
        total += amp;
        amp *= 0.65;
      }
      v = Math.max(0, Math.min(1, (v / total - 0.5) * 2.2 + 0.5));
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = Math.round(v * 255);
      data[i + 3] = 255;
    }
  }
  noiseCache = data;
  return data;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.replace(/./g, "$&$&") : h;
  const n = parseInt(full.slice(0, 6), 16) || 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const UNIFORMS = [
  "uTime",
  "uRes",
  "uNoise",
  "uPupilSize",
  "uIrisWidth",
  "uGlow",
  "uIntensity",
  "uScale",
  "uNoiseScale",
  "uLook",
  "uFocus",
  "uEyeColor",
  "uBgColor",
] as const;

type EyeGL = {
  gl: WebGLRenderingContext;
  u: Record<(typeof UNIFORMS)[number], WebGLUniformLocation | null>;
};

function createEyeGL(canvas: HTMLCanvasElement): EyeGL | null {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    powerPreference: "low-power",
  });
  if (!gl) return null;

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERTEX);
  const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vs || !fs) return null;
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    256,
    256,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    noiseTexture(256),
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

  const u = Object.fromEntries(
    UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)]),
  ) as EyeGL["u"];
  gl.uniform1i(u.uNoise, 0);
  return { gl, u };
}

/* ---------- Component ---------- */

/** The face color; the shader paints it behind the eye so the socket blends in. */
const FACE = "#0c0706";

export const EvilEyeButton = React.forwardRef<
  HTMLButtonElement,
  EvilEyeButtonProps
>(
  (
    {
      children,
      label = "I see you",
      eyeColor = "#ff6f37",
      intensity = 1.3,
      pupilSize = 0.62,
      irisWidth = 0.22,
      glowIntensity = 0.5,
      scale = 1.7,
      noiseScale = 0.8,
      pupilFollow = 0.8,
      flameSpeed = 0.8,
      blink = true,
      eyeClassName,
      labelClassName,
      className,
      style,
      disabled,
      type = "button",
      onPointerEnter,
      onPointerLeave,
      onClick,
      ...props
    },
    ref,
  ) => {
    const hostRef = React.useRef<HTMLSpanElement | null>(null);
    const topLidRef = React.useRef<HTMLSpanElement | null>(null);
    const bottomLidRef = React.useRef<HTMLSpanElement | null>(null);
    const [painted, setPainted] = React.useState(false);

    // Live tuning the render loop reads, so slider drags never rebuild the GL.
    const live = React.useRef({
      eyeColor,
      intensity,
      pupilSize,
      irisWidth,
      glowIntensity,
      scale,
      noiseScale,
      pupilFollow,
      flameSpeed,
      focusTarget: 0,
    });
    Object.assign(live.current, {
      eyeColor,
      intensity,
      pupilSize,
      irisWidth,
      glowIntensity,
      scale,
      noiseScale,
      pupilFollow,
      flameSpeed,
    });

    const blinkNow = React.useCallback(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const timing = { duration: 200 };
      // Animate `scale`, the property Tailwind's scale-y-0 sets; animating
      // transform instead would multiply with it and stay shut at zero.
      const shut = [
        { scale: "1 0", easing: "cubic-bezier(0.5, 0, 0.75, 0)" },
        { scale: "1 1", offset: 0.4 },
        { scale: "1 1", offset: 0.55, easing: "cubic-bezier(0.25, 1, 0.5, 1)" },
        { scale: "1 0" },
      ];
      topLidRef.current?.animate(shut, timing);
      bottomLidRef.current?.animate(shut, timing);
    }, []);

    React.useEffect(() => {
      const host = hostRef.current;
      if (!host) return;
      // A fresh canvas per run: a lost context never comes back on the same
      // canvas, which would freeze the eye after Strict Mode's remount.
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "display:block;width:100%;height:100%";
      const eye = createEyeGL(canvas);
      if (!eye) return;
      host.appendChild(canvas);
      const { gl, u } = eye;
      const state = live.current;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      let raf = 0;
      let last = 0;
      let time = 0;
      let focus = 0;
      let visible = true;
      let first = true;
      const look = { x: 0, y: 0, tx: 0, ty: 0 };

      const draw = () => {
        gl.uniform1f(u.uTime, time);
        gl.uniform2f(u.uRes, canvas.width, canvas.height);
        gl.uniform1f(u.uPupilSize, state.pupilSize);
        gl.uniform1f(u.uIrisWidth, state.irisWidth);
        gl.uniform1f(u.uGlow, state.glowIntensity);
        gl.uniform1f(u.uIntensity, state.intensity);
        gl.uniform1f(u.uScale, state.scale);
        gl.uniform1f(u.uNoiseScale, state.noiseScale);
        gl.uniform2f(u.uLook, look.x, look.y);
        gl.uniform1f(u.uFocus, focus);
        gl.uniform3f(u.uEyeColor, ...hexToRgb(state.eyeColor));
        gl.uniform3f(u.uBgColor, ...hexToRgb(FACE));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (first) {
          first = false;
          setPainted(true);
        }
      };

      const frame = (now: number) => {
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
        last = now;
        time += dt * state.flameSpeed;
        focus += (state.focusTarget - focus) * Math.min(1, dt * 7);
        look.x += (look.tx - look.x) * Math.min(1, dt * 6);
        look.y += (look.ty - look.y) * Math.min(1, dt * 6);
        draw();
        raf = requestAnimationFrame(frame);
      };
      const start = () => {
        if (raf || reduceMotion || !visible || document.hidden) return;
        last = 0;
        raf = requestAnimationFrame(frame);
      };
      const stop = () => {
        cancelAnimationFrame(raf);
        raf = 0;
      };

      // The eye watches the cursor anywhere on the page, not just over itself.
      const onPointerMove = (event: PointerEvent) => {
        const rect = host.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const reach = 240;
        const dist = Math.hypot(dx, dy);
        const k = (Math.min(dist, reach) / reach / (dist || 1)) * state.pupilFollow;
        look.tx = dx * k;
        look.ty = -dy * k;
      };
      window.addEventListener("pointermove", onPointerMove, { passive: true });

      const resize = () => {
        // At least 2x even on 1x screens: downsampling turns the flame noise
        // into smooth licks instead of speckle.
        const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
        canvas.width = Math.max(1, Math.round(host.clientWidth * dpr));
        canvas.height = Math.max(1, Math.round(host.clientHeight * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
        draw();
      };
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(host);
      const intersection = new IntersectionObserver(([entry]) => {
        visible = !!entry?.isIntersecting;
        if (visible) start();
        else stop();
      });
      intersection.observe(host);
      const onVisibility = () => (document.hidden ? stop() : start());
      document.addEventListener("visibilitychange", onVisibility);
      const onLost = (event: Event) => {
        event.preventDefault();
        stop();
        setPainted(false);
      };
      canvas.addEventListener("webglcontextlost", onLost);

      resize();
      start();

      return () => {
        stop();
        window.removeEventListener("pointermove", onPointerMove);
        resizeObserver.disconnect();
        intersection.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        canvas.removeEventListener("webglcontextlost", onLost);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        canvas.remove();
        setPainted(false);
      };
    }, []);

    // Idle blinks at uneven intervals, so it never feels like a metronome.
    React.useEffect(() => {
      if (!blink) return;
      let timer = 0;
      const schedule = () => {
        timer = window.setTimeout(
          () => {
            if (!document.hidden) blinkNow();
            schedule();
          },
          2800 + Math.random() * 4200,
        );
      };
      schedule();
      return () => window.clearTimeout(timer);
    }, [blink, blinkNow]);

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        onPointerEnter={(event) => {
          onPointerEnter?.(event);
          live.current.focusTarget = 1;
        }}
        onPointerLeave={(event) => {
          onPointerLeave?.(event);
          live.current.focusTarget = 0;
        }}
        onClick={(event) => {
          onClick?.(event);
          blinkNow();
        }}
        style={{ "--eye": eyeColor, ...style } as React.CSSProperties}
        className={cn(
          "group/eye relative isolate inline-flex h-14 min-w-56 cursor-pointer items-center justify-center overflow-hidden rounded-full px-10 text-sm font-semibold tracking-[0.2em] text-white uppercase outline-none select-none",
          // Obsidian shell with an ember hairline, faint top highlight, and a soft drop.
          "bg-[#0c0706] shadow-[0_0_0_1px_color-mix(in_oklab,var(--eye)_30%,black),inset_0_1px_0_rgb(255_255_255/0.1),0_1px_2px_rgb(0_0_0/0.4),0_10px_24px_-10px_rgb(0_0_0/0.7)]",
          "transition-[scale,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
          // Hover: the hairline heats up and the eye's light spills around the button.
          "hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--eye)_60%,black),inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(0_0_0/0.4),0_10px_32px_-8px_color-mix(in_oklab,var(--eye)_50%,transparent)]",
          "active:scale-[0.97] active:duration-100 active:ease-out motion-reduce:active:scale-100",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {/* The eye fills the button. */}
        <span
          aria-hidden
          className={cn("pointer-events-none absolute inset-0 -z-10", eyeClassName)}
        >
          <span
            ref={hostRef}
            className={cn(
              "absolute inset-0 transition-opacity duration-500",
              painted ? "opacity-100" : "opacity-0",
            )}
          />
          {/* Static iris until the shader paints, or for good without WebGL. */}
          {!painted ? (
            <span className="absolute inset-0 bg-[radial-gradient(closest-side,black_0_10%,var(--eye)_16%,color-mix(in_oklab,var(--eye)_45%,black)_45%,transparent_80%)]" />
          ) : null}
          {/* Lids close across the whole button, with curved lash lines. */}
          <span
            ref={topLidRef}
            className="absolute inset-x-[-10%] top-0 h-[54%] origin-top scale-y-0 rounded-b-[50%] shadow-[0_1px_0_color-mix(in_oklab,var(--eye)_40%,transparent)]"
            style={{ background: FACE }}
          />
          <span
            ref={bottomLidRef}
            className="absolute inset-x-[-10%] bottom-0 h-[54%] origin-bottom scale-y-0 rounded-t-[50%] shadow-[0_-1px_0_color-mix(in_oklab,var(--eye)_40%,transparent)]"
            style={{ background: FACE }}
          />
        </span>

        {/* Readability: a soft dark band behind the label, fading out before the
            iris edge, and a rim vignette that frames the eye in the pill. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(30%_38%_at_50%_50%,rgb(12_7_6/0.4),transparent_100%),radial-gradient(ellipse_at_center,transparent_60%,rgb(12_7_6/0.7)_100%)]"
        />
        {/* Glass lip along the top edge. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-[linear-gradient(180deg,rgb(255_255_255/0.1),transparent_35%)]"
        />

        <span
          className={cn(
            "relative whitespace-nowrap [text-shadow:0_1px_2px_rgb(0_0_0/0.9),0_0_12px_color-mix(in_oklab,var(--eye)_55%,transparent)]",
            labelClassName,
          )}
        >
          {children ?? label}
        </span>
      </button>
    );
  },
);

EvilEyeButton.displayName = "EvilEyeButton";

export default EvilEyeButton;
