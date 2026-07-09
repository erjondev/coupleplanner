/**
 * Contexte d'authentification avec session persistée.
 * Le token est stocké de façon sécurisée (Keychain/Keystore, localStorage web)
 * et rechargé au démarrage pour rester connecté entre les lancements.
 */
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthSession, AuthUser, Partner, SignupPayload } from '../types';
import {
  login as apiLogin,
  signup as apiSignup,
  getMe,
  setAuthToken,
} from './api';
import { clearToken, loadToken, saveToken } from './storage';

interface AuthContextValue {
  user: AuthUser | null;
  partner: Partner | null;
  /** Code à partager au partenaire (présent tant qu'il n'a pas rejoint). */
  inviteCode: string | null;
  /** true pendant la restauration de session au démarrage. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: SignupPayload) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applySessionState = (session: AuthSession) => {
    setUser(session.user);
    setPartner(session.partner);
    setInviteCode(session.couple.inviteCode);
  };

  // Restauration au démarrage : token stocké -> /me pour reconstruire la session
  useEffect(() => {
    (async () => {
      try {
        const token = await loadToken();
        if (token) {
          setAuthToken(token);
          applySessionState(await getMe()); // 401 si token expiré -> catch
        }
      } catch {
        // Token invalide/expiré ou backend injoignable : on repart déconnecté
        setAuthToken(null);
        await clearToken();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = async (session: AuthSession & { token: string }) => {
    setAuthToken(session.token);
    await saveToken(session.token);
    applySessionState(session);
  };

  const signIn = async (email: string, password: string) => {
    await persist(await apiLogin(email, password));
  };

  const signUp = async (payload: SignupPayload) => {
    await persist(await apiSignup(payload));
  };

  const signOut = async () => {
    setAuthToken(null);
    setUser(null);
    setPartner(null);
    setInviteCode(null);
    await clearToken();
  };

  return (
    <AuthContext.Provider
      value={{ user, partner, inviteCode, loading, signIn, signUp, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
