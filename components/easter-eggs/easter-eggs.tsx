"use client";

import { BoomWord } from "./boom-word";
import { ConsoleGreeting } from "./console-greeting";
import { EggToaster } from "./egg-toast";
import { HellMode } from "./hell-mode";
import { LightsOut } from "./lights-out";
import { ScreenCracks } from "./screen-cracks";
import { TabTitle } from "./tab-title";
import { WatchingEyes } from "./watching-eyes";

/** Every hidden egg on the site, mounted once in the root layout. */
export function EasterEggs() {
  return (
    <>
      <HellMode />
      <LightsOut />
      <WatchingEyes />
      <ScreenCracks />
      <BoomWord />
      <TabTitle />
      <ConsoleGreeting />
      <EggToaster />
    </>
  );
}
