import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  CreditCard,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Plug,
  Settings,
  Sparkles,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Badge, Button, Spinner } from '@/components/ui';
import { SubtleBackdrop } from '@/components/marketing/Backdrop';
import { Logo } from '@/components/marketing/MarketingLayout';
import { useAuth } from '@/lib/store';
import { avatarGradient, cn, initials } from '@/lib/utils';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/flows', label: 'Flows', icon: Workflow },
  { to: '/app/simulator', label: 'Simulator', icon: Sparkles },
  { to: '/app/inbox', label: 'Inbox', icon: Inbox },
  { to: '/app/contacts', label: 'Contacts', icon: Users },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/app/channels', label: 'Channels', icon: Plug },
  { to: '/app/billing', label: 'Billing', icon: CreditCard },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const status = useAuth((s) => s.status);

  useEffect(() => setMobileOpen(false), [pathname]);

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  return (
    <div className="relative flex h-full">
      <SubtleBackdrop />

      {/* Desktop sidebar */}
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-white/[0.06] bg-ink-950/60 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <WorkspaceSwitcher />
        <NavItems />
        <UserCard />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-ink-950/80 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 400, damping: 38 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col border-r border-white/[0.08] bg-ink-900 lg:hidden"
            >
              <div className="flex h-16 items-center justify-between px-5">
                <Logo />
                <button onClick={() => setMobileOpen(false)} className="text-slate-500 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <WorkspaceSwitcher />
              <NavItems />
              <UserCard />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-ink-950/50 px-4 backdrop-blur-xl lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/[0.06] hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo compact />
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItems() {
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors duration-200',
              isActive ? 'text-white' : 'text-slate-500 hover:text-slate-200',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span
                  layoutId="sidebar-active"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-xl border border-mint-400/15 bg-gradient-to-r from-mint-400/[0.12] to-transparent"
                />
              )}
              <item.icon
                className={cn(
                  'relative h-4 w-4 transition-colors',
                  isActive ? 'text-mint-300' : 'text-slate-600 group-hover:text-slate-400',
                )}
              />
              <span className="relative">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function WorkspaceSwitcher() {
  const { organization, organizations, switchOrg } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!organization) return null;

  return (
    <div ref={ref} className="relative px-3 pb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
      >
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[11px] font-bold text-ink-950',
            avatarGradient(organization.id),
          )}
        >
          {initials(organization.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-white">{organization.name}</span>
          <span className="block truncate text-[10.5px] uppercase tracking-wide text-slate-500">
            {organization.plan} · {organization.role}
          </span>
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-3 right-3 top-full z-30 mt-1 overflow-hidden rounded-xl border border-white/10 bg-ink-850/95 p-1 shadow-lift backdrop-blur-2xl"
          >
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={async () => {
                  setOpen(false);
                  if (org.id === organization.id) return;
                  try {
                    await switchOrg(org.id);
                    toast.success(`Switched to ${org.name}`);
                  } catch {
                    toast.error('Could not switch workspace');
                  }
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/[0.06]"
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br text-[10px] font-bold text-ink-950',
                    avatarGradient(org.id),
                  )}
                >
                  {initials(org.name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-200">{org.name}</span>
                {org.id === organization.id && <Check className="h-3.5 w-3.5 shrink-0 text-mint-400" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserCard() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <div className="border-t border-white/[0.06] p-3">
      <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-ink-950',
            avatarGradient(user.id),
          )}
        >
          {initials(user.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium text-slate-200">{user.name}</span>
          <span className="block truncate text-[11px] text-slate-600">{user.email}</span>
        </span>
        <button
          onClick={() => void logout()}
          title="Sign out"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Consistent page header for every app screen. */
export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-2xl font-bold text-white">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </motion.div>
  );
}

export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-7xl px-5 py-7 sm:px-7', className)}>{children}</div>;
}
