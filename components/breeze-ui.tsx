import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";

/** UTM-tagged so the visit shows up under evilbuttons in Breeze UI's analytics. */
export const breezeUiUrl = (campaign: string) =>
  `https://www.breezeui.com/?utm_source=evilbuttons&utm_medium=referral&utm_campaign=${campaign}`;

/** Breeze UI's "Air Stack" mark: three soft blocks stepping up and to the right. */
export function BreezeUiLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="315 303 392 389" aria-hidden className={className}>
      <path
        fill="currentColor"
        d="M532 315Q532 303 544 303L695 303Q707 303 707 315L707 406Q707 418 695 418L468 418Q456 418 456 430L456 458Q456 470 444 470L435 470Q423 470 423 458L423 367Q423 355 435 355L520 355Q532 355 532 343Z"
      />
      <path
        fill="currentColor"
        d="M478 452Q478 440 490 440L671 440Q683 440 683 452L683 543Q683 555 671 555L414 555Q402 555 402 567L402 595Q402 607 390 607L381 607Q369 607 369 595L369 504Q369 492 381 492L466 492Q478 492 478 480Z"
      />
      <path
        fill="currentColor"
        d="M424 589Q424 577 436 577L647 577Q659 577 659 589L659 680Q659 692 647 692L327 692Q315 692 315 680L315 641Q315 629 327 629L412 629Q424 629 424 617Z"
      />
    </svg>
  );
}

/** "Sponsored by Breeze UI" credit beside Shadcn Labs and Tracwell in the docs. */
export function BreezeUiCard() {
  return (
    <a
      href={breezeUiUrl("docs")}
      target="_blank"
      // noopener only: noreferrer would hide the visit from their analytics.
      rel="noopener"
      aria-label="Sponsored by Breeze UI"
      className="group flex items-center gap-2 rounded-lg border border-border bg-linear-to-br from-[#38bdf8]/10 via-[#38bdf8]/4 to-transparent px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:border-[#38bdf8]/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:from-[#38bdf8]/15 dark:via-[#38bdf8]/6"
    >
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="shrink-0">Sponsored by</span>
        <BreezeUiLogo className="size-3 shrink-0 text-foreground" />
        <span className="shrink-0 font-medium text-foreground">Breeze UI</span>
      </span>
      <ArrowUpRightIcon
        size={12}
        className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
      />
    </a>
  );
}
