import { motion, useSpring, useTransform } from "motion/react"
import type { MotionValue } from "motion/react"
import { cn } from "@/lib/utils"

const INDICATOR_WIDTH = 4
const INDICATOR_HEIGHT = 4
const DEFAULT_BAR_COUNT = 51
const DEFAULT_MAJOR_EVERY = 5

type ScrollBarsBaseProps = {
  scrollYProgress: MotionValue<number>
  rounded?: boolean
  accentClassName?: string
  className?: string
  barClassName?: string
  indicatorClassName?: string
  barCount?: number
  majorEvery?: number
}

export function ScrollBars({
  scrollYProgress,
  rounded = false,
  accentClassName,
  className,
  barClassName,
  indicatorClassName,
  barCount = DEFAULT_BAR_COUNT,
  majorEvery = DEFAULT_MAJOR_EVERY,
}: ScrollBarsBaseProps) {
  const bars = new Array(barCount).fill(0).map((_, i) => i)
  const indicatorWidth = INDICATOR_WIDTH
  const rawX = useTransform(scrollYProgress, [0, 1], [0, 251 - indicatorWidth])
  const x = useSpring(rawX, { stiffness: 200, damping: 20 })

  return (
    <div>
      <motion.div
        className={cn(
          "relative flex items-center justify-center gap-1 border-2 border-border bg-background p-4",
          rounded ? "rounded-3xl" : "rounded-none",
          className
        )}
      >
        <motion.div
          className={cn(
            "absolute left-4 w-1 rounded-full bg-accent-foreground",
            accentClassName,
            indicatorClassName
          )}
          initial={{ height: "0px" }}
          animate={{ height: "40px" }}
          style={{ x }}
          transition={{
            type: "spring",
            damping: 12,
            stiffness: 120,
          }}
        />
        {bars.map((bar, idx) => (
          <Bar
            key={`bar-${bar.toString()}`}
            isLarger={idx % majorEvery === 0}
            className={barClassName}
          />
        ))}
      </motion.div>
    </div>
  )
}

function Bar({ isLarger, className }: { isLarger: boolean; className?: string }) {
  return (
    <motion.div
      layout
      initial={{ height: "0px" }}
      animate={{ height: isLarger ? "36px" : "24px" }}
      transition={{
        type: "spring",
        damping: 12,
        stiffness: 120,
      }}
      className={cn("w-px bg-primary", isLarger ? "h-9" : "h-6", className)}
    />
  )
}

export function ScrollBarsVertical({
  scrollYProgress,
  rounded = false,
  accentClassName,
  className,
  barClassName,
  indicatorClassName,
  barCount = DEFAULT_BAR_COUNT,
  majorEvery = DEFAULT_MAJOR_EVERY,
}: ScrollBarsBaseProps) {
  const bars = new Array(barCount).fill(0).map((_, i) => i)
  const indicatorHeight = INDICATOR_HEIGHT
  const rawY = useTransform(scrollYProgress, [0, 1], [0, 251 - indicatorHeight])
  const y = useSpring(rawY, { stiffness: 200, damping: 20 })

  return (
    <div>
      <motion.div
        className={cn(
          "relative flex flex-col items-center justify-center gap-1 border-2 border-border bg-background p-4",
          rounded ? "rounded-3xl" : "rounded-none",
          className
        )}
      >
        <motion.div
          className={cn(
            "absolute top-4 h-1 rounded-full bg-accent-foreground",
            accentClassName,
            indicatorClassName
          )}
          initial={{ width: "0px" }}
          animate={{ width: "40px" }}
          style={{ y }}
          transition={{
            type: "spring",
            damping: 12,
            stiffness: 120,
          }}
        />
        {bars.map((bar, idx) => (
          <BarHorizontal
            key={`bar-h-${bar.toString()}`}
            isLarger={idx % majorEvery === 0}
            className={barClassName}
          />
        ))}
      </motion.div>
    </div>
  )
}

function BarHorizontal({
  isLarger,
  className,
}: {
  isLarger: boolean
  className?: string
}) {
  return (
    <motion.div
      layout
      initial={{ width: "0px" }}
      animate={{ width: isLarger ? "36px" : "24px" }}
      transition={{
        type: "spring",
        damping: 12,
        stiffness: 120,
      }}
      className={cn("h-px bg-primary", isLarger ? "w-9" : "w-6", className)}
    />
  )
}
