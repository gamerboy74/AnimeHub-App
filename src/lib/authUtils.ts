/**
 * src/lib/authUtils.ts
 *
 * Helpers for OAuth deep links, PKCE code extraction, and token parsing.
 */

export interface OAuthParams {
  type?: 'pkce' | 'hash' | 'error';
  code?: string;
  state?: string;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
  errorDescription?: string;
}

/**
 * Extracts PKCE authorization code, implicit grant tokens, or error details
 * from an OAuth redirect URL or query string.
 */
export function extractOAuthParams(url: string | null | undefined): OAuthParams {
  if (!url) return {};

  // 1. Check hash for access_token / refresh_token (Implicit flow)
  if (url.includes('#')) {
    const hashPart = url.split('#')[1] || '';
    const hashParams = new URLSearchParams(hashPart);
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    if (accessToken && refreshToken) {
      return {
        type: 'hash',
        accessToken,
        refreshToken,
      };
    }
  }

  // 2. Check query string for code or error (PKCE flow)
  const codeMatch = url.match(/[?&]code=([^&#]+)/);
  const stateMatch = url.match(/[?&]state=([^&#]+)/);
  const errorMatch = url.match(/[?&]error=([^&#]+)/);
  const errorDescMatch = url.match(/[?&]error_description=([^&#]+)/);

  if (codeMatch && codeMatch[1]) {
    return {
      type: 'pkce',
      code: decodeURIComponent(codeMatch[1]),
      state: stateMatch ? decodeURIComponent(stateMatch[1]) : undefined,
    };
  }

  if (errorMatch && errorMatch[1]) {
    return {
      type: 'error',
      error: decodeURIComponent(errorMatch[1]),
      errorDescription: errorDescMatch ? decodeURIComponent(errorDescMatch[1]) : undefined,
    };
  }

  // If passed just the raw code without query prefix
  if (!url.includes('://') && !url.includes('?') && !url.includes('&') && url.length > 10) {
    return {
      type: 'pkce',
      code: url,
    };
  }

  return {};
}
