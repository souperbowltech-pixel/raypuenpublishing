/**
 * Focus-trapping calculations and selectors.
 *
 * This logic lives in lib/ rather than inside the Lightbox component because it
 * is the only part of a focus trap that can be tested in this repo's node test
 * environment without DOM emulation.
 */

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function nextFocusIndex(
  count: number,
  current: number,
  shift: boolean
): number {
  if (count <= 0) {
    return -1;
  }

  if (current < 0) {
    return shift ? count - 1 : 0;
  }

  return shift ? (current - 1 + count) % count : (current + 1) % count;
}
