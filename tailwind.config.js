/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Base
        bg: '#080810',
        bgCard: '#0E0E1A',
        bgElevated: '#13131F',
        
        // Legacy aliases for components
        'bg-card': '#0E0E1A',
        'bg-elevated': '#13131F',

        // Accents
        neon: '#BF5FFF',
        neonPink: '#FF2D78',
        neonCyan: '#00F5FF',
        neonGold: '#FFD600',
        
        primary: '#BF5FFF',
        secondary: '#FF2D78',
        accent: '#BF5FFF',
        premium: '#FFD600',

        // Text
        text: '#F0EEFF',
        textSub: '#8A87A8',
        textMuted: '#4A4766',
        
        textMain: '#F0EEFF',
        'text-sub': '#8A87A8',
        'text-muted': '#4A4766',

        // Borders
        border: 'rgba(191,95,255,0.2)',
        borderDim: 'rgba(191,95,255,0.1)',
        borderBright: 'rgba(191,95,255,0.6)',
        
        'border-dim': 'rgba(191,95,255,0.1)',
        'border-bright': 'rgba(191,95,255,0.6)',

        // Status
        success: '#00F5B4',
        danger: '#FF2D78',
        warning: '#FFD600',
      },
      fontFamily: {
        display: ['SpaceGrotesk'],
        body: ['BeVietnamPro'],
      },
    },
  },
  plugins: [],
}
