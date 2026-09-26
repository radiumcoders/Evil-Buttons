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

/** "Analytics by Tracwell" credit, tinted with Tracwell's brand blue. */
export function TracwellCard() {
  return (
    <a
      href="https://tracwell.app/"
      target="_blank"
      rel="noopener noreferrer"
      className="tracwell-card group flex flex-col gap-2.5 rounded-xl p-3.5 transition-shadow duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-medium tracking-[0.14em] text-muted-foreground/80 uppercase">
          Analytics by
        </span>
        <ArrowUpRightIcon
          size={12}
          className="text-muted-foreground/60 transition-[translate,color] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
        />
      </span>
      <span className="flex items-center gap-2">
        <TracwellLogo className="size-5 shrink-0" />
        <span className="text-[15px] leading-none font-semibold tracking-tight text-foreground">
          Tracwell
        </span>
      </span>
      <span className="text-xs leading-5 text-muted-foreground">
        See what drives signups and revenue.
      </span>
    </a>
  );
}
