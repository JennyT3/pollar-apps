import { useSyncExternalStore } from "react";

function subscribe() {
  return () => {};
}

/**
 * True once mounted in the browser, false during SSR and the initial
 * client hydration pass. The React-sanctioned way to gate a `window`-only
 * value computed during render without a server/client hydration mismatch
 * — `getServerSnapshot` backs both the server render and React's first
 * client pass, so they agree; the value then updates once React re-renders
 * with the real client snapshot right after hydration.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
