import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";
import { BreezeUiLogo, breezeUiUrl } from "@/components/breeze-ui";

/** Slim "Sponsored by" strip across the top of the hero frame. */
export function SponsorRibbon() {
  return (
    <a
      href={breezeUiUrl("ribbon")}
      target="_blank"
      // noopener only: noreferrer would hide the visit from their analytics.
      rel="noopener"
      aria-label="Sponsored by Breeze UI: shader backgrounds, text effects and templates for shadcn"
      className="group relative flex h-9 shrink-0 items-center justify-center gap-2.5 border-b border-foreground/10 bg-background/40 px-4 text-xs backdrop-blur-md transition-colors hover:bg-background/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      <span className="font-mono text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
        Sponsored by
      </span>
      <span aria-hidden className="h-3 w-px bg-foreground/15" />
      <span className="flex items-center gap-1.5 font-semibold tracking-[-0.01em] text-foreground">
        <BreezeUiLogo className="size-3.5" />
        Breeze UI
      </span>
      <span className="hidden text-muted-foreground transition-colors group-hover:text-foreground sm:inline">
        Shader backgrounds, text effects and templates for shadcn
      </span>
      <ArrowUpRightIcon
        weight="bold"
        className="size-3 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
      />
    </a>
  );
}
