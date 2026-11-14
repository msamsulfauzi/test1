import crypto from 'node:crypto';

const getSigningSecret = () =>
  process.env.SESSION_SECRET ||
  process.env.SQL_PASSWORD ||
  'portal-bimtek-lpse-session-key-2026';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const candidate = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (candidate.length !== original.length) return false;
  return crypto.timingSafeEqual(candidate, original);
}

export interface SessionPayload {
  userId: number;
  role: string;
  email: string;
  exp: number;
}

export function signSessionToken(
  payload: Omit<SessionPayload, 'exp'>,
  ttlMs = 7 * 24 * 60 * 60 * 1000
): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + ttlMs,
  };
  const body = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expectedSig = crypto
      .createHmac('sha256', getSigningSecret())
      .update(body)
      .digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.userId || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
