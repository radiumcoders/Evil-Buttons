"use client"; // Global error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  function retry() {
    if (typeof unstable_retry === "function") {
      unstable_retry();
      return;
    }
    reset();
  }

  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-6 py-16 text-center text-foreground">
        <div className="space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Something broke
          </p>
          <h1 className="text-4xl font-black tracking-tighter">
            An evil error appeared.
          </h1>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Something went wrong at the root of the app. You can try again, or
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
            onClick={retry}
            className="inline-flex h-9 items-center justify-center bg-foreground px-4 text-sm font-medium text-background"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex h-9 items-center justify-center border border-border px-4 text-sm font-medium"
          >
            Go home
          </Link>
        </div>
      </body>
    </html>
  );
}
