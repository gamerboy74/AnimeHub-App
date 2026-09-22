/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Base
        bg: '#08090D',
        bgCard: '#10121A',
        bgElevated: '#161924',
        
        // Legacy aliases for components
        'bg-card': '#10121A',
        'bg-elevated': '#161924',

        // Accents
        neon: '#FF2B3C',
        neonPink: '#FF4757',
        neonCyan: '#38BDF8',
        neonGold: '#FFB800',
        
        primary: '#FF2B3C',
        secondary: '#FF4757',
        accent: '#FF2B3C',
        premium: '#FFB800',

        // Text
        text: '#F8F9FD',
        textSub: '#9DA4B4',
        textMuted: '#5F667A',
        
        textMain: '#F8F9FD',
        'text-sub': '#9DA4B4',
        'text-muted': '#5F667A',

        // Borders
        border: 'rgba(255, 43, 60, 0.15)',
        borderDim: 'rgba(255, 255, 255, 0.08)',
        borderBright: 'rgba(255, 43, 60, 0.55)',
        
        'border-dim': 'rgba(255, 255, 255, 0.08)',
        'border-bright': 'rgba(255, 43, 60, 0.55)',

        // Status
        success: '#00E676',
        danger: '#FF2B3C',
        warning: '#FFB800',
      },
      fontFamily: {
        display: ['SpaceGrotesk'],
        body: ['BeVietnamPro'],
      },
    },
  },
  plugins: [],
}
