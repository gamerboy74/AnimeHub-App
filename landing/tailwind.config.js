/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#08090D',
        surface: {
          DEFAULT: '#0E1117',
          elevated: '#141722',
          card: 'rgba(18, 22, 33, 0.7)',
          border: 'rgba(255, 255, 255, 0.08)',
        },
        primary: {
          DEFAULT: '#FF2B3C',
          hover: '#FF4757',
          glow: 'rgba(255, 43, 60, 0.35)',
          muted: 'rgba(255, 43, 60, 0.15)',
        },
        secondary: {
          DEFAULT: '#8A2BE2',
          glow: 'rgba(138, 43, 226, 0.3)',
        },
        accent: {
          DEFAULT: '#00F0FF',
          glow: 'rgba(0, 240, 255, 0.25)',
        },
        foreground: '#F8FAFC',
        muted: '#94A3B8',
        subtle: '#64748B',
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-crimson': '0 0 35px -5px rgba(255, 43, 60, 0.45)',
        'glow-crimson-lg': '0 0 60px -10px rgba(255, 43, 60, 0.55)',
        'glow-purple': '0 0 35px -5px rgba(138, 43, 226, 0.35)',
        'glow-cyan': '0 0 35px -5px rgba(0, 240, 255, 0.3)',
        'card-glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
