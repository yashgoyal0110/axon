import { Eye, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { get } from '@/lib/api';
import { formatNumber } from '@/lib/utils';

interface VisitStats {
  totalVisits: number;
  uniqueVisitors: number;
  last24h: number;
  topCountries: Array<{ country: string; visits: number }>;
}

/**
 * Site traffic badge. Renders nothing until the numbers arrive so the footer
 * never reflows, and stays silent if the endpoint is unavailable.
 */
export function VisitCounter() {
  const [stats, setStats] = useState<VisitStats | null>(null);

  useEffect(() => {
    let alive = true;
    // Deferred so it never competes with the page's own render work.
    const timer = window.setTimeout(() => {
      get<VisitStats>('/visits/stats', { auth: false })
        .then((data) => alive && setStats(data))
        .catch(() => undefined);
    }, 400);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);

  if (!stats || stats.totalVisits === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
      <span className="inline-flex items-center gap-1.5" title="Total page views">
        <Eye className="h-3.5 w-3.5 text-mint-400/60" />
        <span className="font-medium text-slate-400">{formatNumber(stats.totalVisits)}</span> visits
      </span>

      <span className="inline-flex items-center gap-1.5" title="Distinct visitors">
        <Users className="h-3.5 w-3.5 text-violet-300/60" />
        <span className="font-medium text-slate-400">{formatNumber(stats.uniqueVisitors)}</span> visitors
      </span>

      {stats.last24h > 0 && (
        <span className="inline-flex items-center gap-1.5" title="Page views in the last 24 hours">
          <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
          <span className="font-medium text-slate-400">{formatNumber(stats.last24h)}</span> today
        </span>
      )}
    </div>
  );
}
