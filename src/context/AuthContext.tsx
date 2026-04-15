import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { loginRequest, registerRequest } from "@/lib/auth-api";

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
  login: (values: LoginInput) => Promise<{ success: boolean; message: string }>;
  register: (values: RegisterInput) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
};

const STORAGE_AUTH_TOKEN_KEY = "gestion-parking-auth-token";
const STORAGE_CURRENT_USER_KEY = "gestion-parking-current-user";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStoredUser(): AuthUser | null {
  const stored = sessionStorage.getItem(STORAGE_CURRENT_USER_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUser(readStoredUser());
    setIsLoading(false);
  }, []);

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

      sessionStorage.setItem(STORAGE_AUTH_TOKEN_KEY, response.accessToken);
      sessionStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(nextUser));
      setUser(nextUser);

      return { success: true, message: response.message || "Compte cree avec succes." };
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

      sessionStorage.setItem(STORAGE_AUTH_TOKEN_KEY, response.accessToken);
      sessionStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(nextUser));
      setUser(nextUser);

      return { success: true, message: response.message || "Connexion reussie." };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Connexion impossible pour le moment.",
      };
    }
  };

  const logout = () => {
    sessionStorage.removeItem(STORAGE_AUTH_TOKEN_KEY);
    sessionStorage.removeItem(STORAGE_CURRENT_USER_KEY);
    setUser(null);
  };

  const value = {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    login,
    register,
    logout,
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

export function getAccessToken() {
  return sessionStorage.getItem(STORAGE_AUTH_TOKEN_KEY);
}
