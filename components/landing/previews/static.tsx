"use client";

import { useIsDarkMode } from "@/hooks/use-app-theme";
import { RevealButton } from "@/components/evil-buttons/reveal-button";
import { HoldButton } from "@/components/evil-buttons/hold-button";
import { HoldConfirmButton } from "@/components/evil-buttons/hold-confirm-button";
import { SlideToDetonate } from "@/components/evil-buttons/slide-to-detonate";
import { DoubtButton } from "@/components/evil-buttons/doubt-button";
import { CaptchaButton } from "@/components/evil-buttons/captcha-button";
import { CooldownButton } from "@/components/evil-buttons/cooldown-button";
import { MorphStatusButton } from "@/components/evil-buttons/morph-status-button";
import { BrutalButton } from "@/components/evil-buttons/brutal-button";
import DitherButton from "@/components/evil-buttons/dither-button";
import { GlitchButton } from "@/components/evil-buttons/glitch-button";
import EvilEyeButton from "@/components/evil-buttons/evil-eye-button";
import { AquaButton } from "@/components/evil-buttons/aqua-button";
import { FrameButton } from "@/components/evil-buttons/frame-button";
import { HighlightButton } from "@/components/evil-buttons/highlight-button";
import { ConfettiButton } from "@/components/evil-buttons/confetti-button";
import { CommandButton } from "@/components/evil-buttons/command-button";
import { CopyButton } from "@/components/evil-buttons/copy-button";
import { ClickPowerUp } from "@/components/evil-buttons/click-powerup";
import { PillButton } from "@/components/evil-buttons/pill-button";
import { DemonicButton } from "@/components/evil-buttons/demonic-button";
import ChromeButton from "@/components/evil-buttons/chrome-button";
import GridButton from "@/components/evil-buttons/grid-button";
import MinimalButton from "@/components/evil-buttons/minimal";
import MoviePassButton from "@/components/evil-buttons/movie-pass";
import ShinyButton from "@/components/evil-buttons/shiny-button";
import StickyButton from "@/components/evil-buttons/sticky";
import { ThreeDButton } from "@/components/evil-buttons/3d-button";
import TrollButton from "@/components/evil-buttons/troll-button";
import { DeferredWebGLPreview } from "./shared";
import { pillClassNames, themeColors } from "./theme";

export function StaticRevealButtonPreview() {
  return (
    <RevealButton
      label="Reveal"
      hiddenLabel="Hidden"
      maskedValue="•••• •••• ••••"
      secret="sk_live_••••_9xQ4"
      revealMode="hold"
    />
  );
}

export function StaticHoldButtonPreview() {
  return (
    <HoldButton
      label="Hold to delete"
      holdingLabel="Keep holding…"
      successLabel="Deleted"
      duration={1500}
      resetAfter={1400}
    />
  );
}

export function StaticHoldConfirmButtonPreview() {
  const isDark = useIsDarkMode();

  return (
    <HoldConfirmButton
      label="Hold to confirm"
      holdingLabel="Keep holding…"
      successLabel="Confirmed"
      duration={2000}
      resetAfter={1600}
      minScale={0.9}
      ringSize={280}
      ringStrokeWidth={12}
      ringColor={isDark ? "#5eead4" : "#0d9488"}
    />
  );
}

export function StaticSlideToDetonatePreview() {
  return (
    <SlideToDetonate
      label="Slide to detonate"
      successLabel="Detonated"
      threshold={0.95}
      resetAfter={1600}
    />
  );
}

export function StaticDoubtButtonPreview() {
  return (
    <DoubtButton
      label="Delete everything"
      successLabel="Too late."
      resetAfter={1600}
    />
  );
}

export function StaticCaptchaButtonPreview() {
  return (
    <CaptchaButton
      label="Deploy Doom"
      successLabel="Deployed"
      resetAfter={1600}
    />
  );
}

export function StaticCooldownButtonPreview() {
  return (
    <CooldownButton label="Send it" cooldown={3000} showCountdown />
  );
}

export function StaticMorphStatusButtonPreview() {
  return (
    <MorphStatusButton
      label="Save changes"
      loadingLabel="Working…"
      successLabel="Done"
      errorLabel="It broke. Your fault."
      resetAfter={1800}
      onClick={() => new Promise((resolve) => setTimeout(resolve, 1200))}
    />
  );
}

export function StaticBrutalButtonPreview() {
  const isDark = useIsDarkMode();
  const colors = isDark ? themeColors.dark : themeColors.light;

  return (
    <BrutalButton
      color={colors.background}
      textColor={colors.foreground}
      borderColor={colors.foreground}
      shadowColor={colors.foreground}
      hasBorder
      hasShadow
      radius={0}
    >
      Click Me
    </BrutalButton>
  );
}

export function StaticDitherButtonPreview() {
  const isDark = useIsDarkMode();

  return (
    <DitherButton
      ditherColor={isDark ? "#a3a3a3" : "#737373"}
      ditherOpacity={1}
      ditherSize={4}
    >
      Run It
    </DitherButton>
  );
}

export function StaticGlitchButtonPreview() {
  const isDark = useIsDarkMode();

  return (
    <GlitchButton
      glitchInterval={3500}
      glitchDuration={450}
      colors={[isDark ? "#ef4444" : "#dc2626", isDark ? "#22d3ee" : "#0891b2"]}
      intensity={1}
      trigger="hover"
      scanlines
    >
      Launch
    </GlitchButton>
  );
}

export function StaticEvilEyeButtonPreview() {
  return (
    <DeferredWebGLPreview label="Doom">
      <EvilEyeButton
        effectOpacity={0.95}
        eyeColor="#ff6f37"
        backgroundColor="#000000"
        intensity={1.65}
        pupilSize={0.62}
        irisWidth={0.22}
        glowIntensity={0.56}
        scale={1.15}
        noiseScale={1}
        pupilFollow={0.55}
        flameSpeed={0.8}
      >
        Doom
      </EvilEyeButton>
    </DeferredWebGLPreview>
  );
}

export function StaticAquaButtonPreview() {
  return <AquaButton variant="primary">Deploy Doom</AquaButton>;
}

export function StaticFrameButtonPreview() {
  return (
    <FrameButton
      variant="default"
      glow={false}
      size={20}
      offset={7.5}
      hoverOffset={7}
    >
      Deploy
    </FrameButton>
  );
}

export function StaticHighlightButtonPreview() {
  const isDark = useIsDarkMode();
  const colors = isDark ? themeColors.dark : themeColors.light;

  return (
    <HighlightButton
      highlightColor={colors.foreground}
      highlightSize={56}
      borderColor={colors.foreground}
    >
      Send
    </HighlightButton>
  );
}

export function StaticConfettiButtonPreview() {
  return (
    <ConfettiButton
      label="Celebrate"
      particleCount={120}
      spread={72}
      startVelocity={38}
    />
  );
}

export function StaticCommandButtonPreview() {
  return (
    <CommandButton shortcut="mod+s" showShortcut preventDefault>
      Save
    </CommandButton>
  );
}

export function StaticCopyButtonPreview() {
  return (
    <CopyButton
      value="npx evil-buttons@latest init"
      copyLabel="Copy"
      copiedLabel="Copied"
      timeout={1500}
    />
  );
}

export function StaticClickPowerUpPreview() {
  return <ClickPowerUp tapDuration={500}>Doom</ClickPowerUp>;
}

export function StaticPillButtonPreview() {
  const isDark = useIsDarkMode();
  const classes = pillClassNames(isDark);

  return (
    <PillButton
      primaryLabel="Off"
      secondaryLabel="On"
      defaultOpen={false}
      primaryClassName={classes.primaryClassName}
      secondaryClassName={classes.secondaryClassName}
    />
  );
}

export function StaticDemonicButtonPreview() {
  return <DemonicButton label="Currupt the World" />;
}

export function StaticChromeButtonPreview() {
  return (
    <DeferredWebGLPreview label="Chromy">
      <ChromeButton>Chromy</ChromeButton>
    </DeferredWebGLPreview>
  );
}

export function StaticGridButtonPreview() {
  return <GridButton>Click</GridButton>;
}

export function StaticMinimalButtonPreview() {
  return <MinimalButton>Apply</MinimalButton>;
}

export function StaticMoviePassButtonPreview() {
  return <MoviePassButton>Deploy Doom</MoviePassButton>;
}

export function StaticShinyButtonPreview() {
  return <ShinyButton>Search</ShinyButton>;
}

export function StaticStickyButtonPreview() {
  return <StickyButton>Try to Click</StickyButton>;
}

export function StaticThreeDButtonPreview() {
  return <ThreeDButton>Continue</ThreeDButton>;
}

export function StaticTrollButtonPreview() {
  return <TrollButton>Click Me</TrollButton>;
}