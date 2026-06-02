/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep space canvas - everything sits on ink, lifted by glass surfaces.
        ink: {
          950: '#04060d',
          900: '#070b16',
          850: '#0a0f1e',
          800: '#0e1526',
          700: '#141d33',
          600: '#1d2842',
          500: '#2a3654',
        },
        mint: {
          50: '#eafff5',
          100: '#c8ffe6',
          200: '#8effcd',
          300: '#4dfbb1',
          400: '#1fe89a',
          500: '#00d47f',
          600: '#00ab68',
          700: '#008552',
          800: '#016842',
          900: '#025637',
        },
        electric: {
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
        },
        violet: {
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Sora', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(to bottom, transparent, #04060d), linear-gradient(to right, rgba(148,163,184,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.07) 1px, transparent 1px)',
        'aurora':
          'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,212,127,0.25), transparent), radial-gradient(ellipse 60% 50% at 80% 50%, rgba(139,92,246,0.18), transparent), radial-gradient(ellipse 50% 40% at 10% 60%, rgba(14,165,233,0.16), transparent)',
        'sheen': 'linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.12) 50%, transparent 75%)',
      },
      backgroundSize: {
        'grid': '100% 100%, 56px 56px, 56px 56px',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(0,212,127,0.18), 0 12px 48px -12px rgba(0,212,127,0.45)',
        'glow-violet': '0 0 0 1px rgba(139,92,246,0.2), 0 12px 48px -12px rgba(139,92,246,0.5)',
        lift: '0 24px 64px -24px rgba(0,0,0,0.8), 0 1px 0 0 rgba(255,255,255,0.04) inset',
        panel: '0 1px 0 0 rgba(255,255,255,0.05) inset, 0 20px 50px -30px rgba(0,0,0,0.9)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-14px)' },
        },
                'float-slow': {
                    '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
                    '50%': { transform: 'translateY(-24px) rotate(2deg)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                'pulse-ring': {
                    '0%': { transform: 'scale(0.8)', opacity: '0.7' },
                    '80%, 100%': { transform: 'scale(2)', opacity: '0' },
                },
                'dash-flow': {
                    to: { strokeDashoffset: '-24' },
                },
                marquee: {
                    from: { transform: 'translateX(0)' },
                    to: { transform: 'translateX(-50%)' },
                },
                'gradient-pan': {
                    '0%, 100%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                },
                'fade-up': {
                    from: { opacity: '0', transform: 'translateY(12px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
            },
            animation: {
                float: 'float 6s ease-in-out infinite',
                'float-slow': 'float-slow 11s ease-in-out infinite',
                shimmer: 'shimmer 2.4s linear infinite',
                'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'dash-flow': 'dash-flow 0.8s linear infinite',
                marquee: 'marquee 38s linear infinite',
                'gradient-pan': 'gradient-pan 8s ease infinite',
                'fade-up': 'fade-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
            },
        },
    },
    plugins: [],
};
