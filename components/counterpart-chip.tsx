import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";
import { counterpart, counterpartUrl } from "@/lib/counterpart";

/** "Get this button for <other framework>", under a docs page's title. */
export function CounterpartChip({ pathname }: { pathname: string }) {
  return (
    <a
      href={counterpartUrl(pathname)}
      target="_blank"
      rel="noopener"
      className="group inline-flex h-7 w-fit items-center gap-2.5 rounded-full border border-foreground/10 bg-background/40 px-3.5 text-[13px] font-medium text-foreground/80 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] backdrop-blur-md transition-colors hover:border-foreground/20 hover:bg-background/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      Get this button for {counterpart.name}
      <span aria-hidden className="h-3 w-px bg-foreground/15" />
      <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase transition-colors group-hover:text-foreground">
        {counterpart.note}
      </span>
      <ArrowUpRightIcon aria-hidden size={12} weight="bold" className="-ml-1 text-muted-foreground transition-colors group-hover:text-foreground" />
    </a>
  );
}
