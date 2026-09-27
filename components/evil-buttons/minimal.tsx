import * as React from "react";
import { cn } from "@/lib/utils";

export interface MinimalButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Show a trailing chevron that nudges forward on hover. */
  arrow?: boolean;
}

const MinimalButton = React.forwardRef<HTMLButtonElement, MinimalButtonProps>(
  ({ children, className, arrow = true, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "group/minimal inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium text-neutral-50 outline-none select-none",
        // Graded dark surface: dark outer hairline, faint inner ring, top highlight, soft drop.
        "bg-linear-to-b from-[#353535] to-[#272727] shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.25),0_4px_12px_-4px_rgb(0_0_0/0.4)]",
        "transition-[scale,filter,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] hover:brightness-110",
        // Press eases in fast and settles the shadow; release springs back on the slower base curve.
        "active:scale-[0.97] active:brightness-95 active:duration-100 active:ease-out active:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05),inset_0_1px_0_rgb(255_255_255/0.08),0_0_1px_rgb(0_0_0/0.2),0_1px_3px_-2px_rgb(0_0_0/0.3)] motion-reduce:active:scale-100",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        arrow && "pr-3",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {arrow ? (
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3.5 text-neutral-50/45 transition-[translate,color] duration-150 group-hover/minimal:translate-x-0.5 group-hover/minimal:text-neutral-50/75"
        >
          <path d="m6 4 4 4-4 4" />
        </svg>
      ) : null}
    </button>
  ),
);

MinimalButton.displayName = "MinimalButton";

export { MinimalButton };
export default MinimalButton;
