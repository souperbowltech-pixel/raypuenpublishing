"use client";

import { useState } from "react";

/**
 * True while `flag` is on, but only if it turned on while the reader was here.
 *
 * A celebration belongs to the moment something happens. A child who unlocked
 * Book 2 last week should not get the fanfare again on every visit, and a page
 * that is still loading has not "unlocked" anything yet. So the value `flag`
 * has on the first render where `ready` is true is the baseline: if it was
 * already on, nothing is celebrated until it goes off and comes back on.
 *
 * The baseline is state adjusted during render (React's pattern for deriving
 * from a previous value), so no ref is read while rendering.
 */
export function useJustBecameTrue(flag: boolean, ready = true): boolean {
  const [baseline, setBaseline] = useState<boolean | null>(null);
  if (ready && baseline === null) setBaseline(flag);
  if (ready && baseline === true && !flag) setBaseline(false);
  return ready && flag && baseline === false;
}
