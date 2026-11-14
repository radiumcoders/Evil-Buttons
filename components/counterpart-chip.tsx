import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";
import { counterpart, counterpartUrl } from "@/lib/counterpart";

/** "Get this button for <other framework>", beside a docs page's Copy Markdown and Open actions. */
export function CounterpartChip({ pathname }: { pathname: string }) {
  return (
    <a
      href={counterpartUrl(pathname)}
      target="_blank"
      rel="noopener"
      className="group inline-flex h-8 items-center gap-1.5 rounded-md bg-background/70 px-3 text-[13px] font-medium text-foreground/80 backdrop-blur-md transition-colors hover:bg-background/90 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      Get this button for {counterpart.name}
      <ArrowUpRightIcon aria-hidden size={12} weight="bold" className="text-muted-foreground transition-colors group-hover:text-foreground" />
    </a>
  );
}
