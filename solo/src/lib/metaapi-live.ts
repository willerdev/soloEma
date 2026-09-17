"use client";

const STORAGE_KEY = "solo-metaapi-paused";
export const METAAPI_LIVE_EVENT = "solo-metaapi-live";

function canUseDom() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function isMetaApiManuallyPaused(): boolean {
  if (!canUseDom()) return false;
  try {
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMetaApiManuallyPaused(paused: boolean) {
  if (!canUseDom()) return;
  try {
    if (paused) sessionStorage.setItem(STORAGE_KEY, "1");
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(METAAPI_LIVE_EVENT));
}

export function isMetaApiPageActive(): boolean {
  if (!canUseDom()) return true;
  if (document.hidden) return false;
  if (typeof document.hasFocus === "function" && !document.hasFocus()) {
    return false;
  }
  return true;
}

/** Live MetaAPI polling: page is visible/focused and the user has not paused. */
export function isMetaApiLive(): boolean {
  return isMetaApiPageActive() && !isMetaApiManuallyPaused();
}

export function subscribeMetaApiLive(onChange: () => void): () => void {
  if (!canUseDom()) return () => undefined;
  const handler = () => onChange();
  window.addEventListener("focus", handler);
  window.addEventListener("blur", handler);
  document.addEventListener("visibilitychange", handler);
  window.addEventListener(METAAPI_LIVE_EVENT, handler);
  return () => {
    window.removeEventListener("focus", handler);
    window.removeEventListener("blur", handler);
    document.removeEventListener("visibilitychange", handler);
    window.removeEventListener(METAAPI_LIVE_EVENT, handler);
  };
}
