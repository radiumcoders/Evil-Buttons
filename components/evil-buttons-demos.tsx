"use client";

import { ArrowUpRightIcon, SparkleIcon } from "@phosphor-icons/react";
import {
  ChromeButton,
  type ChromeTone,
} from "@/components/evil-buttons/chrome-button";
import { MorphStatusButton } from "@/components/evil-buttons/morph-status-button";

/**
 * Doc-only client wrappers so the MDX previews (rendered on the server) never
 * pass event-handler functions across the server/client boundary.
 */

export function MorphStatusButtonDemo() {
  return (
    <MorphStatusButton
      onClick={() => new Promise((resolve) => setTimeout(resolve, 1200))}
    >
      Save changes
    </MorphStatusButton>
  );
}

export function MorphStatusButtonFailDemo() {
  return (
    <MorphStatusButton
      onClick={() => new Promise((_, reject) => setTimeout(reject, 1200))}
    >
      Deploy
    </MorphStatusButton>
  );
}

/** The three shapes side by side: pill with a trailing arrow, compact pill, icon. */
export function ChromeButtonSet({ tone = "dark" }: { tone?: ChromeTone }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ChromeButton tone={tone}>
        Continue
        <ArrowUpRightIcon weight="bold" />
      </ChromeButton>
      <ChromeButton tone={tone} size="sm">
        <SparkleIcon weight="bold" />
        Generate
      </ChromeButton>
      <ChromeButton tone={tone} size="icon" aria-label="Generate">
        <SparkleIcon weight="bold" />
      </ChromeButton>
    </div>
  );
}
