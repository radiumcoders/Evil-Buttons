import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";

function TracwellLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden className={className}>
      <g transform="translate(0 7)">
        <path
          d="M12 75c-5 0-8-5-5-10l19-35c3-6 10-8 16-5s8 10 5 16L29 72c-1 2-4 3-7 3H12Z"
          fill="#8CB4FF"
        />
        <path
          d="M43 75c-5 0-8-5-5-10L67 12c3-6 10-8 16-5s8 10 5 16L60 72c-1 2-4 3-7 3H43Z"
          fill="#357DFF"
        />
        <circle cx="82" cy="67" r="9" fill="#174EA6" />
      </g>
    </svg>
  );
}

/** "Analytics by Tracwell" credit on a soft wash of Tracwell's brand blue. */
export function TracwellCard() {
  return (
    <a
      href="https://tracwell.app/?utm_source=evilbuttons&utm_medium=referral&utm_campaign=powered_by"
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2 rounded-lg border border-border bg-linear-to-br from-[#357dff]/10 via-[#8b95f9]/5 to-transparent px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:border-[#357dff]/30 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:from-[#357dff]/15 dark:via-[#8b95f9]/8"
    >
      <TracwellLogo className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1">
        Analytics by{" "}
        <span className="font-medium text-foreground">Tracwell</span>
      </span>
      <ArrowUpRightIcon
        size={12}
        className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
    </a>
  );
}
