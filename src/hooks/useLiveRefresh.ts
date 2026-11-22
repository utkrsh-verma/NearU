import { useEffect, useRef } from 'react';

interface UseLiveRefreshOptions {
  /** Run only while the user is signed in with a complete profile */
  enabled: boolean;
  /** True while the WebSocket is connected; polling is only needed when it is not */
  realtimeConnected: boolean;
  /** Re-fetch whatever the app shows live (matches, open chat, likes badge) */
  onRefresh: () => void;
  intervalMs?: number;
}

/**
 * Keeps the app fresh on hosts without WebSockets (Vercel serverless).
 *  - Always: refresh when the tab/app becomes visible again or the window regains focus.
 *  - Only while the WebSocket is down: refresh every `intervalMs`, and only while the tab is visible.
 * When the WebSocket works, no timer runs at all.
 */
export function useLiveRefresh({
  enabled,
  realtimeConnected,
  onRefresh,
  intervalMs = 8000,
}: UseLiveRefreshOptions) {
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') refreshRef.current();
    };

    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);

    const timer = realtimeConnected ? null : setInterval(refreshIfVisible, intervalMs);

    return () => {
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
      if (timer) clearInterval(timer);
    };
  }, [enabled, realtimeConnected, intervalMs]);
}
