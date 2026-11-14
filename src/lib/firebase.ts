import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
];

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({ prompt: 'consent' });

let isSigningIn = false;
let cachedAccessToken: string | null = null;
let cachedGoogleEmail: string | null = null;

export const initWorkspaceAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        cachedGoogleEmail = user.email ?? null;
        onAuthFailure?.();
      }
    } else {
      cachedAccessToken = null;
      cachedGoogleEmail = null;
      onAuthFailure?.();
    }
  });
};

export const googleWorkspaceSignIn = async (): Promise<{
  user: User;
  accessToken: string;
  idToken: string;
}> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan token akses Google Workspace.');
    }
    const idToken = await result.user.getIdToken();
    cachedAccessToken = credential.accessToken;
    cachedGoogleEmail = result.user.email ?? null;
    return {
      user: result.user,
      accessToken: cachedAccessToken,
      idToken,
    };
  } finally {
    isSigningIn = false;
  }
};

export const getWorkspaceAccessToken = (): string | null => cachedAccessToken;
export const getWorkspaceEmail = (): string | null => cachedGoogleEmail;

export const googleWorkspaceSignOut = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  cachedGoogleEmail = null;
};
