import { TrollButton } from "./troll-button"

const settings = {
  title: "Delete account?",
  label: "Delete account",
  surrenderLabel: "Fine, delete it",
  giveUpAfter: 3500,
  range: 160,
  fleeRadius: 56,
  offsetX: 48,
  offsetY: 64,
}

export default function TrollButtonDemo(props: Partial<typeof settings>) {
  const s = { ...settings, ...props }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-6 py-24">
      <div className="w-full max-w-2xl rounded-[28px] bg-muted/60 p-8 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_24px_48px_-24px_rgb(0_0_0/0.18)] sm:p-12 dark:bg-card dark:shadow-[0_1px_2px_rgb(0_0_0/0.3),0_24px_48px_-24px_rgb(0_0_0/0.6)]">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
          {s.title}
        </h2>
        <p className="mt-4 text-lg text-pretty text-muted-foreground">
          Your workspace, files, and billing history will be removed for good.
          This can&apos;t be undone.
        </p>
        <div className="mt-12 flex items-center justify-end gap-3">
          <button
            type="button"
            className="h-12 cursor-pointer rounded-xl px-6 text-lg font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            Cancel
          </button>
          <TrollButton
            label={s.label}
            surrenderLabel={s.surrenderLabel}
            giveUpAfter={s.giveUpAfter}
            range={s.range}
            fleeRadius={s.fleeRadius}
            initialOffset={{ x: s.offsetX, y: s.offsetY }}
            className="h-12 rounded-xl px-6 text-lg"
          />
        </div>
      </div>
    </div>
  )
}
