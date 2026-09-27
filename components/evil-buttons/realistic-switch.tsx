"use client"

import { useState, type CSSProperties, type PointerEvent } from "react"
import {
  motion,
  useReducedMotion,
  useSpring,
  type Transition,
} from "motion/react"

import { cn } from "@/lib/utils"

type RealisticSwitchSize = "sm" | "default" | "lg"
type RealisticSwitchTone = "auto" | "light" | "dark"

type RealisticSwitchProps = {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  /** Rocker color. Any CSS color; its walls, shading, and glow are mixed from it. */
  color?: string
  /** Color of the printed O and I marks. */
  markColor?: string
  /** Housing finish: follow the theme, or force ceramic white or graphite. */
  tone?: RealisticSwitchTone
  /** Light the rocker from inside while it is on. */
  illuminated?: boolean
  /** Play a short mechanical click when it flips. */
  sound?: boolean
  size?: RealisticSwitchSize
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

// Everything is sized in em, so one font size scales the whole switch.
const FONT_SIZE: Record<RealisticSwitchSize, number> = {
  sm: 11,
  default: 15,
  lg: 19,
}

// Housing, in em. The whole switch is painted onto one flat layer and that
// layer is tilted in 3D: a single surface can't show seams between faces the
// way a stack of 3D planes does. The housing's sides are offset copies of its
// own outline, painted in one pass as a box-shadow, so they stay smooth.
const WIDTH = 3.4
const HEIGHT = 4.4
const RIM = 0.44
const BODY_X = 0.3
const BODY_Y = 0.46
const BODY_STEPS = 18

const BODY = Array.from({ length: BODY_STEPS }, (_, i) => {
  const t = (i + 1) / BODY_STEPS
  const x = (BODY_X * t).toFixed(3)
  const y = (BODY_Y * t).toFixed(3)
  const shade = Math.round(100 - t * 100)
  return `${x}em ${y}em 0 color-mix(in oklab, var(--side-hi) ${shade}%, var(--side-lo))`
}).join(", ")

// Rocker, in em and degrees. Its face is two halves dished back from the pivot;
// tilting it raises one half out of the housing and sinks the other. Only four
// panels, each overlapping its neighbour a hair so no gap can open between them.
const ROCKER_DEPTH = 0.55
const TILT = 12
const DISH = 5
const OVERLAP = 0.02

// Resting three-quarter view, plus how far it leans toward the pointer.
const VIEW_X = 22
const VIEW_Y = -24
const LEAN = 7

const FLIP: Transition = { type: "spring", stiffness: 520, damping: 32, mass: 0.7 }
const VIEW = { stiffness: 140, damping: 20, mass: 0.8 }

const TONES: Record<RealisticSwitchTone, string> = {
  light:
    "[--hi:#ffffff] [--mid:#ececef] [--lo:#d4d4da] [--side-hi:#d9d9df] [--side-lo:#a9a9b2] [--cavity:#232327] [--floor:rgb(24_24_40/0.28)] [--spill:0.12]",
  dark: "[--hi:#3b3b41] [--mid:#232327] [--lo:#141417] [--side-hi:#1b1b1f] [--side-lo:#070708] [--cavity:#040405] [--floor:rgb(0_0_0/0.7)] [--spill:0.32]",
  auto: "[--hi:#ffffff] [--mid:#ececef] [--lo:#d4d4da] [--side-hi:#d9d9df] [--side-lo:#a9a9b2] [--cavity:#232327] [--floor:rgb(24_24_40/0.28)] [--spill:0.12] dark:[--hi:#3b3b41] dark:[--mid:#232327] dark:[--lo:#141417] dark:[--side-hi:#1b1b1f] dark:[--side-lo:#070708] dark:[--cavity:#040405] dark:[--floor:rgb(0_0_0/0.7)] dark:[--spill:0.32]",
}

const mix = (amount: number, toward: "white" | "black") =>
  `color-mix(in oklab, var(--rocker) ${amount}%, ${toward})`

const em = (value: number) => `${value}em`

let audio: AudioContext | null = null

// A switch click is a very short, bright burst of noise. The "on" throw is
// pitched a little higher than the "off" one, like a real rocker's two stops.
function playClick(on: boolean) {
  try {
    audio ??= new AudioContext()
    const length = Math.floor(audio.sampleRate * 0.03)
    const buffer = audio.createBuffer(1, length, audio.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 6
    }
    const source = audio.createBufferSource()
    source.buffer = buffer
    const filter = audio.createBiquadFilter()
    filter.type = "bandpass"
    filter.frequency.value = on ? 3400 : 2500
    filter.Q.value = 1.1
    const gain = audio.createGain()
    gain.gain.value = 0.7
    source.connect(filter).connect(gain).connect(audio.destination)
    source.start()
  } catch {
    // No audio available: the switch still works silently.
  }
}

function RealisticSwitch({
  checked: checkedProp,
  defaultChecked = false,
  onCheckedChange,
  color = "#e1261c",
  markColor = "rgb(255 255 255 / 0.94)",
  tone = "auto",
  illuminated = true,
  sound = false,
  size = "default",
  disabled = false,
  className,
  "aria-label": ariaLabel = "Power",
}: RealisticSwitchProps) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked)
  const isControlled = checkedProp !== undefined
  const checked = isControlled ? checkedProp : internalChecked
  const [pressing, setPressing] = useState(false)
  const reduceMotion = useReducedMotion()
  const viewX = useSpring(VIEW_X, VIEW)
  const viewY = useSpring(VIEW_Y, VIEW)

  const toggle = () => {
    const next = !checked
    if (!isControlled) {
      setInternalChecked(next)
    }
    onCheckedChange?.(next)
    if (sound) {
      playClick(next)
    }
  }

  const lean = (e: PointerEvent<HTMLButtonElement>) => {
    if (reduceMotion || e.pointerType !== "mouse") return
    const box = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - box.left) / box.width - 0.5
    const y = (e.clientY - box.top) / box.height - 0.5
    viewX.set(VIEW_X - y * LEAN * 2)
    viewY.set(VIEW_Y + x * LEAN * 2)
  }

  const settle = () => {
    setPressing(false)
    viewX.set(VIEW_X)
    viewY.set(VIEW_Y)
  }

  // On: the I (bottom) half is pushed in, so the O half rises toward you.
  // While the pointer is down the rocker rocks to center, then snaps over.
  const angle = pressing ? 0 : checked ? TILT : -TILT
  const lit = illuminated && checked

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={toggle}
      onPointerDown={(e) => {
        if (e.button === 0) setPressing(true)
      }}
      onPointerUp={() => setPressing(false)}
      onPointerMove={lean}
      onPointerLeave={settle}
      onPointerCancel={settle}
      style={
        {
          fontSize: FONT_SIZE[size],
          "--rocker": color,
          perspective: "22em",
        } as CSSProperties
      }
      className={cn(
        "group relative inline-flex cursor-pointer rounded-[1em] p-[0.9em] outline-none select-none [-webkit-tap-highlight-color:transparent]",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        TONES[tone],
        className
      )}
    >
      <motion.span
        aria-hidden
        className="relative block"
        style={{
          width: em(WIDTH),
          height: em(HEIGHT),
          rotateX: viewX,
          rotateY: viewY,
        }}
      >
        {/* Contact shadow, then the lit rocker's color spilling onto the surface. */}
        <span
          className="absolute inset-[0.3em] rounded-[0.8em] blur-[0.5em]"
          style={{ background: "var(--floor)", translate: "0.55em 0.85em" }}
        />
        <span
          className="absolute -inset-[0.5em] rounded-[1.4em] blur-[0.9em] transition-opacity duration-500"
          style={{
            background: "var(--rocker)",
            opacity: lit ? "var(--spill)" : 0,
            translate: "0.2em 0.35em",
          }}
        />
        {/* Housing: the body underneath, then the bezel face on top of it. */}
        <span
          className="absolute inset-0 rounded-[0.62em]"
          style={{
            background: "linear-gradient(165deg, var(--hi), var(--mid) 45%, var(--lo))",
            boxShadow: `inset 0 0.05em 0 rgb(255 255 255 / 0.55), inset 0 -0.05em 0 rgb(0 0 0 / 0.14), ${BODY}`,
          }}
        />
        {/* The hole the rocker sits in. */}
        <span
          className="absolute overflow-hidden rounded-[0.36em] shadow-[inset_0_0.1em_0.18em_rgb(0_0_0/0.85),0_0.03em_0_rgb(255_255_255/0.35)]"
          style={{
            inset: em(RIM),
            background: "var(--cavity)",
            perspective: "10em",
            perspectiveOrigin: "50% -30%",
          }}
        >
          {/* Light leaking around the rocker's edges. */}
          <span
            className="absolute inset-0 transition-opacity duration-500"
            style={{
              opacity: lit ? 1 : 0,
              background: `radial-gradient(ellipse 70% 60% at 50% 50%, var(--rocker), ${mix(40, "black")} 70%, transparent)`,
            }}
          />
          <motion.span
            className="absolute inset-[0.09em]"
            style={{ transformStyle: "preserve-3d" }}
            initial={false}
            animate={{ rotateX: angle }}
            transition={reduceMotion ? { duration: 0 } : FLIP}
          >
            <RockerHalf side="top" raised={checked} lit={lit} markColor={markColor} />
            <RockerHalf side="bottom" raised={!checked} lit={lit} markColor={markColor} />
          </motion.span>
        </span>
      </motion.span>
    </button>
  )
}

type RockerHalfProps = {
  side: "top" | "bottom"
  raised: boolean
  lit: boolean
  markColor: string
}

function RockerHalf({ side, raised, lit, markColor }: RockerHalfProps) {
  const top = side === "top"
  const front = em(ROCKER_DEPTH / 2)

  return (
    <span
      className={cn("absolute inset-x-0", top ? "top-0 origin-bottom" : "bottom-0 origin-top")}
      style={{
        // Each half runs a hair past the pivot so the two faces overlap.
        height: `calc(50% + ${em(OVERLAP)})`,
        transformStyle: "preserve-3d",
        transform: `translateZ(${front}) rotateX(${top ? DISH : -DISH}deg)`,
      }}
    >
      {/* End wall, folded back from the outer edge. Seen from above, the top
          one catches the light when the O half is raised. */}
      <span
        className={cn(
          "absolute inset-x-0 [backface-visibility:hidden]",
          top ? "top-0 origin-top rounded-t-[0.2em]" : "bottom-0 origin-bottom rounded-b-[0.2em]"
        )}
        style={{
          height: `calc(${em(ROCKER_DEPTH)} + ${em(OVERLAP)})`,
          translate: `0 ${top ? em(-OVERLAP) : em(OVERLAP)}`,
          transform: `rotateX(${top ? -90 : 90}deg)`,
          background: top
            ? `linear-gradient(to bottom, ${mix(72, "white")}, ${mix(80, "black")})`
            : mix(45, "black"),
        }}
      />
      <span
        className={cn(
          "absolute inset-0 overflow-hidden",
          top ? "rounded-t-[0.24em]" : "rounded-b-[0.24em]"
        )}
        style={{
          background: top
            ? `linear-gradient(to bottom, ${mix(78, "white")}, var(--rocker) 40%, ${mix(90, "black")})`
            : `linear-gradient(to bottom, ${mix(86, "black")}, var(--rocker) 50%, ${mix(84, "black")})`,
          boxShadow: top
            ? `inset 0 0.04em 0 ${mix(45, "white")}`
            : `inset 0 -0.04em 0 ${mix(55, "black")}`,
        }}
      >
        {/* Sheen along the raised half, as if lit from above. */}
        <span
          className="absolute inset-x-0 top-0 h-3/5 bg-linear-to-b from-white/22 to-transparent transition-opacity duration-300"
          style={{ opacity: raised ? 1 : 0 }}
        />
        {/* Shade: the pushed-in half turns away from the light. */}
        <span
          className="absolute inset-0 bg-black transition-opacity duration-300"
          style={{ opacity: raised ? 0 : 0.26 }}
        />
        {/* Inner lamp: a warm bloom through the translucent rocker. */}
        <span
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            opacity: lit ? 1 : 0,
            background:
              "radial-gradient(ellipse 75% 70% at 50% 50%, rgb(255 235 215 / 0.36), rgb(255 190 160 / 0.1) 60%, transparent 90%)",
          }}
        />
        {top ? (
          <span
            className="absolute top-[42%] left-1/2 size-[0.6em] -translate-x-1/2 -translate-y-1/2 rounded-full border-[0.095em]"
            style={{ borderColor: markColor }}
          />
        ) : (
          <span
            className="absolute top-[56%] left-1/2 h-[0.6em] w-[0.095em] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: markColor }}
          />
        )}
      </span>
    </span>
  )
}

export { RealisticSwitch }
export type { RealisticSwitchProps, RealisticSwitchSize, RealisticSwitchTone }
