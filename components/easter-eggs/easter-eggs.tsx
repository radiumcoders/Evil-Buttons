"use client";

import { ConsoleGreeting } from "./console-greeting";
import { EggHuntDialog } from "./egg-hunt";
import { EggTeaser } from "./egg-teaser";
import { EggToaster } from "./egg-toast";
import { EverythingDeleted } from "./everything-deleted";
import { GlitchStorm } from "./glitch-storm";
import { HellMode } from "./hell-mode";
import { LightsOut } from "./lights-out";
import { ScreenCracks } from "./screen-cracks";
import { WatchingEyes } from "./watching-eyes";

/**
 * The effects behind every hidden egg, mounted once in the root layout. The
 * site's copies of the buttons (./buttons) set them off.
 */
export function EasterEggs() {
  return (
    <>
      <HellMode />
      <EverythingDeleted />
      <WatchingEyes />
      <ScreenCracks />
      <GlitchStorm />
      <LightsOut />
      <ConsoleGreeting />
      <EggTeaser />
      <EggHuntDialog />
      <EggToaster />
    </>
  );
}
