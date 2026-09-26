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

/** "Analytics powered by Tracwell" credit on Tracwell's pastel mesh. */
export function TracwellCard() {
  return (
    <a
      href="https://tracwell.app/"
      target="_blank"
      rel="noopener noreferrer"
      className="tracwell-card group relative flex items-center gap-3 overflow-hidden rounded-xl p-3 transition-[translate,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
    >
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-[0_0_0_1px_rgb(53_125_255/0.12),0_1px_2px_rgb(23_78_166/0.12)] dark:bg-white/10 dark:shadow-[0_0_0_1px_rgb(140_180_255/0.18)]">
        <TracwellLogo className="size-6" />
      </span>
      <span className="relative flex min-w-0 flex-col">
        <span className="text-[11px] leading-4 text-[#174EA6]/70 dark:text-[#8CB4FF]/75">
          Analytics powered by
        </span>
        <span className="text-sm leading-5 font-semibold tracking-tight text-[#0b2a5c] dark:text-white">
          Tracwell
        </span>
      </span>
      <ArrowUpRightIcon
        size={14}
        className="relative ml-auto shrink-0 text-[#357DFF]/60 transition-[translate,color] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#357DFF] dark:text-[#8CB4FF]/60 dark:group-hover:text-[#8CB4FF]"
      />
    </a>
  );
}
