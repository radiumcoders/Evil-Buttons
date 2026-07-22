"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center text-foreground">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Something broke
        </p>
        <h1 className="font-doto text-4xl font-black tracking-tighter">
          An evil error appeared.
        </h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Something went wrong while rendering this page. You can try again, or
          head back to safety.
        </p>
        {error.digest ? (
          <p className="font-mono text-[11px] text-muted-foreground/70">
            Error ID: {error.digest}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="inline-flex h-9 items-center justify-center bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex h-9 items-center justify-center border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
