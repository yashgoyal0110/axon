import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Fires one beacon per public page view.
 *
 * Everything here is deliberately off the critical path: the call is made
 * after paint, uses keepalive so it survives the navigation that triggered it,
 * and swallows every error. A failed or blocked analytics request must never
 * be visible to the visitor.
 */
export function useVisitTracker(enabled = true): void {
  const { pathname } = useLocation();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || lastPath.current === pathname) return;
    lastPath.current = pathname;

    const send = () => {
      void fetch('/api/visits', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: pathname, referrer: document.referrer || undefined }),
        keepalive: true,
      }).catch(() => undefined);
    };

    // Yield to the browser so tracking never competes with rendering.
    const idle = window.requestIdleCallback?.(send, { timeout: 2000 }) ?? window.setTimeout(send, 300);
    return () => {
      if (window.cancelIdleCallback && typeof idle === 'number') window.cancelIdleCallback(idle);
    };
  }, [pathname, enabled]);
}
