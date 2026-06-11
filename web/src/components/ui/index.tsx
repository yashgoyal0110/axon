import { motion, type HTMLMotionProps } from 'framer-motion';
import { Loader2, type LucideIcon } from 'lucide-react';
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-b from-mint-400 to-mint-600 text-ink-950 font-semibold shadow-[0_8px_24px_-8px_rgba(0,212,127,0.6)] hover:from-mint-300 hover:to-mint-500 hover:shadow-[0_12px_32px_-8px_rgba(0,212,127,0.7)] active:scale-[0.985]',
  secondary:
    'bg-white/[0.06] text-white border border-white/10 hover:bg-white/[0.1] hover:border-white/20 active:scale-[0.985]',
  ghost: 'text-slate-400 hover:text-white hover:bg-white/[0.06]',
  danger: 'bg-rose-500/15 text-rose-300 border border-rose-500/25 hover:bg-rose-500/25 hover:text-rose-200',
  outline: 'border border-mint-400/30 text-mint-300 hover:bg-mint-400/10 hover:border-mint-400/50',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2.5 rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon: Icon, iconRight: IconRight, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950',
        'disabled:pointer-events-none disabled:opacity-45',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      )}
      {children}
      {IconRight && !loading && <IconRight className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
    </button>
  );
});

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({
  className,
  children,
  hover = false,
  ...props
}: HTMLMotionProps<'div'> & { hover?: boolean }) {
  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl',
        'shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_20px_50px_-30px_rgba(0,0,0,0.9)]',
        hover && 'transition-all duration-300 hover:border-white/15 hover:bg-white/[0.045]',
        className,
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: 'center' | 'left';
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={cn('max-w-2xl', align === 'center' ? 'mx-auto text-center' : 'text-left')}
    >
      {eyebrow && (
        <div
          className={cn(
            'mb-4 inline-flex items-center gap-2 rounded-full border border-mint-400/20 bg-mint-400/[0.07] px-3 py-1',
            'text-[11px] font-semibold uppercase tracking-[0.14em] text-mint-300',
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
          {eyebrow}
        </div>
      )}
      <h2 className="text-balance text-3xl font-bold leading-[1.15] tracking-tight sm:text-4xl md:text-[2.75rem]">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-pretty text-base leading-relaxed text-slate-400 sm:text-[17px]">{description}</p>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Badges & status
// ---------------------------------------------------------------------------

const BADGE_TONES = {
  mint: 'bg-mint-400/10 text-mint-300 border-mint-400/25',
  violet: 'bg-violet-400/10 text-violet-300 border-violet-400/25',
  electric: 'bg-electric-400/10 text-electric-300 border-electric-400/25',
  amber: 'bg-amber-400/10 text-amber-300 border-amber-400/25',
  rose: 'bg-rose-400/10 text-rose-300 border-rose-400/25',
  slate: 'bg-white/[0.06] text-slate-300 border-white/10',
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  children,
  tone = 'slate',
  className,
  dot = false,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        BADGE_TONES[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** A dot with an expanding halo - used for "live" indicators. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex h-2 w-2', className)}>
      <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-mint-400" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-mint-400" />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

const FIELD_BASE =
  'w-full rounded-xl border border-white/10 bg-ink-900/60 px-3.5 text-sm text-white placeholder:text-slate-600 ' +
  'transition-all duration-200 focus:border-mint-400/50 focus:bg-ink-900 focus:outline-none focus:ring-2 focus:ring-mint-400/20 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label className="flex items-center gap-1 text-[13px] font-medium text-slate-300">
          {label}
          {required && <span className="text-mint-400">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-rose-400">{error}</p>
      ) : (
        hint && <p className="text-xs leading-relaxed text-slate-500">{hint}</p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(FIELD_BASE, 'h-10', className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(FIELD_BASE, 'resize-y py-2.5 leading-relaxed', className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(FIELD_BASE, 'h-10 cursor-pointer appearance-none bg-[right_0.75rem_center] bg-no-repeat pr-9', className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  );
});

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex items-start gap-3', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-300',
          checked ? 'bg-mint-500' : 'bg-white/12',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className={cn(
            'absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-sm',
            checked ? 'left-[19px]' : 'left-[3px]',
          )}
        />
      </button>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium text-slate-200">{label}</span>}
          {description && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{description}</span>}
        </span>
      )}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    // Lock scroll while a modal owns the viewport.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-ink-950/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'relative w-full overflow-hidden rounded-t-3xl border border-white/10 bg-ink-850/95 shadow-lift backdrop-blur-2xl sm:rounded-2xl',
          widths[size],
        )}
      >
        <div className="border-b border-white/[0.07] px-6 py-5">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {description && <p className="mt-1 text-sm leading-relaxed text-slate-400">{description}</p>}
        </div>
        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-white/[0.07] bg-ink-900/50 px-6 py-4">{footer}</div>}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-mint-400', className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-lg bg-white/[0.04]',
        'bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)] bg-[length:200%_100%]',
        className,
      )}
    />
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center px-6 py-16 text-center"
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-2xl bg-mint-400/20 blur-2xl" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <Icon className="h-6 w-6 text-mint-300" />
        </div>
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const TabsContext = createContext<{ value: string; setValue: (v: string) => void } | null>(null);

export function Tabs({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TabsContext.Provider value={{ value, setValue: onChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('scrollbar-none flex gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-white/[0.02] p-1', className)}>
      {children}
    </div>
  );
}

export function Tab({ value, children, icon: Icon }: { value: string; children: ReactNode; icon?: LucideIcon }) {
  const ctx = useContext(TabsContext);
  const active = ctx?.value === value;
  return (
    <button
      type="button"
      onClick={() => ctx?.setValue(value)}
      className={cn(
        'relative flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-200',
        active ? 'text-white' : 'text-slate-500 hover:text-slate-300',
      )}
    >
      {active && (
        // The pill slides between tabs rather than snapping.
        <motion.span
          layoutId="tab-pill"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="absolute inset-0 rounded-lg border border-white/10 bg-white/[0.07]"
        />
      )}
      {Icon && <Icon className="relative h-3.5 w-3.5" />}
      <span className="relative">{children}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Motion helpers
// ---------------------------------------------------------------------------

/** Fades and lifts children into view, one after another. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.65, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Counts up to `value` when the element scrolls into view. */
export function CountUp({
  value,
  duration = 1400,
  format = (n: number) => n.toLocaleString(),
  className,
}: {
  value: number;
  duration?: number;
  format?: (value: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;

        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          // easeOutExpo keeps the last digits from crawling.
          const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
          setDisplay(Math.round(value * eased));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {format(display)}
    </span>
  );
}

/** Card that tilts subtly toward the pointer. */
export function TiltCard({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('');

  return (
    <div
      ref={ref}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        setTransform(`perspective(1000px) rotateY(${x * 7}deg) rotateX(${-y * 7}deg) translateZ(0)`);
      }}
      onMouseLeave={() => setTransform('')}
      style={{ transform, transition: transform ? 'transform 0.08s linear' : 'transform 0.5s cubic-bezier(0.16,1,0.3,1)' }}
      className={className}
    >
      {children}
    </div>
  );
}
