"use client"

import { useEffect, useState, type CSSProperties } from "react"
import {
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react"

import { cn } from "@/lib/utils"

type RealisticSwitchSize = "sm" | "default" | "lg"
type RealisticSwitchTone = "auto" | "light" | "dark"

type RealisticSwitchProps = {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  /** Cap color. Any CSS color; its walls, shading, and glow are mixed from it. */
  color?: string
  /** Color of the power mark on the cap. */
  markColor?: string
  /** Socket finish: follow the theme, or force ceramic white or graphite. */
  tone?: RealisticSwitchTone
  /** Light the cap from inside while it is latched on. */
  illuminated?: boolean
  /** Play a short mechanical click when it latches or releases. */
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

// Geometry, in em. The cap is a box standing on its own walls inside a
// recessed socket; its height above the socket floor is the one thing that
// moves. Cap and walls slide together on the same transform, and the walls are
// clipped at the floor, so nothing is resized and nothing snaps to a pixel.
const SOCKET = 4.4
const CAP = 3.3
const GAP = (SOCKET - CAP) / 2

// Cap height in each state: up, dipped under hover, fully pressed, and
// latched down while on.
const HEIGHT = {
  up: 0.95,
  hover: 0.82,
  pressed: 0.1,
  latched: 0.34,
  latchedHover: 0.3,
}

// A touch of bounce, so a released cap settles like a spring without wobbling
// through the small hover dip.
const SPRING = { stiffness: 520, damping: 30, mass: 0.6 }

const TONES: Record<RealisticSwitchTone, string> = {
  light:
    "[--hi:#ffffff] [--mid:#efeff2] [--lo:#d9d9df] [--well:#c9c9d1] [--well-lo:#aeaeb8] [--floor:rgb(20_20_40/0.35)] [--spill:0.35]",
  dark: "[--hi:#3a3a40] [--mid:#26262b] [--lo:#18181b] [--well:#0d0d10] [--well-lo:#050506] [--floor:rgb(0_0_0/0.8)] [--spill:0.6]",
  auto: "[--hi:#ffffff] [--mid:#efeff2] [--lo:#d9d9df] [--well:#c9c9d1] [--well-lo:#aeaeb8] [--floor:rgb(20_20_40/0.35)] [--spill:0.35] dark:[--hi:#3a3a40] dark:[--mid:#26262b] dark:[--lo:#18181b] dark:[--well:#0d0d10] dark:[--well-lo:#050506] dark:[--floor:rgb(0_0_0/0.8)] dark:[--spill:0.6]",
}

const mix = (amount: number, toward: "white" | "black") =>
  `color-mix(in oklab, var(--cap) ${amount}%, ${toward})`

const em = (value: number) => `${value}em`

let audio: AudioContext | null = null

// A switch click is a very short, bright burst of noise. Latching is pitched a
// little higher than releasing, like a real push switch's two stops.
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
  markColor = "rgb(255 255 255 / 0.92)",
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
  const [hovering, setHovering] = useState(false)
  const reduceMotion = useReducedMotion()

  const target = pressing
    ? HEIGHT.pressed
    : checked
      ? hovering
        ? HEIGHT.latchedHover
        : HEIGHT.latched
      : hovering
        ? HEIGHT.hover
        : HEIGHT.up
  const height = useSpring(target, SPRING)

  useEffect(() => {
    if (reduceMotion) height.jump(target)
    else height.set(target)
  }, [height, target, reduceMotion])

  // The walls fill the space under the cap, and the cast shadow spreads and
  // fades as the cap rises away from the socket floor.
  const capLift = useTransform(height, (h) => em(-h))
  const shadowOpacity = useTransform(height, [0, HEIGHT.up], [0.35, 1])
  const shadowScale = useTransform(height, [0, HEIGHT.up], [0.92, 1.06])
  const shadowDrop = useTransform(height, (h) => em(0.05 + h * 0.35))

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
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setHovering(true)
      }}
      onPointerLeave={() => {
        setPressing(false)
        setHovering(false)
      }}
      onPointerCancel={() => setPressing(false)}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") setPressing(true)
      }}
      onKeyUp={() => setPressing(false)}
      onBlur={() => setPressing(false)}
      style={{ fontSize: FONT_SIZE[size], "--cap": color } as CSSProperties}
      className={cn(
        "group relative inline-flex cursor-pointer rounded-[1.1em] p-[0.5em] pt-[1.4em] outline-none select-none [-webkit-tap-highlight-color:transparent]",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        TONES[tone],
        className
      )}
    >
      <span
        aria-hidden
        className="relative block"
        style={{ width: em(SOCKET), height: em(SOCKET) }}
      >
        {/* Socket: a moulded plate with a lit top edge and a soft drop shadow. */}
        <span
          className="absolute -inset-[0.3em] rounded-[1.05em] shadow-[0_0.08em_0.1em_rgb(0_0_0/0.18),0_0.5em_1em_-0.3em_var(--floor),inset_0_0.05em_0_rgb(255_255_255/0.6),inset_0_-0.06em_0_rgb(0_0_0/0.18)]"
          style={{ background: "linear-gradient(to bottom, var(--hi), var(--mid) 50%, var(--lo))" }}
        />
        {/* The well the cap travels in: darker the deeper it goes. */}
        <span
          className="absolute inset-0 rounded-[0.85em] shadow-[inset_0_0.14em_0.3em_rgb(0_0_0/0.5),inset_0_-0.04em_0_rgb(255_255_255/0.25),0_0.04em_0_rgb(255_255_255/0.5)]"
          style={{ background: "linear-gradient(to bottom, var(--well-lo), var(--well))" }}
        />
        {/* Light from a latched cap pooling in the well. */}
        <span
          className="absolute inset-[0.15em] rounded-[0.75em] blur-[0.35em] transition-opacity duration-500"
          style={{ background: "var(--cap)", opacity: lit ? "var(--spill)" : 0 }}
        />
        {/* Shadow the cap casts on the well floor. */}
        <motion.span
          className="absolute rounded-[0.7em] bg-black/70 blur-[0.3em]"
          style={{
            inset: em(GAP),
            opacity: shadowOpacity,
            scale: shadowScale,
            y: shadowDrop,
          }}
        />
        {/* Walls: a block that rides up with the cap, cut off at the floor. */}
        <span
          className="absolute overflow-hidden rounded-b-[0.7em]"
          style={{ left: em(GAP), right: em(GAP), bottom: em(GAP), top: em(-HEIGHT.up) }}
        >
          <motion.span
            className="absolute inset-x-0 overflow-hidden rounded-[0.7em] will-change-transform"
            style={{
              // Starts level with the cap's top and reaches the floor even at full lift.
              top: em(GAP + HEIGHT.up),
              height: em(CAP + HEIGHT.up),
              y: capLift,
              background: `linear-gradient(to bottom, ${mix(62, "black")}, ${mix(40, "black")})`,
            }}
          >
            {/* Rounded corners turn away from the light at both sides. */}
            <span className="absolute inset-0 bg-[linear-gradient(to_right,rgb(0_0_0/0.35),transparent_18%,rgb(255_255_255/0.08)_50%,transparent_82%,rgb(0_0_0/0.35))]" />
          </motion.span>
        </span>
        {/* Cap: the top face, carried up by the walls. */}
        <motion.span
          className="absolute overflow-hidden rounded-[0.7em] will-change-transform"
          style={{
            left: em(GAP),
            top: em(GAP),
            width: em(CAP),
            height: em(CAP),
            y: capLift,
            background: `linear-gradient(to bottom, ${mix(80, "white")}, var(--cap) 45%, ${mix(86, "black")})`,
            boxShadow: `inset 0 0.06em 0 ${mix(45, "white")}, inset 0 -0.08em 0.05em ${mix(60, "black")}`,
          }}
        >
          {/* A shallow dish in the middle of the cap, lit from above. */}
          <span
            className="absolute inset-[0.34em] rounded-[0.5em]"
            style={{
              background: `linear-gradient(to bottom, ${mix(82, "black")}, ${mix(92, "white")})`,
              boxShadow: `inset 0 0.07em 0.12em ${mix(45, "black")}, 0 0.04em 0 ${mix(55, "white")}`,
            }}
          />
          {/* Inner lamp: the cap glows through when latched on. */}
          <span
            className="absolute inset-0 transition-opacity duration-500"
            style={{
              opacity: lit ? 1 : 0,
              background:
                "radial-gradient(circle at 50% 50%, rgb(255 240 225 / 0.55), rgb(255 200 170 / 0.18) 50%, transparent 80%)",
            }}
          />
          <svg
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth={2.4}
            strokeLinecap="round"
            className="absolute top-1/2 left-1/2 size-[1.25em] -translate-x-1/2 -translate-y-1/2 transition-[filter] duration-500"
            style={{
              stroke: markColor,
              filter: lit
                ? "drop-shadow(0 0 0.12em rgb(255 255 255 / 0.9))"
                : "drop-shadow(0 0.04em 0 rgb(0 0 0 / 0.35))",
            }}
          >
            <path d="M12 3v8" />
            <path d="M7.05 6.4a7 7 0 1 0 9.9 0" />
          </svg>
        </motion.span>
      </span>
    </button>
  )
}

export { RealisticSwitch }
export type { RealisticSwitchProps, RealisticSwitchSize, RealisticSwitchTone }
