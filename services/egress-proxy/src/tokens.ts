import { createHmac, timingSafeEqual } from "node:crypto";

export type TrialClaims = {
  trial_id: string;
  run_id: string;
  agent_id?: string;
  aud: string;
  exp: number;
};

export function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

/** Service token: HMAC_SHA256(key, "decoyr-service-v1") hex digest. */
export function serviceToken(key: string): string {
  return createHmac("sha256", key).update("decoyr-service-v1").digest("hex");
}

export function verifyServiceToken(key: string, presented: string | undefined | null): boolean {
  if (!presented) return false;
  const expected = Buffer.from(serviceToken(key));
  const got = Buffer.from(presented);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** Mint a trial token (used by tests / tooling; the control plane mints real ones). */
export function signTrialToken(key: string, claims: TrialClaims): string {
  const payload = b64url(JSON.stringify(claims));
  const sig = createHmac("sha256", key).update(`v1.${payload}`).digest();
  return `v1.${payload}.${b64url(sig)}`;
}

export class TokenError extends Error {}

/**
 * Verify `v1.<b64url(claims)>.<b64url(HMAC_SHA256(key, "v1." + b64url(claims)))>`.
 * Checks signature, aud === "sandbox" and exp > now. Throws TokenError.
 */
export function verifyTrialToken(key: string, token: string | undefined | null, nowSeconds = Date.now() / 1000): TrialClaims {
  if (!token) throw new TokenError("missing trial token");
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") throw new TokenError("malformed trial token");
  const [, payload, sig] = parts;
  const expected = createHmac("sha256", key).update(`v1.${payload}`).digest();
  let got: Buffer;
  try {
    got = Buffer.from(sig, "base64url");
  } catch {
    throw new TokenError("malformed signature");
  }
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) throw new TokenError("bad trial token signature");
  let claims: TrialClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new TokenError("malformed claims");
  }
  if (claims.aud !== "sandbox") throw new TokenError("wrong audience");
  if (typeof claims.exp !== "number" || claims.exp <= nowSeconds) throw new TokenError("trial token expired");
  if (!claims.run_id || !claims.trial_id) throw new TokenError("missing run/trial id");
  return claims;
}

export function bearer(header: string | string[] | undefined): string | undefined {
  const h = Array.isArray(header) ? header[0] : header;
  if (!h) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : undefined;
}
