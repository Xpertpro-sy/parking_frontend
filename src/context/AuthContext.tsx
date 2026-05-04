import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { loginRequest, logoutRequest, registerRequest } from "@/lib/auth-api";
import { STORAGE_AUTH_TOKEN_KEY, STORAGE_CURRENT_USER_KEY } from "@/lib/auth-session";
import { waitForFirebaseUser } from "@/lib/firebase";

type AuthUser = {
  userId: number;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type AuthContextType = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (values: LoginInput) => Promise<{ success: boolean; message: string; role?: string }>;
  register: (values: RegisterInput) => Promise<{ success: boolean; message: string; role?: string }>;
  logout: () => void;
  /** Met à jour le nom / prénom en session après modification du profil (sans relancer la connexion). */
  applyLocalUserPatch: (patch: { firstName: string; lastName: string }) => void;
};

const REACT_QUERY_PERSIST_KEY = "gestion-parking-react-query-cache-v1";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStoredUser(): AuthUser | null {
  const localStored = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
  if (localStored) {
    try {
      return JSON.parse(localStored) as AuthUser;
    } catch {
      return null;
    }
  }

  // Migration douce: restaure une session existante stockee auparavant dans sessionStorage.
  const stored = sessionStorage.getItem(STORAGE_CURRENT_USER_KEY);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored) as AuthUser;
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, stored);
    sessionStorage.removeItem(STORAGE_CURRENT_USER_KEY);
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const storedUser = readStoredUser();
      if (!storedUser) {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
        return;
      }

      const firebaseUser = await waitForFirebaseUser();
      if (cancelled) return;

      if (!firebaseUser) {
        queryClient.clear();
        localStorage.removeItem(REACT_QUERY_PERSIST_KEY);
        localStorage.removeItem(STORAGE_AUTH_TOKEN_KEY);
        localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
        sessionStorage.removeItem(STORAGE_AUTH_TOKEN_KEY);
        sessionStorage.removeItem(STORAGE_CURRENT_USER_KEY);
        setUser(null);
        setIsLoading(false);
        return;
      }

      setUser(storedUser);
      setIsLoading(false);
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  const register = async ({ firstName, lastName, email, phone, password }: RegisterInput) => {
    try {
      const response = await registerRequest({
        nom: lastName.trim(),
        prenom: firstName.trim(),
        email: email.trim().toLowerCase(),
        telephone: phone.trim(),
        password,
      });

      const nextUser: AuthUser = {
        userId: response.userId,
        name: `${response.prenom} ${response.nom}`.trim(),
        firstName: response.prenom,
        lastName: response.nom,
        email: response.email,
        role: response.role,
      };

      queryClient.clear();
      localStorage.removeItem(REACT_QUERY_PERSIST_KEY);
      localStorage.setItem(STORAGE_AUTH_TOKEN_KEY, response.accessToken);
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(nextUser));
      sessionStorage.removeItem(STORAGE_AUTH_TOKEN_KEY);
      sessionStorage.removeItem(STORAGE_CURRENT_USER_KEY);
      setUser(nextUser);

      return { success: true, message: response.message || "Compte cree avec succes.", role: response.role };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Inscription impossible pour le moment.",
      };
    }
  };

  const login = async ({ email, password }: LoginInput) => {
    try {
      const response = await loginRequest({
        email: email.trim().toLowerCase(),
        password,
      });

      const nextUser: AuthUser = {
        userId: response.userId,
        name: `${response.prenom} ${response.nom}`.trim(),
        firstName: response.prenom,
        lastName: response.nom,
        email: response.email,
        role: response.role,
      };

      queryClient.clear();
      localStorage.removeItem(REACT_QUERY_PERSIST_KEY);
      localStorage.setItem(STORAGE_AUTH_TOKEN_KEY, response.accessToken);
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(nextUser));
      sessionStorage.removeItem(STORAGE_AUTH_TOKEN_KEY);
      sessionStorage.removeItem(STORAGE_CURRENT_USER_KEY);
      setUser(nextUser);

      return { success: true, message: response.message || "Connexion reussie.", role: response.role };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Connexion impossible pour le moment.",
      };
    }
  };

  const logout = () => {
    void logoutRequest();
    queryClient.clear();
    localStorage.removeItem(REACT_QUERY_PERSIST_KEY);
    localStorage.removeItem(STORAGE_AUTH_TOKEN_KEY);
    localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
    sessionStorage.removeItem(STORAGE_AUTH_TOKEN_KEY);
    sessionStorage.removeItem(STORAGE_CURRENT_USER_KEY);
    setUser(null);
  };

  const applyLocalUserPatch = ({ firstName, lastName }: { firstName: string; lastName: string }) => {
    setUser((prev) => {
      if (!prev) return prev;
      const fn = firstName.trim();
      const ln = lastName.trim();
      const next: AuthUser = {
        ...prev,
        firstName: fn,
        lastName: ln,
        name: `${fn} ${ln}`.trim() || prev.name,
      };
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(next));
      sessionStorage.removeItem(STORAGE_CURRENT_USER_KEY);
      return next;
    });
  };

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    register,
    logout,
    applyLocalUserPatch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit etre utilise dans AuthProvider.");
  }
  return context;
}
