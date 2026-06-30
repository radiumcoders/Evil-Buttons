"use client"

import { useState } from "react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

type RollingLabelProps = {
  label: string
}

function RollingLabel({ label }: RollingLabelProps) {
  return (
    <span className="grid h-5 overflow-hidden mask-[linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)] text-sm leading-5 [-webkit-mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]">
      <motion.span
        className="col-start-1 row-start-1 flex flex-col"
        variants={{
          rest: { y: "0%" },
          hover: { y: "-50%" },
        }}
        transition={{ duration: 0.35, ease: [0.33, 1, 0.68, 1], rotate: { duration: 0.35, ease: [0.33, 1, 0.68, 1] } }}
      >
        <span className="flex h-5 items-center justify-center">{label}</span>
        <span aria-hidden className="flex h-5 items-center justify-center">
          {label}
        </span>
      </motion.span>
    </span>
  )
}

type PillFaceProps = {
  label: string
  className?: string
}

function PillFace({ label, className }: PillFaceProps) {
  return (
    <motion.div
      className={cn(
        "flex h-10 w-full shrink-0 items-center justify-center uppercase",
        className
      )}
      initial="rest"
      animate="rest"
      whileHover="hover"
    >
      <RollingLabel label={label} />
    </motion.div>
  )
}

type PillButtonProps = {
  primaryLabel: string
  secondaryLabel: string
  primaryClassName?: string
  secondaryClassName?: string
  isOpen?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
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
  className,
  ariaLabel,
}: PillButtonProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isControlled = isOpenProp !== undefined
  const isOpen = isControlled ? isOpenProp : internalOpen

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setInternalOpen(next)
    }
    onOpenChange?.(next)
  }

  const toggle = () => setOpen(!isOpen)

  const resolvedAriaLabel =
    typeof ariaLabel === "function"
      ? ariaLabel(isOpen)
      : ariaLabel ?? (isOpen ? secondaryLabel : primaryLabel)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          toggle()
        }
      }}
      className={cn(
        "relative h-10 w-20 cursor-pointer overflow-hidden rounded-full",
        className
      )}
      aria-expanded={isOpen}
      aria-label={resolvedAriaLabel}
    >
      <motion.div
        className="flex flex-col"
        animate={{ y: isOpen ? "-50%" : "0%" }}
        transition={{ type: "spring", stiffness: 500, damping: 35 }}
      >
        <PillFace label={primaryLabel} className={primaryClassName} />
        <PillFace label={secondaryLabel} className={secondaryClassName} />
      </motion.div>
    </div>
  )
}

export { PillButton, PillFace, RollingLabel }
export type { PillButtonProps, PillFaceProps, RollingLabelProps }