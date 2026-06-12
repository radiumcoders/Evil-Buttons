"use client"
import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

// How long (ms) the user must hold before the horns fully grow out.
const HORN_GROW_DURATION = 2600

const HornSvg = ({ className }: { className?: string }) => {
  return (
    <svg width="109" height="25" viewBox="0 0 109 90" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M3.03185 86.9125L90.1135 84.1034C93.5217 83.9935 94.2609 78.7889 91.0479 77.6469C71.5795 70.7269 42.1955 58.6135 35.3203 46.5C29.2868 35.8695 28.041 22.1022 28.0728 12.3131C28.083 9.16839 23.7337 7.66104 22.0945 10.3448C16.177 20.0327 7.95496 35.0668 4.32007 49C-0.17992 66.2492 -0.180022 78.9989 0.10125 84.2962C0.182932 85.8345 1.49214 86.9622 3.03185 86.9125Z" fill="#DC2627" />
      <path d="M28.2443 51.71C28.9249 50.206 30.6856 49.5252 32.201 50.1801C33.7349 50.843 34.441 52.6238 33.7781 54.1577L22.4095 80.4645C21.2245 83.2066 20.632 84.5776 19.4766 85.3893C18.3212 86.201 16.8304 86.2935 13.849 86.4784L13.5 86.5C13.0313 86.5 12.7191 86.016 12.9123 85.5891L28.2443 51.71Z" fill="white" />
      <path d="M41.7587 71.8909C42.4484 70.2952 44.3011 69.5607 45.8969 70.2503C47.3828 70.8924 48.1395 72.5569 47.6464 74.0987L44.7401 83.186C44.2941 84.5804 43.0362 85.5567 41.5748 85.6427L38.443 85.827C37.1299 85.9042 36.2218 84.5358 36.8032 83.3558L41.7587 71.8909Z" fill="white" />
    </svg>
  )
}

type Ember = {
  id: number
  side: -1 | 1
  dx: number
  dy: number
  size: number
  duration: number
  color: string
}

const EMBER_COLORS = ["#DC2626", "#F97316", "#FACC15", "#FB923C"]

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const easeOut = (t: number) => 1 - (1 - t) * (1 - t)

// Blend from black to a hot blood-red as `amount` goes 0 -> 1.
const bloodColor = (amount: number) => {
  const r = Math.round(lerp(0, 220, amount))
  const g = Math.round(lerp(0, 38, amount))
  const b = Math.round(lerp(0, 38, amount))
  return `rgb(${r}, ${g}, ${b})`
}

export const DemonicButton = ({ label }: { label: string }) => {
  const [frame, setFrame] = useState({ p: 0, t: 0 })
  const [holding, setHolding] = useState(false)
  const [grown, setGrown] = useState(false)
  const [embers, setEmbers] = useState<Ember[]>([])

  const holdingRef = useRef(false)
  const progressRef = useRef(0)
  const grownRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef(0)
  const lastSpawnRef = useRef(0)
  const emberIdRef = useRef(0)

  const spawnEmbers = (count: number, power: number) => {
    setEmbers((prev) => {
      const next = [...prev]
      for (let i = 0; i < count; i++) {
        const side: -1 | 1 = Math.random() > 0.5 ? 1 : -1
        next.push({
          id: emberIdRef.current++,
          side,
          dx: side * (6 + Math.random() * 22 * power) + (Math.random() - 0.5) * 14,
          dy: -(18 + Math.random() * 46 * power),
          size: 3 + Math.random() * 4,
          duration: 0.5 + Math.random() * 0.45,
          color: EMBER_COLORS[(Math.random() * EMBER_COLORS.length) | 0],
        })
      }
      // Cap the pool so we never leak nodes.
      return next.slice(-48)
    })
  }

  const loop = (now: number) => {
    const last = lastTimeRef.current || now
    const dt = Math.min((now - last) / 1000, 0.05)
    lastTimeRef.current = now

    const dir = holdingRef.current ? 1 : -1
    let p = progressRef.current + (dir * dt) / (HORN_GROW_DURATION / 1000)
    p = Math.max(0, Math.min(1, p))
    progressRef.current = p

    // Climax: first frame we reach full charge, erupt with a burst.
    if (p >= 1 && !grownRef.current) {
      grownRef.current = true
      setGrown(true)
      spawnEmbers(26, 1.6)
    }
    if (p < 1 && grownRef.current) {
      grownRef.current = false
      setGrown(false)
    }

    // Stream embers from the horn tips while they are pushing out.
    if (holdingRef.current && p > 0.04 && p < 1 && now - lastSpawnRef.current > 55) {
      lastSpawnRef.current = now
      spawnEmbers(2, 0.4 + p)
    }

    setFrame({ p, t: now })

    if (p <= 0 && !holdingRef.current) {
      rafRef.current = null
      return
    }
    rafRef.current = requestAnimationFrame(loop)
  }

  const ensureLoop = () => {
    if (rafRef.current === null) {
      lastTimeRef.current = 0
      rafRef.current = requestAnimationFrame(loop)
    }
  }

  const startHold = () => {
    holdingRef.current = true
    setHolding(true)
    ensureLoop()
  }

  const stopHold = () => {
    holdingRef.current = false
    setHolding(false)
    ensureLoop()
  }

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const { p, t } = frame
  const charging = holding && p < 1

  // Trembling intensity ramps up as the horns strain to push out, and a
  // faint shiver lingers once the demon is fully awake.
  const intensity = charging ? 0.2 + p * 0.8 : grown ? 0.18 : 0
  const shakeX = (Math.sin(t * 0.07) + Math.sin(t * 0.123)) * 2.4 * intensity
  const shakeY = Math.cos(t * 0.111) * 1.8 * intensity

  // Heartbeat flash between the black base and red — faster and fuller as the
  // life meter fills, then a strong steady pulse once it's alive.
  const flashPulse = Math.sin(t * 0.006 * (1 + p * 4)) * 0.5 + 0.5
  const redAmount = grown
    ? 0.55 + flashPulse * 0.45
    : Math.min(1, p * 0.5 + flashPulse * p * 0.5)
  const bg = bloodColor(redAmount)
  const glow = redAmount * (grown ? 28 : 18)

  const hornY = lerp(14, -18, easeOut(p))
  const hornScale = lerp(0.6, 1.05, p)
  const hornRot = lerp(22, 0, easeOut(p)) + shakeX * 0.4

  return (
    <div className="relative w-fit select-none">
      {/* Ember / particle layer */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-visible">
        <AnimatePresence>
          {embers.map((e) => (
            <motion.span
              key={e.id}
              className="absolute rounded-full"
              style={{
                top: -8,
                ...(e.side === -1 ? { left: -4 } : { right: -4 }),
                width: e.size,
                height: e.size,
                backgroundColor: e.color,
                boxShadow: `0 0 6px ${e.color}`,
              }}
              initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              animate={{ opacity: 0, x: e.dx, y: e.dy, scale: 0.2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: e.duration, ease: "easeOut" }}
              onAnimationComplete={() =>
                setEmbers((prev) => prev.filter((x) => x.id !== e.id))
              }
            />
          ))}
        </AnimatePresence>
      </div>

      <motion.div
        className="absolute -left-5 bottom-[60%] z-0 h-auto w-10 origin-bottom"
        style={{ y: hornY, scaleX: hornScale, scaleY: hornScale, rotate: hornRot }}
      >
        <HornSvg />
      </motion.div>
      <motion.div
        className="absolute -right-5 bottom-[60%] z-0 h-auto w-10 origin-bottom"
        style={{ y: hornY, scaleX: -hornScale, scaleY: hornScale, rotate: -hornRot }}
      >
        <HornSvg />
      </motion.div>

      <motion.button
        type="button"
        className="relative z-10 min-w-30 rounded-xl px-6 py-2 font-medium text-white focus:outline-none"
        style={{
          x: shakeX,
          y: shakeY,
          backgroundColor: bg,
          boxShadow: glow > 0.5 ? `0 0 ${glow}px rgba(220, 38, 38, ${redAmount * 0.85})` : "none",
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 && e.pointerType === "mouse") return
          e.currentTarget.setPointerCapture?.(e.pointerId)
          startHold()
        }}
        onPointerUp={stopHold}
        onPointerCancel={stopHold}
        onLostPointerCapture={stopHold}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault()
            startHold()
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault()
            stopHold()
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {label}
      </motion.button>
    </div>
  )
}
