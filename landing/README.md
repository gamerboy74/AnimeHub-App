# AnimeHub Mobile — Landing Page & APK Download Showcase

A modern, responsive showcase landing page for the **AnimeHub Android Mobile App**.

Built with:
- **Vite 6 / 8** + **React 19** + **TypeScript**
- **Tailwind CSS** (Cyber-Cinematic Dark Palette: `#08090D`, Crimson `#FF2B3C`, Neon Cyan `#00F0FF`, Purple `#9D4EDD`)
- **Shadcn UI Architecture** (Card, Button, Badge, Tabs, Accordion, Dialog)
- **Lucide Icons**
- **Interactive 3D Phone Mockup** with live screen tabs (Player HUD, Discovery Feed, Offline Vault)
- **Direct APK Download Hub** with QR Code generator, SHA-256 Checksum, and Step-by-Step Android Installation Guide
- **Canvas Confetti** download celebration

---

## 🚀 Getting Started

### Development
From the root of `Animehub-App`:
```bash
npm run landing:dev
```
Or directly inside `landing/`:
```bash
cd landing
npm run dev
```

### Production Build
```bash
npm run landing:build
```
The optimized production bundle will be generated in `landing/dist/`.

---

## 🌐 1-Click Deployment

### Deploy to Vercel
1. Set Root Directory to `landing`
2. Build Command: `npm run build`
3. Output Directory: `dist`

### Deploy to Netlify
1. Base directory: `landing`
2. Build command: `npm run build`
3. Publish directory: `landing/dist`
