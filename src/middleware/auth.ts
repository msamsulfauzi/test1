import type { NextFunction, Request, Response } from 'express';
import {
  getById,
  insertOne,
  listCollection,
  updateById,
  type UserRow,
} from '../db/firestore-store.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifySessionToken } from '../lib/auth-crypto.ts';

export type DbUser = UserRow;

export interface AuthRequest extends Request {
  dbUser?: DbUser;
}

export async function resolveUserFromRequest(req: Request): Promise<DbUser | null> {
  const cookieToken = req.cookies?.bimtek_session as string | undefined;
  const authHeader = req.headers.authorization;
  let sessionToken = cookieToken;

  if (authHeader?.startsWith('Bearer session:')) {
    sessionToken = authHeader.slice('Bearer session:'.length).trim();
  }

  if (sessionToken) {
    const payload = verifySessionToken(sessionToken);
    if (payload) {
      const found = await getById<UserRow>('users', payload.userId);
      if (found) return found;
    }
  }

  if (authHeader?.startsWith('Bearer ') && !authHeader.startsWith('Bearer session:')) {
    const idToken = authHeader.slice('Bearer '.length).trim();
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      const email = (decoded.email || '').toLowerCase();
      if (!email) return null;

      const allUsers = await listCollection<UserRow>('users');
      const existingByEmail = allUsers.find((u) => u.email === email);
      if (existingByEmail) {
        return existingByEmail;
      }

      const existingByUid = allUsers.find((u) => u.uid === decoded.uid);
      if (existingByUid) {
        return await updateById<UserRow>('users', existingByUid.id, { email });
      }

      return await insertOne<UserRow>('users', {
        uid: decoded.uid,
        email,
        passwordHash: null,
        fullName: decoded.name || email.split('@')[0],
        phone: '',
        jabatan: '',
        lpseLocation: '',
        role: 'peserta',
        accountStatus: 'pending',
        verifiedBy: null,
        verifiedAt: null,
        createdAt: new Date(),
      });
    } catch {
      return null;
    }
  }

  return null;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
    }
    req.dbUser = user;
    next();
  } catch (error) {
    console.error('Auth middleware failed:', error);
    return res.status(401).json({ error: 'Sesi autentikasi tidak valid.' });
  }
};

export const requireRole = (...roles: Array<'admin' | 'pic' | 'peserta'>) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      return res.status(401).json({ error: 'Silakan login terlebih dahulu.' });
    }
    if (!roles.includes(req.dbUser.role as 'admin' | 'pic' | 'peserta')) {
      return res.status(403).json({
        error: 'Anda tidak memiliki hak akses untuk fitur ini.',
      });
    }
    next();
  };
};
