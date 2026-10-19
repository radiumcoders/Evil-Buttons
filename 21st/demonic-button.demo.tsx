import { DemonicButton } from "./demonic-button"

const settings = {
  headline: "Make a deal.",
  subline: "Hold the button. Don't let go.",
  label: "Sell your soul",
  holdDuration: 2200,
  idleCharge: 0.6,
  showHeadline: true,
}

export default function DemonicButtonDemo(props: Partial<typeof settings>) {
  const s = { ...settings, ...props }

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background px-6 py-16">
      {s.showHeadline ? (
        <div className="max-w-xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-6xl">
            {s.headline}
          </h1>
          <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">
            {s.subline}
          </p>
        </div>
      ) : null}
      <div className={s.showHeadline ? "mt-60 sm:mt-72" : undefined}>
        <DemonicButton
          label={s.label}
          holdDuration={s.holdDuration}
          idleCharge={s.idleCharge}
          className="h-[72px] min-w-72 rounded-2xl px-12 text-xl"
        />
      </div>
    </div>
  )
}
