"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import AuthModal from "./AuthModal";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  mobile: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string;
}

type AuthMode = "signin" | "signup";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  openAuth: (mode?: AuthMode, afterAuth?: () => void) => void;
  closeAuth: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [afterAuth, setAfterAuth] = useState<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (!cancelled) {
          setUser(data?.user ?? null);

          // Links like /?auth=signup (e.g. the "no account yet" email) open
          // the sign-up / sign-in window for signed-out visitors.
          const params = new URLSearchParams(window.location.search);
          const requested = params.get("auth");
          if (requested === "signup" || requested === "signin") {
            params.delete("auth");
            const query = params.toString();
            window.history.replaceState(
              null,
              "",
              `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`
            );
            if (!data?.user) {
              setMode(requested);
              setAuthOpen(true);
            }
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const openAuth = useCallback(
    (nextMode: AuthMode = "signin", callback?: () => void) => {
      setMode(nextMode);
      setAfterAuth(() => callback || null);
      setAuthOpen(true);
    },
    []
  );

  const closeAuth = useCallback(() => {
    setAuthOpen(false);
    setAfterAuth(null);
  }, []);

  const handleAuthenticated = useCallback(
    (nextUser: AuthUser) => {
      setUser(nextUser);
      setAuthOpen(false);
      const callback = afterAuth;
      setAfterAuth(null);

      window.setTimeout(() => {
        callback?.();
      }, 0);
    },
    [afterAuth]
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
    });
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        openAuth,
        closeAuth,
        logout,
      }}
    >
      {children}
      <AuthModal
        open={authOpen}
        mode={mode}
        onClose={closeAuth}
        onModeChange={setMode}
        onAuthenticated={handleAuthenticated}
      />
    </AuthContext.Provider>
  );
}
