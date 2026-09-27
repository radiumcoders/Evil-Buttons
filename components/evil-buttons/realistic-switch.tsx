"use client"

import { useRef, useState, type CSSProperties } from "react"
import { motion, useReducedMotion, type Transition } from "motion/react"

import { cn } from "@/lib/utils"

type RealisticSwitchSize = "sm" | "default" | "lg"

type RealisticSwitchProps = {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  /** Rocker color. Any CSS color; the walls and shading are mixed from it. */
  color?: string
  /** Color of the printed O and I marks. */
  markColor?: string
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
  sm: 12,
  default: 16,
  lg: 20,
}

// The rocker is a real box: a front face pushed out by half its depth and four
// walls folded back from it. Tilting the box about its middle raises one half
// out of the housing and sinks the other.
const DEPTH = 0.7
const TILT = 16
// Each half of the face is dished back from the pivot by this much.
const DISH = 7

const SNAP: Transition = { type: "spring", stiffness: 700, damping: 26, mass: 0.6 }

const mix = (amount: number, toward: "white" | "black") =>
  `color-mix(in oklab, var(--rocker) ${amount}%, ${toward})`

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
  markColor = "rgb(255 255 255 / 0.92)",
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
  const pointerDown = useRef(false)
  const reduceMotion = useReducedMotion()

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

  const release = () => {
    pointerDown.current = false
    setPressing(false)
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
        if (e.button !== 0) return
        pointerDown.current = true
        setPressing(true)
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      style={{ fontSize: FONT_SIZE[size], "--rocker": color } as CSSProperties}
      className={cn(
        "group relative inline-flex cursor-pointer rounded-[0.5em] outline-none select-none [-webkit-tap-highlight-color:transparent]",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {/* Housing: a moulded black bezel with a lit top rim and a drop shadow. */}
      <span
        aria-hidden
        className="relative flex h-[4.25em] w-[3.25em] rounded-[0.5em] p-[0.28em] shadow-[0_0.1em_0.1em_rgb(0_0_0/0.3),0_0.45em_0.9em_-0.2em_rgb(0_0_0/0.55),inset_0_0.06em_0_rgb(255_255_255/0.22),inset_0_-0.06em_0_rgb(0_0_0/0.6)]"
        style={{ background: "linear-gradient(to bottom, #2b2b2e, #141416 55%, #0b0b0c)" }}
      >
        {/* Cavity the rocker sits in, seen slightly from above. */}
        <span
          className="relative flex-1 rounded-[0.3em] bg-[#050505] shadow-[inset_0_0.12em_0.2em_rgb(0_0_0/0.9),0_0.04em_0_rgb(255_255_255/0.08)]"
          style={{ perspective: "9em", perspectiveOrigin: "50% -40%" }}
        >
          {/* Light leaking around the rocker when it is lit. */}
          <span
            className="absolute inset-[0.05em] rounded-[0.3em] blur-[0.3em] transition-opacity duration-300"
            style={{ background: color, opacity: lit ? 0.55 : 0 }}
          />
          <motion.span
            className="absolute inset-[0.12em]"
            style={{ transformStyle: "preserve-3d" }}
            initial={false}
            animate={{ rotateX: angle }}
            transition={reduceMotion ? { duration: 0 } : SNAP}
          >
            <RockerBox lit={lit} checked={checked} markColor={markColor} />
          </motion.span>
        </span>
      </span>
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

  return (
    <span
      className={cn(
        "absolute inset-x-0 h-1/2 overflow-hidden [backface-visibility:hidden]",
        top ? "top-0 origin-bottom rounded-t-[0.2em]" : "bottom-0 origin-top rounded-b-[0.2em]"
      )}
      style={{
        transform: `rotateX(${top ? DISH : -DISH}deg)`,
        background: top
          ? `linear-gradient(to bottom, ${mix(80, "white")}, var(--rocker) 35%, ${mix(85, "black")})`
          : `linear-gradient(to bottom, ${mix(75, "black")}, var(--rocker) 45%, ${mix(82, "black")})`,
        boxShadow: top
          ? `inset 0 0.05em 0 ${mix(50, "white")}`
          : `inset 0 -0.05em 0 ${mix(50, "black")}`,
      }}
    >
      {/* Shade: the pushed-in half turns away from the light. */}
      <span
        className="absolute inset-0 bg-black transition-opacity duration-200"
        style={{ opacity: raised ? 0 : 0.28 }}
      />
      {/* Inner lamp: a warm bloom through the translucent rocker. */}
      <span
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: lit ? 1 : 0,
          background:
            "radial-gradient(ellipse 75% 70% at 50% 50%, rgb(255 235 215 / 0.38), rgb(255 190 160 / 0.12) 60%, transparent 90%)",
        }}
      />
      {top ? (
        <span
          className="absolute top-[38%] left-1/2 size-[0.62em] -translate-x-1/2 -translate-y-1/2 rounded-full border-[0.1em] drop-shadow-[0_0.03em_0_rgb(0_0_0/0.3)]"
          style={{ borderColor: markColor }}
        />
      ) : (
        <span
          className="absolute top-[58%] left-1/2 h-[0.62em] w-[0.1em] -translate-x-1/2 -translate-y-1/2 rounded-full drop-shadow-[0_0.03em_0_rgb(0_0_0/0.3)]"
          style={{ background: markColor }}
        />
      )}
    </span>
  )
}

type RockerBoxProps = {
  lit: boolean
  checked: boolean
  markColor: string
}

function RockerBox({ lit, checked, markColor }: RockerBoxProps) {
  const face = "absolute [backface-visibility:hidden]"
  const half = `${DEPTH / 2}em`

  return (
    <>
      {/* Top and bottom walls: folded back from the front's top and bottom edges. */}
      <span
        className={cn(face, "inset-x-0 top-0 origin-top rounded-t-[0.2em]")}
        style={{
          height: `${DEPTH}em`,
          transform: `translateZ(${half}) rotateX(-90deg)`,
          background: `linear-gradient(to bottom, ${mix(80, "white")}, ${mix(70, "black")})`,
        }}
      />
      <span
        className={cn(face, "inset-x-0 bottom-0 origin-bottom rounded-b-[0.2em]")}
        style={{
          height: `${DEPTH}em`,
          transform: `translateZ(${half}) rotateX(90deg)`,
          background: mix(45, "black"),
        }}
      />
      {/* Side walls, in shadow. */}
      <span
        className={cn(face, "inset-y-0 left-0 origin-left")}
        style={{
          width: `${DEPTH}em`,
          transform: `translateZ(${half}) rotateY(90deg)`,
          background: mix(55, "black"),
        }}
      />
      <span
        className={cn(face, "inset-y-0 right-0 origin-right")}
        style={{
          width: `${DEPTH}em`,
          transform: `translateZ(${half}) rotateY(-90deg)`,
          background: mix(50, "black"),
        }}
      />
      {/* Front: two halves dished back from the pivot. The raised half faces
          the light; the pushed-in half falls into shadow. */}
      <span
        className="absolute inset-0"
        style={{ transform: `translateZ(${half})`, transformStyle: "preserve-3d" }}
      >
        <RockerHalf side="top" raised={checked} lit={lit} markColor={markColor} />
        <RockerHalf side="bottom" raised={!checked} lit={lit} markColor={markColor} />
      </span>
    </>
  )
}

export { RealisticSwitch }
export type { RealisticSwitchProps, RealisticSwitchSize }
