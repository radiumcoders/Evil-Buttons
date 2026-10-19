import { EvilEyeButton } from "./evil-eye-button"

const settings = {
  label: "I see you",
  eyeColor: "#ff6f37",
  intensity: 1.3,
  glowIntensity: 0.5,
  pupilSize: 0.62,
  flameSpeed: 0.8,
  pupilFollow: 0.8,
  blink: true,
}

export default function EvilEyeButtonDemo(props: Partial<typeof settings>) {
  const s = { ...settings, ...props }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background px-6">
      <EvilEyeButton
        label={s.label}
        eyeColor={s.eyeColor}
        intensity={s.intensity}
        glowIntensity={s.glowIntensity}
        pupilSize={s.pupilSize}
        flameSpeed={s.flameSpeed}
        pupilFollow={s.pupilFollow}
        blink={s.blink}
        className="h-28 w-full max-w-2xl px-16 text-xl tracking-[0.3em] sm:h-36"
      />
    </div>
  )
}
