import { useEffect, useState } from "react";

/**
 * True when the app is running inside an iframe on another website
 * (e.g. embedded as a student portal).
 */
export function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Same check as a hook: false while rendering on the server and on the first
 * client paint, then the real value. Avoids hydration mismatches.
 */
export function useEmbedded(): boolean {
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => setEmbedded(isEmbedded()), []);
  return embedded;
}

/** Open the portal in its own browser tab (needed for Google sign-in and the camera). */
export function openInNewTab() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("standalone", "1");
  window.open(url.toString(), "_blank", "noopener");
}
