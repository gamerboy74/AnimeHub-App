import { useState, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
export type ServerLang = 'sub' | 'dub';

export interface Server {
  name: string;
  url: string;
  lang?: ServerLang;
}

export interface ServerSelectionResult {
  /** Full flat server list (all langs) — filtered to 1 for free users */
  servers: Server[];
  /** Servers grouped by language — grouped['sub'] | grouped['dub'] */
  grouped: Record<ServerLang, Server[]>;
  /** Langs that actually have at least one server, in preferred order */
  availableLangs: ServerLang[];
  /** Currently selected language tab */
  lang: ServerLang;
  /** Index within the filtered (current lang) server list */
  index: number;
  /** Servers for the currently selected language */
  filteredServers: Server[];
  /** Ready-to-use embed URL for the WebView */
  embedUrl: string;
  /** Human-readable label e.g. "HD-2 · SUB" for the HUD chip */
  label: string;
  /** True when additional servers exist but the user is on the free plan */
  isServerLocked: boolean;
  /** Select a language tab — always resets server index to 0 */
  selectLang: (lang: ServerLang) => void;
  /** Select a server by its index within filteredServers */
  selectServer: (index: number) => void;
  /** Reset to defaults — call on episode change */
  reset: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
/**
 * Encapsulates all server / language selection state for the player.
 *
 * Usage:
 *   const srv = useServerSelection(episode?.video_servers, episode?.video_url);
 *   // WebView:  source={{ uri: srv.embedUrl }}
 *   // HUD chip: <Text>{srv.label}</Text>  →  "HD-2 · SUB"
 */
export function useServerSelection(
  rawServers: unknown,
  fallbackUrl?: string | null,
  isPremium = false,
): ServerSelectionResult {
  const [lang, setLang] = useState<ServerLang>('sub');
  const [index, setIndex] = useState(0);

  // ── Normalise raw input ──────────────────────────────────────────────────
  // Accepts the video_servers JSONB column (any[]) or falls back to video_url.
  // Both legacy { name, url } and new { name, url, lang } shapes are handled.
  // Free users are limited to the first server only (Server 1).
  const servers = useMemo<Server[]>(() => {
    let all: Server[];
    if (Array.isArray(rawServers) && rawServers.length > 0) {
      all = (rawServers as Server[]).map((s) => ({
        name: s.name ?? 'Server',
        url:  s.url  ?? '',
        lang: (((s as any).lang === 'dub' || (s as any).lang === 'dubbed') ? 'dub' : 'sub') as ServerLang,
      }));
    } else {
      const fallback = fallbackUrl?.trim();
      all = fallback ? [{ name: 'Server 1', url: fallback, lang: 'sub' }] : [];
    }
    // Free plan: cap to the very first server
    return isPremium ? all : all.slice(0, 1);
  }, [rawServers, fallbackUrl, isPremium]);

  // ── Group by language ───────────────────────────────────────────────────
  const grouped = useMemo<Record<ServerLang, Server[]>>(() => {
    const g: Record<ServerLang, Server[]> = { sub: [], dub: [] };
    for (const s of servers) g[s.lang ?? 'sub'].push(s);
    return g;
  }, [servers]);

  // ── Available langs in preferred order ──────────────────────────────────
  const availableLangs = useMemo<ServerLang[]>(
    () => (['sub', 'dub'] as ServerLang[]).filter((l) => grouped[l].length > 0),
    [grouped],
  );

  // ── Derived values ───────────────────────────────────────────────────────
  const filteredServers = grouped[lang] ?? [];
  const currentServer   = filteredServers[index] ?? filteredServers[0];
  const embedUrl        = currentServer?.url?.trim() ?? '';
  const label           = currentServer
    ? `${currentServer.name} · ${lang.toUpperCase()}`
    : '';

  // True when the episode has more than one server but the user is on free plan.
  // The watch screen uses this to show an upgrade prompt instead of the picker.
  const isServerLocked = !isPremium && (
    Array.isArray(rawServers)
      ? (rawServers as Server[]).length > 1
      : false
  );

  // ── Actions ──────────────────────────────────────────────────────────────
  function selectLang(newLang: ServerLang) {
    setLang(newLang);
    setIndex(0);
  }

  function selectServer(i: number) {
    setIndex(i);
  }

  function reset() {
    setLang('sub');
    setIndex(0);
  }

  return {
    servers,
    grouped,
    availableLangs,
    lang,
    index,
    filteredServers,
    embedUrl,
    label,
    isServerLocked,
    selectLang,
    selectServer,
    reset,
  };
}
