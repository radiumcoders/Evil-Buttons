"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ChromeTone = "dark" | "light";

export interface ChromeButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Label used when no children are provided. */
  label?: React.ReactNode;
  /** White chrome sweeping over black, or dark chrome sweeping over white. */
  tone?: ChromeTone;
  /** Flow speed multiplier for the chrome bands. */
  speed?: number;
  /** Ripple the chrome around the pointer and on press. */
  interactive?: boolean;
}

const VERTEX = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// Liquid chrome: space is warped by stacked cosines, then the chrome is the
// thin bright seam where sin() crosses zero, sweeping diagonally over time.
// Four samples per pixel keep those razor-thin bands from aliasing.
const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform float uHover;
uniform vec3 uPress;
uniform float uTone;

float chrome(vec2 px) {
  vec2 uv = (2.0 * px - uRes) / min(uRes.x, uRes.y);
  for (float i = 1.0; i < 10.0; i++) {
    uv.x += 0.1 / i * cos(i * 3.0 * uv.y + uTime);
    uv.y += 0.1 / i * cos(i * 2.0 * uv.x + uTime);
  }

  // Pointer: a soft ripple rings out around the cursor while hovering.
  vec2 d = (px - uPointer) / uRes.y;
  float dist = length(d) + 0.0001;
  uv += d / dist * sin(10.0 * dist * 2.0 - uTime * 3.0) * 0.05 * exp(-dist * 6.0) * uHover;

  // Press: one ring travels out from the click and fades.
  float age = uTime - uPress.z;
  if (age > 0.0 && age < 2.0) {
    vec2 pd = (px - uPress.xy) / uRes.y;
    float r = length(pd) + 0.0001;
    float front = r - age * 1.2;
    uv += pd / r * sin(r * 30.0 - age * 20.0) * exp(-front * front * 30.0) * exp(-age * 2.5) * 0.12;
  }

  return min(0.04 / abs(sin(uTime - uv.y - uv.x)), 1.0);
}

void main() {
  float c = 0.0;
  c += chrome(gl_FragCoord.xy + vec2(-0.25, -0.25));
  c += chrome(gl_FragCoord.xy + vec2(0.25, -0.25));
  c += chrome(gl_FragCoord.xy + vec2(-0.25, 0.25));
  c += chrome(gl_FragCoord.xy + vec2(0.25, 0.25));
  c *= 0.25;
  vec3 col = uTone > 0.5 ? vec3(1.0 - c * 0.92) : vec3(c);
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

const TONES: Record<ChromeTone, { face: string; bezel: string }> = {
  dark: {
    // Face color shows until WebGL paints, and forever if it can't.
    face: "bg-neutral-950",
    bezel:
      "bg-[linear-gradient(180deg,#5a5a5a_0%,#1a1a1a_45%,#050505_55%,#3a3a3a_100%)]",
  },
  light: {
    face: "bg-neutral-50",
    bezel:
      "bg-[linear-gradient(180deg,#ffffff_0%,#d4d4d4_45%,#a3a3a3_55%,#f5f5f5_100%)]",
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
      tone = "dark",
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
        gl.uniform1f(uniforms.uTone, state.tone === "light" ? 1 : 0);
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
        state.time += dt * 2 * state.speed * (1 + hover * 0.5);
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
          tones.bezel,
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
            tones.face,
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
            className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.28),inset_0_-2px_4px_rgb(0_0_0/0.3),inset_0_0_0_1px_rgb(0_0_0/0.2)]"
          />
          <span
            className={cn(
              // White + difference inverts the label over every chrome band, on either tone.
              "relative text-sm font-semibold tracking-tight text-white mix-blend-difference transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] group-active/chrome:translate-y-px",
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
