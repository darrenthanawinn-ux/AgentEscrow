import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#05070d',
        panel: '#0a0f1a',
        edge: '#1b2638',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      keyframes: {
        pulseGlow: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(34,211,238,0.35)' },
          '50%': { boxShadow: '0 0 0 6px rgba(34,211,238,0)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        pulseGlow: 'pulseGlow 1.8s ease-in-out infinite',
        fadeUp: 'fadeUp 0.25s ease-out both',
      },
    },
  },
  plugins: [],
};
export default config;
