import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Layered ambient background: a fixed dot grid, three drifting colour orbs, and
 * a canvas particle field. All decorative - pointer-events are off throughout.
 */
export function Backdrop({ className }: { className?: string }) {
  return (
    <div className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)} aria-hidden>
      <GridField />
      <Orbs />
      <ParticleField />
      <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-ink-950 to-transparent" />
    </div>
  );
}

function GridField() {
  return (
    <div
      className="absolute inset-0 opacity-[0.55]"
      style={{
        backgroundImage:
          'radial-gradient(circle at center, rgba(148,163,184,0.16) 1px, transparent 1px)',
        backgroundSize: '38px 38px',
        // Fades the grid out toward the edges so it never reads as a hard texture.
        maskImage: 'radial-gradient(ellipse 75% 60% at 50% 30%, black 20%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse 75% 60% at 50% 30%, black 20%, transparent 75%)',
      }}
    />
  );
}

function Orbs() {
  return (
    <>
      <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] animate-float-slow rounded-full bg-mint-500/[0.13] blur-[120px]" />
      <div
        className="absolute -right-32 top-32 h-[30rem] w-[30rem] animate-float-slow rounded-full bg-violet-500/[0.11] blur-[130px]"
        style={{ animationDelay: '-4s' }}
      />
      <div
        className="absolute bottom-0 left-1/3 h-[26rem] w-[26rem] animate-float-slow rounded-full bg-electric-500/[0.09] blur-[110px]"
        style={{ animationDelay: '-8s' }}
      />
    </>
  );
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
}

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Honour the OS motion preference - render one static frame instead.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let frame = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Density scales with viewport but stays bounded on huge displays.
      const count = Math.min(70, Math.round((width * height) / 26_000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: Math.random() * 1.6 + 0.5,
        a: Math.random() * 0.4 + 0.15,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        // Wrap at the edges so the field never thins out.
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        if (p.y > height + 10) p.y = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(77, 251, 177, ${p.a})`;
        ctx.fill();
      }

      // Link nearby particles into a faint constellation.
      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist > 128) continue;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(77, 251, 177, ${(1 - dist / 128) * 0.09})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }

      if (!reduced) frame = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-70" />;
}

/** Slim decorative variant for inner app pages. */
export function SubtleBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute -left-56 -top-56 h-[30rem] w-[30rem] rounded-full bg-mint-500/[0.06] blur-[140px]" />
      <div className="absolute -right-56 top-1/3 h-[26rem] w-[26rem] rounded-full bg-violet-500/[0.05] blur-[140px]" />
    </div>
  );
}
