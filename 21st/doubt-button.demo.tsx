import { DoubtButton, type DoubtButtonVariant } from "./doubt-button";

const settings = {
  label: "Delete workspace",
  successLabel: "Gone. All of it.",
  initialStep: 2,
  resetAfter: 1600,
  danger: true,
  variant: "auto",
};

const VARIANTS = ["auto", "dark", "light"];

// Red label (and progress hairline, which uses currentColor) that keeps contrast on each face.
const DANGER_TEXT: Record<DoubtButtonVariant, string> = {
  auto: "text-red-600 dark:text-red-400",
  dark: "text-red-400",
  light: "text-red-600",
};

export default function DoubtButtonDemo(props: Partial<typeof settings>) {
  const s = { ...settings, ...props };
  const variant = (
    VARIANTS.includes(s.variant) ? s.variant : "auto"
  ) as DoubtButtonVariant;

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4">
      <div className="w-full max-w-[460px] [zoom:1.3] lg:[zoom:1.75]">
        <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
          Danger zone
        </p>
        <div className="rounded-2xl bg-muted/60 p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_40px_-16px_rgb(0_0_0/0.14)]">
          <h2 className="text-sm font-semibold text-foreground">
            Delete this workspace
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every project, file and member goes with it. There is no undo.
          </p>
          <div className="mt-5 flex justify-end">
            <DoubtButton
              // Remount so a new starting step takes effect.
              key={s.initialStep}
              label={s.label}
              successLabel={s.successLabel}
              initialStep={s.initialStep}
              resetAfter={s.resetAfter}
              variant={variant}
              className={"h-10 " + (s.danger ? DANGER_TEXT[variant] : "")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
