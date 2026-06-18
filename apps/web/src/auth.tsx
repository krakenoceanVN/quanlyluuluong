import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMe, login as apiLogin } from './api/endpoints';
import { tokens } from './api/client';
import type { AuthUser } from './types';

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      if (tokens.access) {
        try {
          const me = await getMe();
          if (active) setUser(me);
        } catch {
          tokens.clear();
        }
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      login: async (u, p) => setUser(await apiLogin(u, p)),
      logout: () => {
        tokens.clear();
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
