"use client";

import { CheckIcon, EggCrackIcon, EggIcon } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { EASTER_EGGS, EGG_INFO, resetEggs, useFoundEggs } from "./eggs";
import { openEggHunt, setEggHuntOpen, useEggHuntOpen } from "./hunt-store";

/** The hunt: every egg, as a riddle until it's found. */
export function EggHuntDialog() {
  const open = useEggHuntOpen();
  const found = useFoundEggs();
  const complete = found.length === EASTER_EGGS.length;

  return (
    <Dialog open={open} onOpenChange={setEggHuntOpen}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="relative border-b border-border px-5 pt-5 pb-4">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(80%_100%_at_50%_0%,color-mix(in_oklch,var(--brand)_22%,transparent),transparent)]"
          />
          <DialogTitle className="relative flex items-center gap-2 font-pixel-display text-xl font-normal">
            <EggIcon weight="fill" className="size-5 text-brand" />
            Egg hunt
          </DialogTitle>
          <DialogDescription className="relative mt-1.5">
            {complete
              ? "You found every one. The buttons fear you now."
              : `${EASTER_EGGS.length} of the buttons hide an easter egg. Play rough with them; every hint below is a real clue.`}
          </DialogDescription>
          <div className="relative mt-4 flex items-end justify-between gap-4">
            <div className="flex flex-wrap gap-1" aria-hidden>
              {EASTER_EGGS.map((egg) =>
                found.includes(egg) ? (
                  <EggIcon key={egg} weight="fill" className="size-5 text-brand drop-shadow-[0_0_6px_color-mix(in_oklch,var(--brand)_45%,transparent)]" />
                ) : (
                  <EggIcon key={egg} className="size-5 text-foreground/20" />
                ),
              )}
            </div>
            <p className="shrink-0 text-sm text-muted-foreground tabular-nums">
              <span className="text-2xl font-semibold tracking-tight text-foreground">{found.length}</span> of{" "}
              {EASTER_EGGS.length} found
            </p>
          </div>
        </div>

        <ul className="max-h-[min(30rem,calc(100dvh-14rem))] divide-y divide-border overflow-y-auto">
          {EASTER_EGGS.map((egg) => {
            const info = EGG_INFO[egg];
            const isFound = found.includes(egg);
            return (
              <li key={egg} className="flex gap-3 px-5 py-3">
                <span
                  className={cn(
                    "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                    isFound ? "bg-brand text-white" : "bg-foreground/5 text-muted-foreground",
                  )}
                >
                  {isFound ? <CheckIcon weight="bold" className="size-3.5" /> : <EggCrackIcon className="size-3.5" />}
                </span>
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium", !isFound && "text-muted-foreground")}>
                    {isFound ? info.name : "???"}
                  </p>
                  <p className="text-[13px] text-muted-foreground">{isFound ? info.how : info.hint}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-between border-t border-border bg-muted/50 px-5 py-3 text-xs text-muted-foreground">
          <span>Progress is saved in this browser.</span>
          {found.length > 0 ? (
            <button
              type="button"
              onClick={resetEggs}
              className="rounded-sm transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Hide them again
            </button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The always-visible way in: an egg with your count, for headers and footers. */
export function EggHuntButton({ className, label = false }: { className?: string; label?: boolean }) {
  const found = useFoundEggs();
  const complete = found.length === EASTER_EGGS.length;
  return (
    <button
      type="button"
      onClick={openEggHunt}
      aria-label={`Easter egg hunt: ${found.length} of ${EASTER_EGGS.length} found`}
      title="Easter egg hunt"
      className={cn(
        "group inline-flex h-7 items-center gap-1.5 rounded-full border border-foreground/10 bg-foreground/[0.03] pr-2.5 pl-2 text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        found.length > 0 && "border-brand/25 bg-brand/[0.06]",
        className,
      )}
    >
      <EggIcon
        weight={found.length > 0 ? "fill" : "bold"}
        className={cn(
          "size-3.5 shrink-0 transition-transform group-hover:-rotate-12",
          found.length > 0 && "text-brand",
          // A little wobble until the first egg is found, to invite a click.
          found.length === 0 && "animate-[egg-wobble_4s_ease-in-out_infinite] motion-reduce:animate-none",
        )}
      />
      {label ? <span className="text-xs">Egg hunt</span> : null}
      <span className="text-xs tabular-nums">
        <span className={cn("font-semibold", found.length > 0 && "text-foreground")}>{found.length}</span>
        <span className="opacity-50">/{EASTER_EGGS.length}</span>
      </span>
      {complete ? <span className="sr-only">All found</span> : null}
    </button>
  );
}
