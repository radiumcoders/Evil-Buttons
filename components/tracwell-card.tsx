import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";

/** "Analytics by Tracwell" credit. */
export function TracwellCard() {
  return (
    <a
      href="https://tracwell.app/"
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span>
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
