"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ChromeTone = "silver" | "black";

export interface ChromeButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Label used when no children are provided. */
  label?: React.ReactNode;
  /** Polished silver with an engraved label, or black chrome with a light one. */
  tone?: ChromeTone;
  /** Flow speed multiplier for the liquid surface. */
  speed?: number;
  /** Bulge the metal under the pointer and ripple it on press. */
  interactive?: boolean;
}

const VERTEX = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// A flowing height field, lit as a mirror reflecting a studio environment:
// bright sky, a hot softbox stripe, a dark floor. Normals come from finite
// differences, so the only cost is five height samples per pixel.
const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform float uHover;
uniform vec3 uPress;
uniform float uTone;

vec2 toSpace(vec2 px) {
  return (px - 0.5 * uRes) / uRes.y * 2.0;
}

float height(vec2 p) {
  vec2 q = p * vec2(0.9, 1.1);
  for (float i = 1.0; i < 6.0; i++) {
    q.x += 0.32 / i * cos(i * 2.1 * q.y + uTime * 0.9 + i);
    q.y += 0.32 / i * cos(i * 1.7 * q.x - uTime * 0.7 + i * 1.3);
  }
  float h = 0.5 + 0.5 * sin(q.x * 1.4 + q.y * 1.1);

  vec2 d = p - toSpace(uPointer);
  h += uHover * 0.45 * exp(-dot(d, d) * 5.0);

  float age = uTime - uPress.z;
  if (age > 0.0 && age < 1.6) {
    float r = length(p - toSpace(uPress.xy));
    float front = r - age * 2.2;
    h += sin(r * 16.0 - age * 22.0) * exp(-front * front * 6.0) * exp(-age * 2.4) * 0.35;
  }
  return h;
}

vec3 environment(vec3 r) {
  float y = r.y + 0.12 * sin(r.x * 3.0);
  vec3 floorCol = mix(vec3(0.16, 0.17, 0.19), vec3(0.42, 0.43, 0.46), smoothstep(-0.9, 0.0, y));
  vec3 skyCol = mix(vec3(0.72, 0.74, 0.78), vec3(0.97, 0.98, 1.0), smoothstep(0.1, 0.8, y));
  vec3 col = mix(floorCol, skyCol, smoothstep(-0.04, 0.04, y));
  col += smoothstep(0.07, 0.0, abs(y - 0.3)) * 0.9;
  col += smoothstep(0.05, 0.0, abs(y + 0.35)) * 0.25;
  return col;
}

void main() {
  vec2 p = toSpace(gl_FragCoord.xy);
  float e = 2.0 / uRes.y;
  float h = height(p);
  float hx = height(p + vec2(e, 0.0)) - height(p - vec2(e, 0.0));
  float hy = height(p + vec2(0.0, e)) - height(p - vec2(0.0, e));
  vec3 n = normalize(vec3(-hx / (2.0 * e) * 0.22, -hy / (2.0 * e) * 0.22, 1.0));

  vec3 r = reflect(vec3(0.0, 0.0, -1.0), n);
  vec3 col = environment(r);

  // A faint oil-slick tint keeps it from reading as flat grey.
  col *= 1.0 + 0.05 * vec3(sin(r.x * 5.0 + h), sin(r.x * 5.0 + h + 2.1), sin(r.x * 5.0 + h + 4.2));
  col += pow(1.0 - n.z, 3.0) * 0.6;

  if (uTone > 0.5) {
    float spec = smoothstep(0.85, 1.25, dot(col, vec3(0.3333)));
    col = pow(col, vec3(2.2)) * 0.32 + spec * 0.85;
  }

  // Darken toward the top and bottom edges so the face reads as curved.
  float v = gl_FragCoord.y / uRes.y;
  col *= 0.82 + 0.18 * sin(v * 3.14159);

  gl_FragColor = vec4(col, 1.0);
}
`;

type ChromeGL = {
  gl: WebGLRenderingContext;
  uniforms: Record<
    "uRes" | "uTime" | "uPointer" | "uHover" | "uPress" | "uTone",
    WebGLUniformLocation | null
  >;
};

function createChromeGL(canvas: HTMLCanvasElement): ChromeGL | null {
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

  // One oversized triangle covers the viewport.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const at = (name: string) => gl.getUniformLocation(program, name);
  return {
    gl,
    uniforms: {
      uRes: at("uRes"),
      uTime: at("uTime"),
      uPointer: at("uPointer"),
      uHover: at("uHover"),
      uPress: at("uPress"),
      uTone: at("uTone"),
    },
  };
}

const TONES: Record<
  ChromeTone,
  { fallback: string; label: string }
> = {
  silver: {
    // Shown before WebGL paints, and forever if it can't.
    fallback:
      "bg-[linear-gradient(180deg,#f5f6f8_0%,#c9ccd1_38%,#8d9197_50%,#d9dce0_62%,#fafbfc_100%)]",
    label:
      "text-neutral-900/85 [text-shadow:0_1px_0_rgb(255_255_255/0.65),0_0_10px_rgb(255_255_255/0.5)]",
  },
  black: {
    fallback:
      "bg-[linear-gradient(180deg,#3a3b3e_0%,#141416_40%,#050505_52%,#1c1d20_70%,#4a4b4f_100%)]",
    label:
      "text-white/90 [text-shadow:0_-1px_0_rgb(0_0_0/0.6),0_0_12px_rgb(0_0_0/0.55)]",
  },
};

export const ChromeButton = React.forwardRef<
  HTMLButtonElement,
  ChromeButtonProps
>(
  (
    {
      children,
      label = "Chromy",
      tone = "silver",
      speed = 1,
      interactive = true,
      className,
      disabled,
      type = "button",
      onPointerEnter,
      onPointerMove,
      onPointerLeave,
      onPointerDown,
      onClick,
      ...props
    },
    ref,
  ) => {
    const faceRef = React.useRef<HTMLSpanElement | null>(null);
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const [painted, setPainted] = React.useState(false);

    // Live inputs the render loop reads without re-running the effect.
    const input = React.useRef({
      pointer: [0, 0] as [number, number],
      hoverTarget: 0,
      press: [0, 0, -10] as [number, number, number],
      time: 0,
      speed,
      tone,
      interactive,
    });
    input.current.speed = speed;
    input.current.tone = tone;
    input.current.interactive = interactive;

    React.useEffect(() => {
      const canvas = canvasRef.current;
      const face = faceRef.current;
      if (!canvas || !face) return;
      const chrome = createChromeGL(canvas);
      if (!chrome) return;
      const { gl, uniforms } = chrome;
      const state = input.current;
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      let raf = 0;
      let last = 0;
      let hover = 0;
      let visible = true;
      let first = true;

      const draw = () => {
        gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
        gl.uniform1f(uniforms.uTime, state.time);
        gl.uniform2f(uniforms.uPointer, state.pointer[0], state.pointer[1]);
        gl.uniform1f(uniforms.uHover, state.interactive ? hover : 0);
        gl.uniform3f(uniforms.uPress, ...state.press);
        gl.uniform1f(uniforms.uTone, state.tone === "black" ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (first) {
          first = false;
          setPainted(true);
        }
      };

      const frame = (now: number) => {
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
        last = now;
        hover += (state.hoverTarget - hover) * Math.min(1, dt * 8);
        state.time += dt * state.speed * (1 + hover * 1.4);
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

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.round(face.clientWidth * dpr));
        canvas.height = Math.max(1, Math.round(face.clientHeight * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
        draw();
      };

      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(face);
      // Only animate while on screen.
      const intersection = new IntersectionObserver(([entry]) => {
        visible = !!entry?.isIntersecting;
        if (visible) start();
        else stop();
      });
      intersection.observe(face);
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
        resizeObserver.disconnect();
        intersection.disconnect();
        document.removeEventListener("visibilitychange", onVisibility);
        canvas.removeEventListener("webglcontextlost", onLost);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      };
    }, []);

    /** Pointer position in canvas pixels, y up, as the shader expects. */
    const toCanvas = (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      const face = faceRef.current;
      if (!canvas || !face) return [0, 0] as [number, number];
      const rect = face.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      return [
        (clientX - rect.left) * sx,
        (rect.bottom - clientY) * sy,
      ] as [number, number];
    };

    const ripple = (at: [number, number]) => {
      input.current.press = [at[0], at[1], input.current.time];
    };

    const tones = TONES[tone];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        onPointerEnter={(event) => {
          onPointerEnter?.(event);
          input.current.pointer = toCanvas(event.clientX, event.clientY);
          input.current.hoverTarget = 1;
        }}
        onPointerMove={(event) => {
          onPointerMove?.(event);
          input.current.pointer = toCanvas(event.clientX, event.clientY);
        }}
        onPointerLeave={(event) => {
          onPointerLeave?.(event);
          input.current.hoverTarget = 0;
        }}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          if (interactive) ripple(toCanvas(event.clientX, event.clientY));
        }}
        onClick={(event) => {
          onClick?.(event);
          // Keyboard activation has no pointer: ripple from the center.
          const canvas = canvasRef.current;
          if (interactive && event.detail === 0 && canvas) {
            ripple([canvas.width / 2, canvas.height / 2]);
          }
        }}
        className={cn(
          "group/chrome relative inline-flex cursor-pointer rounded-full p-[1.5px] outline-none select-none",
          // Machined bezel: a hard-lit metal ring around the liquid face.
          tone === "silver"
            ? "bg-[linear-gradient(180deg,#ffffff_0%,#9ea2a8_45%,#5c6066_55%,#e6e8eb_100%)]"
            : "bg-[linear-gradient(180deg,#8a8d93_0%,#2a2b2e_45%,#0a0a0b_55%,#5a5c61_100%)]",
          "shadow-[0_1px_1px_rgb(0_0_0/0.25),0_6px_18px_-6px_rgb(0_0_0/0.5),0_14px_28px_-14px_rgb(0_0_0/0.4)]",
          "transition-[scale,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)]",
          "hover:shadow-[0_1px_1px_rgb(0_0_0/0.25),0_10px_24px_-8px_rgb(0_0_0/0.55),0_18px_36px_-16px_rgb(0_0_0/0.45)]",
          "active:scale-[0.96] active:duration-100 active:ease-out motion-reduce:active:scale-100",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:grayscale",
          className,
        )}
        {...props}
      >
        <span
          ref={faceRef}
          className={cn(
            "relative isolate flex h-11 min-w-36 items-center justify-center overflow-hidden rounded-full px-7",
            tones.fallback,
          )}
        >
          <canvas
            ref={canvasRef}
            aria-hidden
            className={cn(
              "absolute inset-0 size-full transition-opacity duration-500",
              painted ? "opacity-100" : "opacity-0",
            )}
          />
          {/* Glass lip: a top highlight and a soft inner shadow sell the curvature. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.75),inset_0_-2px_4px_rgb(0_0_0/0.25),inset_0_0_0_1px_rgb(0_0_0/0.18)]"
          />
          <span
            className={cn(
              "relative text-sm font-semibold tracking-tight transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] group-active/chrome:translate-y-px",
              tones.label,
            )}
          >
            {children ?? label}
          </span>
        </span>
      </button>
    );
  },
);

ChromeButton.displayName = "ChromeButton";

export default ChromeButton;
