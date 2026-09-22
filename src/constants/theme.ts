export const COLORS = {
  // Deep Japanese Sumi / Obsidian Dark Canvas
  bg: '#08090D',
  bgCard: '#10121A',
  bgElevated: '#161924',
  bgGlass: 'rgba(16, 18, 26, 0.88)',

  // Signature AnimeHub Brand: Luffy Straw Hat Crimson & Sun Red
  primary: '#FF2B3C',
  primaryDark: '#D61A2A',
  primaryGlow: 'rgba(255, 43, 60, 0.45)',

  // Action Accents
  neon: '#FF2B3C',        // Crimson Sun Red (Primary action, active tabs, highlights)
  neonPink: '#FF4757',    // Vibrant Scarlet / Notification badge pulse
  neonCyan: '#38BDF8',    // Sky Ice / Category & Tech highlight
  neonGold: '#FFB800',    // Straw Hat Amber / VIP Gold
  neonPulse: '#FF2B3C',   // Signature Crimson pulse

  accent: '#FF2B3C',      // Crimson brand accent
  accentAlt: '#FF4757',   // Secondary coral scarlet

  // Clean Sail White & Slate Typography
  text: '#F8F9FD',        // Crisp white
  textSub: '#9DA4B4',     // Balanced slate gray
  textMuted: '#5F667A',   // Subtle muted ink

  // Precise Borders & Overlays
  border: 'rgba(255, 43, 60, 0.15)',
  borderBright: 'rgba(255, 43, 60, 0.55)',
  borderNeutral: 'rgba(255, 255, 255, 0.08)',

  // Functional & Semantic States
  premium: '#FFB800',     // Straw Hat Gold
  success: '#00E676',     // Crisp Emerald
  danger: '#FF2B3C',      // Crimson alert

  // Consistent Semantic Tint Overlays
  primaryTint: 'rgba(255, 43, 60, 0.12)',
  primaryTintSubtle: 'rgba(255, 43, 60, 0.06)',
  neonPinkTint: 'rgba(255, 71, 87, 0.12)',
  neonCyanTint: 'rgba(56, 189, 248, 0.12)',
  neonGoldTint: 'rgba(255, 184, 0, 0.12)',

  overlay: 'rgba(8, 9, 13, 0.85)',
};

export const FONTS = {
  display: 'SpaceGrotesk', // Matching our loaded font
  body: 'BeVietnamPro',
  mono: 'monospace',
};

export const RADIUS = {
  sm: 6,
  md: 12,
  lg: 20,
  xl: 32,
  full: 9999,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const SHADOWS = {
  neon: {
    shadowColor: '#FF2B3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 10,
  },
  pink: {
    shadowColor: '#FF4757',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
  },
  crimson: {
    shadowColor: '#FF2B3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  gold: {
    shadowColor: '#FFB800',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
};

export const TOUCH = {
  minSize: 44,
  hitSlop: { top: 10, bottom: 10, left: 10, right: 10 },
  hitSlopLg: { top: 14, bottom: 14, left: 14, right: 14 },
};

