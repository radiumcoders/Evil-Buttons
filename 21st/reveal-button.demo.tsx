import { RevealButton, type RevealButtonVariant } from "./reveal-button";

const settings = {
  secret: "sk_live_51Hq8xQ4z9Lm",
  maskedValue: "sk_live_••••••••••",
  label: "Production",
  hiddenLabel: "Production",
  revealMode: "toggle",
  defaultRevealed: true,
  variant: "auto",
};

const VARIANTS = ["auto", "dark", "light"];

export default function RevealButtonDemo(props: Partial<typeof settings>) {
  const s = { ...settings, ...props };
  const variant = (
    VARIANTS.includes(s.variant) ? s.variant : "auto"
  ) as RevealButtonVariant;
  const revealMode = s.revealMode === "hold" ? "hold" : "toggle";

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4">
      <div className="w-full max-w-[460px] [zoom:1.3] lg:[zoom:1.75]">
        <div className="rounded-2xl bg-muted/60 p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_40px_-16px_rgb(0_0_0/0.14)]">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-semibold text-foreground">API keys</h2>
            <span className="text-xs text-muted-foreground">
              {revealMode === "hold" ? "Hold to reveal" : "Click to reveal"}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            <RevealButton
              // Remount so the starting state follows its knob.
              key={`live-${s.defaultRevealed}-${revealMode}`}
              secret={s.secret}
              maskedValue={s.maskedValue}
              label={s.label}
              hiddenLabel={s.hiddenLabel}
              revealMode={revealMode}
              defaultRevealed={s.defaultRevealed}
              variant={variant}
              className="w-full sm:min-w-0"
            />
            <RevealButton
              key={`test-${revealMode}`}
              secret="sk_test_4eC39HqLyjWD"
              maskedValue="sk_test_••••••••••"
              label="Development"
              hiddenLabel="Development"
              revealMode={revealMode}
              variant={variant}
              className="w-full sm:min-w-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
