"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ChromeTone = "auto" | "dark" | "light";
export type ChromeSize = "default" | "sm" | "icon";

export interface ChromeButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Label used when no children are provided. */
  label?: React.ReactNode;
  /** Follow the theme (dark face under `.dark`), or force a dark or light face. */
  tone?: ChromeTone;
  /** Pill, compact pill, or a round icon-only button. */
  size?: ChromeSize;
  /** Speed multiplier for the liquid metal flowing around the border. */
  speed?: number;
  /** Ripple the metal around the pointer and send a wave through it on press. */
  interactive?: boolean;
}

const VERTEX = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

// Liquid metal: bands of polished chrome travel around the ring (by angle
// from the center), wobbled by stacked cosines so they slosh like liquid.
// Shaded as broad silver with dark troughs and thin hot highlights. The canvas
// fills the whole button, but only the border ring shows around the face.
const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform float uHover;
uniform vec3 uPress;
uniform float uTone;

float metal(vec2 px) {
  vec2 uv = (2.0 * px - uRes) / min(uRes.x, uRes.y);
  for (float i = 1.0; i < 8.0; i++) {
    uv.x += 0.22 / i * cos(i * 2.6 * uv.y + uTime);
    uv.y += 0.22 / i * cos(i * 1.9 * uv.x + uTime * 0.8);
  }

  // Interactions push band phase and contrast directly: nudging the warp, or
  // brightening already-bright metal, barely registers on a thin ring.
  float phase = 0.0;
  float shade = 0.0;

  // Pointer: tight dark and bright ripples swirl out from the cursor.
  vec2 d = (px - uPointer) / uRes.y;
  float dist = length(d);
  float near = exp(-dist * dist * 1.5) * uHover;
  float swirl = sin(dist * 14.0 - uTime * 7.0);
  phase += swirl * 2.2 * near;
  shade += swirl * 0.45 * near;

  // Press: a shock front runs out from the click, bright at its leading edge
  // with a dark trough behind it.
  float age = uTime - uPress.z;
  if (age > 0.0 && age < 2.0) {
    float r = length((px - uPress.xy) / uRes.y);
    float front = r - age * 4.0;
    float fade = exp(-age * 1.8);
    phase += exp(-front * front * 2.0) * fade * 5.0;
    shade += (exp(-front * front * 8.0) - exp(-(front + 0.45) * (front + 0.45) * 8.0)) * fade * 0.95;
  }

  // Normalized so a pill's ends and sides share one angular speed.
  vec2 q = (2.0 * px - uRes) / uRes;
  float angle = atan(q.y, q.x);
  float s = sin(angle * 3.0 - uTime * 2.2 + (uv.x + uv.y) * 1.1 + phase);
  float m = 0.5 + 0.5 * s;
  float c = 0.3 + 0.7 * smoothstep(0.0, 0.75, m);
  c += 0.55 * min(0.035 / abs(s - 0.35), 1.0);
  c -= 0.35 * min(0.02 / abs(s + 0.6), 1.0);
  return clamp(c + shade, 0.0, 1.0);
}

void main() {
  float c = 0.0;
  c += metal(gl_FragCoord.xy + vec2(-0.25, -0.25));
  c += metal(gl_FragCoord.xy + vec2(0.25, -0.25));
  c += metal(gl_FragCoord.xy + vec2(-0.25, 0.25));
  c += metal(gl_FragCoord.xy + vec2(0.25, 0.25));
  c *= 0.25;
  // Slightly cool lights and warm shadows read as steel rather than grey.
  vec3 col = mix(vec3(0.09, 0.085, 0.08), vec3(1.0, 1.0, 1.02), c);
  // On a white face the ring sits a little darker so it still frames the button.
  col *= uTone > 0.5 ? 0.9 : 1.0;
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

const DARK = {
  shell:
    "shadow-[0_0_0_1px_rgb(0_0_0/0.7),0_2px_4px_rgb(0_0_0/0.5),0_8px_20px_-8px_rgb(0_0_0/0.7)]",
  face:
    "bg-[linear-gradient(180deg,#1d1d1d_0%,#111111_60%,#0d0d0d_100%)] text-neutral-50 shadow-[inset_0_1px_3px_rgb(0_0_0/0.9),inset_0_-1px_0_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.55)]",
};

const LIGHT = {
  shell:
    "shadow-[0_0_0_1px_rgb(0_0_0/0.18),0_2px_4px_rgb(0_0_0/0.12),0_10px_24px_-8px_rgb(0_0_0/0.3)]",
  face:
    "bg-[linear-gradient(180deg,#ffffff_0%,#fafafa_60%,#f0f0f0_100%)] text-neutral-900 shadow-[inset_0_1px_3px_rgb(0_0_0/0.28),inset_0_-1px_0_rgb(255_255_255/0.9),0_0_0_1px_rgb(0_0_0/0.25)]",
};

const TONES: Record<ChromeTone, { shell: string; face: string }> = {
  // Light by default, dark inside a `.dark` ancestor, like shadcn's theming.
  // Written out in full so Tailwind can see every dark: class.
  auto: {
    shell: `${LIGHT.shell} dark:shadow-[0_0_0_1px_rgb(0_0_0/0.7),0_2px_4px_rgb(0_0_0/0.5),0_8px_20px_-8px_rgb(0_0_0/0.7)]`,
    face: `${LIGHT.face} dark:bg-[linear-gradient(180deg,#1d1d1d_0%,#111111_60%,#0d0d0d_100%)] dark:text-neutral-50 dark:shadow-[inset_0_1px_3px_rgb(0_0_0/0.9),inset_0_-1px_0_rgb(255_255_255/0.05),0_0_0_1px_rgb(0_0_0/0.55)]`,
  },
  dark: DARK,
  light: LIGHT,
};

const SIZES: Record<ChromeSize, { shell: string; face: string }> = {
  default: {
    shell: "h-11 p-[3px]",
    face: "gap-2.5 px-5 text-[15px] [&_svg]:size-4",
  },
  sm: {
    shell: "h-9 p-[2.5px]",
    face: "gap-2 px-3.5 text-[13px] [&_svg]:size-3.5",
  },
  icon: {
    shell: "size-9 p-[2.5px]",
    face: "aspect-square justify-center [&_svg]:size-4",
  },
};

export const ChromeButton = React.forwardRef<
  HTMLButtonElement,
  ChromeButtonProps
>(
  (
    {
      children,
      label = "Continue",
      tone = "auto",
      size = "default",
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
    const shellRef = React.useRef<HTMLButtonElement | null>(null);
    const hostRef = React.useRef<HTMLSpanElement | null>(null);
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

    const setShellRef = (node: HTMLButtonElement | null) => {
      shellRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    React.useEffect(() => {
      const host = hostRef.current;
      const shell = shellRef.current;
      if (!host || !shell) return;
      // A fresh canvas per run: once a context is lost (as cleanup does), the
      // same canvas only ever hands back that dead context, which froze the
      // metal after Strict Mode's mount, unmount, mount in development.
      const canvas = document.createElement("canvas");
      canvas.style.cssText = "display:block;width:100%;height:100%";
      const chrome = createChromeGL(canvas);
      if (!chrome) return;
      host.appendChild(canvas);
      canvasRef.current = canvas;
      const { gl, uniforms } = chrome;
      const state = input.current;
      // Reduced motion slows the flow to a gentle drift instead of freezing it.
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
        gl.uniform1f(uniforms.uHover, hover);
        gl.uniform3f(uniforms.uPress, ...state.press);
        const light =
          state.tone === "auto" ? !shell.closest(".dark") : state.tone === "light";
        gl.uniform1f(uniforms.uTone, light ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (first) {
          first = false;
          setPainted(true);
        }
      };

      const frame = (now: number) => {
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
        last = now;
        const target = state.interactive ? state.hoverTarget : 0;
        hover += (target - hover) * Math.min(1, dt * 8);
        state.time += dt * state.speed * (reduceMotion ? 0.2 : 1) * (1 + hover * 1.2);
        draw();
        raf = requestAnimationFrame(frame);
      };

      const start = () => {
        if (raf || !visible || document.hidden) return;
        last = 0;
        raf = requestAnimationFrame(frame);
      };
      const stop = () => {
        cancelAnimationFrame(raf);
        raf = 0;
      };

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.round(shell.clientWidth * dpr));
        canvas.height = Math.max(1, Math.round(shell.clientHeight * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
        draw();
      };

      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(shell);
      // Only animate while on screen.
      const intersection = new IntersectionObserver(([entry]) => {
        visible = !!entry?.isIntersecting;
        if (visible) start();
        else stop();
      });
      intersection.observe(shell);
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
        canvas.remove();
        if (canvasRef.current === canvas) canvasRef.current = null;
        setPainted(false);
      };
    }, []);

    /** Pointer position in canvas pixels, y up, as the shader expects. */
    const toCanvas = (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      const shell = shellRef.current;
      if (!canvas || !shell) return [0, 0] as [number, number];
      const rect = shell.getBoundingClientRect();
      return [
        (clientX - rect.left) * (canvas.width / rect.width),
        (rect.bottom - clientY) * (canvas.height / rect.height),
      ] as [number, number];
    };

    const wave = (at: [number, number]) => {
      input.current.press = [at[0], at[1], input.current.time];
    };

    const tones = TONES[tone];
    const sizes = SIZES[size];

    return (
      <button
        ref={setShellRef}
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
          if (interactive) wave(toCanvas(event.clientX, event.clientY));
        }}
        onClick={(event) => {
          onClick?.(event);
          // Keyboard activation has no pointer: send the wave from the center.
          const canvas = canvasRef.current;
          if (interactive && event.detail === 0 && canvas) {
            wave([canvas.width / 2, canvas.height / 2]);
          }
        }}
        className={cn(
          "group/chrome relative isolate inline-flex shrink-0 cursor-pointer overflow-hidden rounded-full font-medium tracking-tight outline-none select-none",
          // Static silver shows until the liquid metal paints, and stays if WebGL can't.
          "bg-[linear-gradient(135deg,#f4f4f5_0%,#8a8a8f_28%,#fafafa_48%,#4a4a4f_72%,#d9d9dc_100%)]",
          tones.shell,
          sizes.shell,
          "transition-[scale,filter] duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] hover:brightness-110",
          "active:scale-[0.96] active:duration-100 active:ease-out motion-reduce:active:scale-100",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:grayscale",
          className,
        )}
        {...props}
      >
        <span
          ref={hostRef}
          aria-hidden
          className={cn(
            "absolute inset-0 -z-10 transition-opacity duration-500",
            painted ? "opacity-100" : "opacity-0",
          )}
        />
        {/* Tube shading on the ring: a lit top lip and a shadowed underside. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.55),inset_0_-1px_1px_rgb(0_0_0/0.45)]"
        />
        <span
          className={cn(
            "relative flex h-full items-center rounded-full whitespace-nowrap",
            tones.face,
            sizes.face,
          )}
        >
          {children ?? label}
        </span>
      </button>
    );
  },
);

ChromeButton.displayName = "ChromeButton";

export default ChromeButton;
