import { getWorkspaceAccessToken } from './firebase';

let sessionBearerToken: string | null = null;

export function setSessionBearerToken(token: string | null) {
  sessionBearerToken = token;
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (sessionBearerToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer session:${sessionBearerToken}`);
  }
  const googleToken = getWorkspaceAccessToken();
  if (googleToken && !headers.has('X-Google-Access-Token')) {
    headers.set('X-Google-Access-Token', googleToken);
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || 'Terjadi kesalahan pada server.' };
  }

  if (!res.ok) {
    const errObj = data as { error?: string; requiresGoogleAuth?: boolean } | null;
    const error = new Error(errObj?.error || `HTTP ${res.status}`) as Error & {
      status?: number;
      requiresGoogleAuth?: boolean;
    };
    error.status = res.status;
    error.requiresGoogleAuth = errObj?.requiresGoogleAuth;
    throw error;
  }

  return data as T;
}
