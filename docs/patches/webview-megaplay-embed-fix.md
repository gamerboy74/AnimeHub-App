# Fix: WebView Cannot Load megaplay.buzz Embed

**Date:** 2026-05-18  
**Affected file:** `app/watch/[id].tsx`  
**Symptom:** Embedded player at `https://megaplay.buzz/stream/s-2/...` fails to load / shows blank screen in the React Native WebView.

---

## Root Causes & Fixes

### Fix 1 — Wrong User-Agent prop (CRITICAL)

`applicationNameForUserAgent` **appends** to the existing Android UA rather than replacing it.  
Result: the UA becomes `"Dalvik/2.1.0 (Linux; Android ...) Mozilla/5.0 (Macintosh...)"` — a jumbled  
string that megaplay's server identifies as mobile and returns a broken/different page.

**Wrong:**
```tsx
applicationNameForUserAgent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"
```

**Correct — use `userAgent` to fully replace:**
```tsx
userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
```

---

### Fix 2 — Iframe escape logic causes infinite redirect loop

The injected JS checked for `<iframe src="...megaplay...">` and called `window.location.replace(iframe.src)`.  
Problem: megaplay's own player page contains an inner iframe pointing to a different megaplay URL.  
This triggers a redirect → `onShouldStartLoadWithRequest` blocks it (different path/params) → blank screen.

**Remove this block from `buildInjectedJS`:**
```js
// DELETE THIS — causes infinite redirect on megaplay
var iframe = document.querySelector('iframe');
if (iframe && iframe.src && (iframe.src.includes('megaplay') || iframe.src.includes('cinewave'))) {
  window.location.replace(iframe.src);
  return;
}
```

**Replace with just:**
```js
window.open = function() { return null; };
window.alert = function() {};
```

---

### Fix 3 — CDN allowlist too narrow; missing media delivery providers

Megaplay delivers HLS segments via BunnyCDN, Fastly, Akamai etc. Add them to `ALLOWED_CDNS`:

```ts
const ALLOWED_CDNS = [
  // megaplay & megacloud
  'megaplay.buzz', 'megacloud.tv', 'megacloud.club',
  // cinewave variants
  'cinewave2.site', 'cinewave.site', 'cinecloud.site',
  // JWPlayer CDN
  'jwplatform.com', 'jwpcdn.com', 'jwplayer.com',
  // Common JS/font CDNs
  'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com',
  // Cloudflare
  'cloudflare.com', 'cloudflarestream.com', 'cloudflareinsights.com',
  // Google (fonts, analytics)
  'googleapis.com', 'gstatic.com', 'google.com',
  // jQuery, Bootstrap
  'jquery.com', 'bootstrapcdn.com',
  // Major CDN providers megaplay uses for HLS delivery
  'bunnycdn.com', 'b-cdn.net', 'fastly.net',
  'akamaized.net', 'akamai.net',
  'edgesuite.net', 'edgekey.net',
];
// Use exact match OR endsWith subdomain check — not just endsWith alone
if (ALLOWED_CDNS.some(d => reqHost === d || reqHost.endsWith('.' + d))) return true;

// Also allow ALL media file extensions regardless of CDN domain
if (/\.(m3u8|m3u|mp4|ts|webm|aac|mp3|m4s|m4v|m4a)(\?|$)/i.test(url)) return true;
```

---

## Summary Checklist (when adding a new embed source)

- [ ] Use `userAgent` prop (not `applicationNameForUserAgent`) with a desktop Chrome UA
- [ ] Do NOT add iframe-redirect logic in injected JS — it breaks same-domain embeds
- [ ] Add the embed's CDN domains to `ALLOWED_CDNS`
- [ ] Always allow `.m3u8` / `.ts` / `.mp4` for any domain (HLS segments can come from any CDN)
