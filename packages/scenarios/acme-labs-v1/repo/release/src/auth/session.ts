const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export function shouldRefresh(expiresAt: number, now = Date.now()) {
  return expiresAt - now < REFRESH_MARGIN_MS;
}
