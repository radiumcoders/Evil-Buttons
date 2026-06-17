"use client";

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
