"use client"

import { useState } from "react"
import { motion, type Transition } from "motion/react"

import { cn } from "@/lib/utils"

const ROLL: Transition = { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
const FLIP: Transition = { type: "spring", stiffness: 420, damping: 30, mass: 0.9 }

type RollingLabelProps = {
  label: string
  /** Delay between letters, in seconds. */
  stagger?: number
  className?: string
}

/**
 * Each letter sits in its own masked slot with a copy stacked beneath it. On
 * the parent's "hover" variant the letters roll up one after another, so the
 * word ripples left to right instead of sliding as a block.
 */
function RollingLabel({ label, stagger = 0.022, className }: RollingLabelProps) {
  const letters = Array.from(label)

  return (
    <span className={cn("relative inline-flex", className)}>
      <span className="sr-only">{label}</span>
      <span aria-hidden className="flex h-[1.25em] overflow-hidden leading-[1.25em]">
        {letters.map((letter, i) => {
          const glyph = letter === " " ? " " : letter
          return (
            <motion.span
              key={i}
              className="flex flex-col"
              variants={{ rest: { y: "0%" }, hover: { y: "-50%" } }}
              transition={{ ...ROLL, delay: i * stagger }}
            >
              <span>{glyph}</span>
              <span>{glyph}</span>
            </motion.span>
          )
        })}
      </span>
    </span>
  )
}

type PillFaceProps = {
  label: string
  /** Lights the status dot. */
  active?: boolean
  className?: string
}

function PillFace({ label, active = false, className }: PillFaceProps) {
  return (
    <span
      className={cn(
        "flex h-full w-full shrink-0 items-center justify-center gap-[0.6em] pr-[1.07em] pl-[1.15em] font-medium tracking-[0.08em] uppercase",
        className
      )}
    >
      <span aria-hidden className="relative flex size-[0.45em] shrink-0">
        {active && (
          <motion.span
            key="ping"
            className="absolute inset-0 rounded-full bg-emerald-400"
            initial={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: 3.2, opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.08 }}
          />
        )}
        <span
          className={cn(
            "relative size-full rounded-full transition-[background-color,box-shadow] duration-300",
            active
              ? "bg-emerald-400 shadow-[0_0_6px_1px_var(--color-emerald-400)]"
              : "bg-current opacity-35"
          )}
        />
      </span>
      <RollingLabel label={label} />
    </span>
  )
}

type PillSize = "sm" | "default" | "lg"

const SIZES: Record<PillSize, string> = {
  sm: "h-8 text-xs",
  default: "h-10 text-sm",
  lg: "h-12 text-base",
}

type PillButtonProps = {
  primaryLabel: string
  secondaryLabel: string
  /** Classes for the off face. Defaults to a muted, theme-aware surface. */
  primaryClassName?: string
  /** Classes for the on face. Defaults to the theme's primary color. */
  secondaryClassName?: string
  isOpen?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  size?: PillSize
  disabled?: boolean
  className?: string
  ariaLabel?: string | ((isOpen: boolean) => string)
}

function PillButton({
  primaryLabel,
  secondaryLabel,
  primaryClassName,
  secondaryClassName,
  isOpen: isOpenProp,
  defaultOpen = false,
  onOpenChange,
  size = "default",
  disabled = false,
  className,
  ariaLabel,
}: PillButtonProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isControlled = isOpenProp !== undefined
  const isOpen = isControlled ? isOpenProp : internalOpen

  const toggle = () => {
    const next = !isOpen
    if (!isControlled) {
      setInternalOpen(next)
    }
    onOpenChange?.(next)
  }

  const resolvedAriaLabel =
    typeof ariaLabel === "function" ? ariaLabel(isOpen) : ariaLabel

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={isOpen}
      aria-label={resolvedAriaLabel}
      disabled={disabled}
      onClick={toggle}
      initial="rest"
      animate="rest"
      whileHover={disabled ? undefined : "hover"}
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={{ type: "spring", stiffness: 600, damping: 30 }}
      className={cn(
        "group relative inline-flex cursor-pointer overflow-hidden rounded-full shadow-sm ring-1 ring-foreground/10 outline-none select-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        SIZES[size],
        className
      )}
    >
      <motion.span
        className="flex w-full flex-col"
        style={{ height: "200%" }}
        animate={{ y: isOpen ? "-50%" : "0%" }}
        transition={FLIP}
      >
        <span aria-hidden={isOpen} className="flex h-1/2">
          <PillFace
            label={primaryLabel}
            className={cn("bg-muted text-muted-foreground", primaryClassName)}
          />
        </span>
        <span aria-hidden={!isOpen} className="flex h-1/2">
          <PillFace
            label={secondaryLabel}
            active={isOpen}
            className={cn("bg-primary text-primary-foreground", secondaryClassName)}
          />
        </span>
      </motion.span>
      {/* Bevel: a lit top edge and a shaded bottom edge over both faces. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.18),inset_0_-1px_0_rgb(0_0_0/0.18)]"
      />
    </motion.button>
  )
}

export { PillButton, PillFace, RollingLabel }
export type { PillButtonProps, PillFaceProps, PillSize, RollingLabelProps }
