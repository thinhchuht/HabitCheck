import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app";

/**
 * Ticking "now" adjusted by the server clock offset
 * (serverOffsetMs = serverTime - Date.now(), set from /today or /live).
 * Returns current server-adjusted epoch milliseconds.
 */
export function useNow(intervalMs = 1000): number {
  const offset = useAppStore((s) => s.serverOffsetMs);
  const [now, setNow] = useState<number>(() => Date.now() + offset);

  useEffect(() => {
    setNow(Date.now() + offset);
    const timer = window.setInterval(() => setNow(Date.now() + offset), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, offset]);

  return now;
}
