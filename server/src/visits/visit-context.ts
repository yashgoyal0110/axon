import * as crypto from 'crypto';

/** Everything we can learn about a visit from the request alone. */
export interface VisitContext {
  visitorId: string;
  ip?: string;
  country?: string;
  region?: string;
  city?: string;
  browser?: string;
  os?: string;
  device?: string;
  language?: string;
  isBot: boolean;
}

type Headers = Record<string, string | string[] | undefined>;

const header = (headers: Headers, name: string): string | undefined => {
  const value = headers[name];
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || undefined;
};

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|bingpreview|headless|lighthouse|preview|monitor|curl|wget|python-requests/i;

/**
 * Geo comes from whatever the edge in front of us already resolved, so a page
 * load never waits on a lookup. Cloudflare, App Engine, Vercel and Fly all
 * publish these; a bare origin simply reports nothing rather than stalling.
 */
function geoFromHeaders(headers: Headers): Pick<VisitContext, 'country' | 'region' | 'city'> {
  const country =
    header(headers, 'cf-ipcountry') ??
    header(headers, 'x-vercel-ip-country') ??
    header(headers, 'x-appengine-country') ??
    header(headers, 'fly-client-country') ??
    header(headers, 'x-geo-country');

  const region =
    header(headers, 'x-vercel-ip-country-region') ??
    header(headers, 'x-appengine-region') ??
    header(headers, 'x-geo-region');

  const city =
    header(headers, 'cf-ipcity') ??
    header(headers, 'x-vercel-ip-city') ??
    header(headers, 'x-appengine-city') ??
    header(headers, 'x-geo-city');

  // "XX" and "ZZ" are the standard placeholders for "could not resolve".
  const clean = (v?: string) => (v && v !== 'XX' && v !== 'ZZ' ? decodeURIComponent(v) : undefined);
  return { country: clean(country), region: clean(region), city: clean(city) };
}

function browserFrom(ua: string): string | undefined {
  // Order matters: Edge and Opera both advertise Chrome, Chrome advertises Safari.
  if (/edg[ea]?\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/samsungbrowser/i.test(ua)) return 'Samsung Internet';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua)) return 'Safari';
  return undefined;
}

function osFrom(ua: string): string | undefined {
  if (/windows nt/i.test(ua)) return 'Windows';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  if (/mac os x/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  return undefined;
}

function deviceFrom(ua: string): string {
  if (/ipad|tablet/i.test(ua)) return 'tablet';
  if (/mobi|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * Derives a stable visitor id without storing the raw address as the key.
 * The daily salt rotation means the hash cannot be used to follow someone
 * across days, which keeps "unique visitors" honest as a daily-ish metric
 * rather than a permanent identifier.
 */
function visitorIdFor(ip: string, userAgent: string, salt: string): string {
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHash('sha256').update(`${salt}:${day}:${ip}:${userAgent}`).digest('hex').slice(0, 32);
}

export function buildVisitContext(headers: Headers, ip: string | undefined, salt: string): VisitContext {
  const userAgent = header(headers, 'user-agent') ?? '';
  const language = header(headers, 'accept-language')?.split(',')[0];
  const address = ip ?? '';

  return {
    visitorId: visitorIdFor(address, userAgent, salt),
    ip: address || undefined,
    ...geoFromHeaders(headers),
    browser: browserFrom(userAgent),
    os: osFrom(userAgent),
    device: deviceFrom(userAgent),
    language,
    isBot: !userAgent || BOT.test(userAgent),
  };
}
