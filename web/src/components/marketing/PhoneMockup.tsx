import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCheck, Phone, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ScriptedTurn {
  from: 'bot' | 'user';
  text: string;
  buttons?: string[];
  /** Pause before this turn appears, in ms. */
  delay?: number;
}

const DEFAULT_SCRIPT: ScriptedTurn[] = [
  { from: 'user', text: 'hi, do you deliver to Bandra?', delay: 600 },
  {
    from: 'bot',
    text: 'Hey Priya 👋 Yes - we deliver across Mumbai. What can I get started for you?',
    buttons: ['See the menu', 'Track an order', 'Talk to a human'],
    delay: 1500,
  },
  { from: 'user', text: 'See the menu', delay: 1600 },
  {
    from: 'bot',
    text: 'Here are today\'s roasts ☕ Which one sounds good?',
    buttons: ['Ethiopian Yirgacheffe', 'Colombian Supremo', 'House blend'],
    delay: 1500,
  },
  { from: 'user', text: 'Ethiopian Yirgacheffe', delay: 1500 },
  {
    from: 'bot',
    text: 'Great pick. 250g bag, ₹690. Want it ground or whole bean?',
    buttons: ['Whole bean', 'Ground'],
    delay: 1400,
  },
  { from: 'user', text: 'Whole bean', delay: 1400 },
  { from: 'bot', text: 'Order placed ✅ Arriving tomorrow before 6pm. I\'ll text you the tracking link.', delay: 1500 },
];

/**
 * A looping, self-driving WhatsApp conversation. Each turn types in, the bot
 * shows a typing indicator first, and the whole script restarts after a beat.
 */
export function PhoneMockup({
  script = DEFAULT_SCRIPT,
  className,
  botName = 'Brew & Bean',
  status = 'typically replies instantly',
}: {
  script?: ScriptedTurn[];
  className?: string;
  botName?: string;
  status?: string;
}) {
  const [visible, setVisible] = useState<ScriptedTurn[]>([]);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });

    const run = async () => {
      while (!cancelled) {
        setVisible([]);
        setTyping(false);
        await wait(900);

        for (const turn of script) {
          if (cancelled) return;
          if (turn.from === 'bot') {
            setTyping(true);
            await wait(turn.delay ?? 1200);
            if (cancelled) return;
            setTyping(false);
          } else {
            await wait(turn.delay ?? 900);
          }
          if (cancelled) return;
          setVisible((prev) => [...prev, turn]);
        }

        // Hold the finished conversation on screen before looping.
        await wait(4200);
      }
    };

    void run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [script]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [visible, typing]);

  return (
    <div className={cn('relative', className)}>
      {/* Ambient glow behind the device */}
      <div className="absolute -inset-8 rounded-[3rem] bg-mint-500/15 blur-[70px]" />

      <div className="relative mx-auto w-[300px] rounded-[2.6rem] border border-white/12 bg-ink-900 p-2.5 shadow-[0_50px_100px_-30px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.06)_inset] sm:w-[330px]">
        {/* Notch */}
        <div className="absolute left-1/2 top-3.5 z-20 h-5 w-24 -translate-x-1/2 rounded-full bg-ink-950" />

        <div className="relative overflow-hidden rounded-[2.1rem] bg-[#0b141a]">
          {/* WhatsApp doodle wallpaper */}
          <div
            className="absolute inset-0 opacity-[0.045]"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1.2'%3E%3Ccircle cx='20' cy='20' r='6'/%3E%3Cpath d='M50 14h14v10H56l-4 5v-5h-2z'/%3E%3Cpath d='M12 56l6-6 6 6-6 6z'/%3E%3Ccircle cx='62' cy='60' r='7'/%3E%3C/g%3E%3C/svg%3E\")",
            }}
          />

          {/* Header */}
          <div className="relative flex items-center gap-3 border-b border-black/30 bg-[#202c33] px-4 pb-3 pt-9">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mint-400 to-emerald-700 text-[13px] font-bold text-ink-950">
              B
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#202c33] bg-mint-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-slate-100">{botName}</p>
              <p className="truncate text-[10.5px] text-mint-400">{typing ? 'typing…' : status}</p>
            </div>
            <Video className="h-4 w-4 text-slate-400" />
            <Phone className="h-4 w-4 text-slate-400" />
          </div>

          {/* Transcript */}
          <div ref={scrollRef} className="scrollbar-none relative h-[430px] space-y-2 overflow-y-auto px-3 py-4">
            <div className="mb-3 flex justify-center">
              <span className="rounded-md bg-[#182229] px-2.5 py-1 text-[9.5px] font-medium uppercase tracking-wider text-slate-500">
                Today
              </span>
            </div>

            <AnimatePresence initial={false}>
              {visible.map((turn, index) => (
                <motion.div
                  key={`${index}-${turn.text}`}
                  initial={{ opacity: 0, y: 10, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                  className={cn('flex', turn.from === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'relative max-w-[82%] rounded-lg px-2.5 py-1.5 text-[12.5px] leading-snug shadow-sm',
                      turn.from === 'user'
                        ? 'rounded-tr-sm bg-[#005c4b] text-slate-100'
                        : 'rounded-tl-sm bg-[#202c33] text-slate-200',
                    )}
                  >
                    <p className="whitespace-pre-wrap">{turn.text}</p>

                    {turn.buttons && (
                      <div className="mt-2 space-y-1 border-t border-white/[0.08] pt-2">
                        {turn.buttons.map((button) => (
                          <div
                            key={button}
                            className="rounded-md bg-white/[0.05] px-2 py-1.5 text-center text-[11.5px] font-medium text-[#53bdeb]"
                          >
                            {button}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-0.5 flex items-center justify-end gap-1">
                      <span className="text-[9px] text-slate-400/70">
                        {new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {turn.from === 'user' &&
                        (index < visible.length - 1 ? (
                          <CheckCheck className="h-2.5 w-2.5 text-[#53bdeb]" />
                        ) : (
                          <Check className="h-2.5 w-2.5 text-slate-400/70" />
                        ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {typing && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                <div className="flex items-center gap-1 rounded-lg rounded-tl-sm bg-[#202c33] px-3 py-2.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-slate-500"
                      animate={{ opacity: [0.3, 1, 0.3], y: [0, -2.5, 0] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.16 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Composer */}
          <div className="relative flex items-center gap-2 bg-[#202c33] px-3 py-2.5">
            <div className="flex-1 rounded-full bg-[#2a3942] px-3 py-1.5 text-[11.5px] text-slate-500">
              Type a message
            </div>
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-mint-500">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-ink-950">
                <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
              </svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating stat chips anchored to the device */}
            <FloatingChip className="-left-6 top-24 sm:-left-16" delay={0.8} label="Response time" value="0.4s" />
            <FloatingChip className="-right-4 bottom-32 sm:-right-14" delay={1.3} label="Resolved by AI" value="73%" tone="violet" />
        </div>
    );
}

function FloatingChip({
    className,
    label,
    value,
    delay = 0,
    tone = 'mint',
}: {
    className?: string;
    label: string;
    value: string;
    delay?: number;
    tone?: 'mint' | 'violet';
}) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={cn('absolute hidden animate-float lg:block', className)}
            style={{ animationDelay: `${delay}s` }}
        >
      <div className="rounded-xl border border-white/10 bg-ink-850/85 px-3.5 py-2.5 shadow-lift backdrop-blur-xl">
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
        <p className={cn('mt-0.5 font-display text-lg font-bold', tone === 'mint' ? 'text-mint-300' : 'text-violet-300')}>
          {value}
        </p>
      </div>
    </motion.div>
  );
}
