"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isMetaApiLive,
  isMetaApiManuallyPaused,
  isMetaApiPageActive,
  setMetaApiManuallyPaused,
  subscribeMetaApiLive,
} from "@/lib/metaapi-live";

export function useMetaApiLive() {
  const [live, setLive] = useState(true);
  const [manualPaused, setManualPaused] = useState(false);
  const [pageActive, setPageActive] = useState(true);

  useEffect(() => {
    function sync() {
      setLive(isMetaApiLive());
      setManualPaused(isMetaApiManuallyPaused());
      setPageActive(isMetaApiPageActive());
    }
    sync();
    return subscribeMetaApiLive(sync);
  }, []);

  const setPaused = useCallback((paused: boolean) => {
    setMetaApiManuallyPaused(paused);
  }, []);

  return { live, manualPaused, pageActive, setPaused };
}
