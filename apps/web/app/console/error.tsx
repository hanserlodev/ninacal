"use client";

import { useEffect } from "react";

export default function ConsoleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("NinaCal console error", error);
  }, [error]);

  return (
    <main className="mc-error">
      <p className="eyebrow">Mission control</p>
      <h1>Something interrupted the console</h1>
      <p>
        The map data changed while the view was loading. Nothing was lost; retry the
        selection or reload the console.
      </p>
      <div className="mc-error-actions">
        <button type="button" className="btn btn--primary" onClick={reset}>
          Retry
        </button>
        <a className="btn" href="/console/">
          Reload console
        </a>
        <a className="btn" href="/">
          Back to overview
        </a>
      </div>
    </main>
  );
}
