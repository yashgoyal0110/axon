import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui';
import { Backdrop } from './Backdrop';
import { VisitCounter } from './VisitCounter';
import { useAuth } from '@/lib/store';
import { useVisitTracker } from '@/lib/useVisitTracker';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/product', label: 'Product' },
  { to: '/templates', label: 'Templates' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/docs', label: 'Docs' },
];

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link to="/" className={cn('group flex items-center gap-2.5', className)}>
      <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-mint-400 to-mint-600 shadow-[0_4px_16px_-4px_rgba(0,212,127,0.6)]">
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-ink-950">
          <circle cx="7" cy="7" r="2.6" />
          <circle cx="17" cy="7" r="2.6" opacity="0.65" />
          <circle cx="12" cy="17" r="2.6" opacity="0.85" />
          <path d="M7 7 L17 7 M17 7 L12 17 M7 7 L12 17" stroke="currentColor" strokeWidth="1.1" fill="none" opacity="0.5" />
        </svg>
        <span className="absolute inset-0 rounded-xl bg-mint-400/40 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100" />
      </span>
      {!compact && (
        <span className="font-display text-[17px] font-bold tracking-tight text-white">
          ax<span className="text-mint-400">on</span>
          <span className="ml-0.5 inline-block h-1 w-1 rounded-full bg-mint-400 align-middle" />
        </span>
      )}
    </Link>
  );
}

export function MarketingLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const status = useAuth((s) => s.status);
  const { scrollY } = useScroll();
  const blur = useTransform(scrollY, [0, 80], [0, 16]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  // Public pages only. Signed-in dashboard usage would otherwise inflate the
  // counter with the team's own traffic.
  useVisitTracker();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="relative min-h-full">
      <Backdrop />

      <motion.header
        style={{ backdropFilter: blur.get() ? `blur(${blur.get()}px)` : undefined }}
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-all duration-300',
          scrolled ? 'border-b border-white/[0.07] bg-ink-950/70 backdrop-blur-xl' : 'border-b border-transparent',
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5 sm:px-8">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'relative rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors duration-200',
                    isActive ? 'text-white' : 'text-slate-400 hover:text-white',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-lg bg-white/[0.07]"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      />
                    )}
                    <span className="relative">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {status === 'authenticated' ? (
              <Link to="/app">
                <Button size="sm" iconRight={ArrowRight}>
                  Open app
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login" className="hidden sm:block">
                  <Button variant="ghost" size="sm">
                    Sign in
                  </Button>
                </Link>
                <Link to="/register">
                  <Button size="sm">Start free</Button>
                </Link>
              </>
            )}

            <button
              onClick={() => setOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-white md:hidden"
              aria-label="Menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden border-t border-white/[0.07] bg-ink-950/95 backdrop-blur-xl md:hidden"
            >
              <div className="space-y-1 px-5 py-4">
                {NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'block rounded-lg px-3 py-2.5 text-sm font-medium',
                        isActive ? 'bg-white/[0.07] text-white' : 'text-slate-400',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
                <Link to="/login" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400">
                  Sign in
                </Link>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </motion.header>

      <main className="pt-16">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

function Footer() {
  const columns = [
    {
      title: 'Product',
      links: [
        { to: '/product', label: 'Overview' },
        { to: '/templates', label: 'Templates' },
        { to: '/pricing', label: 'Pricing' },
        { to: '/docs', label: 'Documentation' },
      ],
    },
    {
      title: 'Platform',
      links: [
        { to: '/docs#channels', label: 'WhatsApp Cloud API' },
        { to: '/docs#channels', label: 'Twilio' },
        { to: '/docs#sandbox', label: 'Sandbox mode' },
        { to: '/api/docs', label: 'REST API', external: true },
      ],
    },
    {
      title: 'Account',
      links: [
        { to: '/login', label: 'Sign in' },
        { to: '/register', label: 'Create workspace' },
        { to: '/app', label: 'Dashboard' },
      ],
    },
  ];

  return (
    <footer className="relative mt-32 border-t border-white/[0.07] bg-ink-950/60">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">
              Design WhatsApp conversations on a canvas, let AI handle everything you did not script, and watch it work
              in real time.
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
              All systems operational
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{column.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {'external' in link && link.external ? (
                      <a
                        href={link.to}
                        className="text-sm text-slate-400 transition-colors hover:text-mint-300"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link to={link.to} className="text-sm text-slate-400 transition-colors hover:text-mint-300">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.07] pt-6 sm:flex-row">
          <p className="text-xs text-slate-600">© {new Date().getFullYear()} Axon. Built for WhatsApp-first teams.</p>
          <VisitCounter />
          <p className="text-xs text-slate-600">
            Not affiliated with WhatsApp or Meta Platforms, Inc.
          </p>
        </div>
      </div>
    </footer>
  );
}
