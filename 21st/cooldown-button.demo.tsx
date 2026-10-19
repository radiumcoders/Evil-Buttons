import { CooldownButton, type CooldownButtonVariant } from "./cooldown-button";

const settings = {
  label: "Resend code",
  taunt: "Check your inbox.",
  cooldown: 20000,
  initialCooldown: 17000,
  showCountdown: true,
  variant: "auto",
};

const VARIANTS = ["auto", "dark", "light"];

export default function CooldownButtonDemo(props: Partial<typeof settings>) {
  const s = { ...settings, ...props };
  const variant = (
    VARIANTS.includes(s.variant) ? s.variant : "auto"
  ) as CooldownButtonVariant;

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4">
      <div className="w-full max-w-[400px] [zoom:1.4] lg:[zoom:1.9]">
        <div className="rounded-2xl bg-muted/60 p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_40px_-16px_rgb(0_0_0/0.14)]">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Check your email
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the 6-digit code we sent to you@example.com.
          </p>

          <div className="mt-5 flex gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className={
                  "flex h-12 flex-1 items-center justify-center rounded-lg bg-background shadow-[inset_0_1px_2px_rgb(0_0_0/0.06)] " +
                  (i === 0 ? "ring-2 ring-ring/40" : "")
                }
              >
                {i === 0 ? (
                  <span className="h-5 w-px bg-foreground/70" aria-hidden />
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              Didn&apos;t get it?
            </span>
            <CooldownButton
              // Remount so cooldown knobs restart the lock.
              key={`${s.cooldown}-${s.initialCooldown}`}
              label={s.label}
              cooldown={s.cooldown}
              initialCooldown={s.initialCooldown}
              showCountdown={s.showCountdown}
              taunts={[s.taunt, "Still on its way.", "Try your spam folder."]}
              variant={variant}
              className="h-10 min-w-52"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
