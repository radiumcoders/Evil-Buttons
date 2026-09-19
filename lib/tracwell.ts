import {
  createTracwell,
  type EventProperties,
  type TracwellClient,
} from "tracwell";

const TRACWELL_CONFIG = {
  projectKey: "tw_live_d938a911b3d5412c966674fe3a004f62",
  collectionMode: "private",
  consent: "granted",
  respectDoNotTrack: true,
} as const;

let client: TracwellClient | undefined;

/**
 * Returns the process-wide browser client. Safe to import during SSR;
 * `createTracwell()` runs only after `document` exists, and only once.
 */
export function getTracwell(): TracwellClient | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }

  client ??= createTracwell(TRACWELL_CONFIG);
  return client;
}

export function trackOutcome(
  eventName: string,
  properties?: EventProperties,
): string | undefined {
  return getTracwell()?.track(eventName, properties);
}
