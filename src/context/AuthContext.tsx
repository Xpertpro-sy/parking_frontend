import { createContext, ReactNode, useContext, useEffect, useState } from "react";

type AuthUser = {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type StoredAccount = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  name?: string;
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
  login: (values: LoginInput) => { success: boolean; message: string };
  register: (values: RegisterInput) => { success: boolean; message: string };
  logout: () => void;
};

const STORAGE_USERS_KEY = "gestion-parking-users";
const STORAGE_CURRENT_USER_KEY = "gestion-parking-current-user";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function readStoredUsers(): StoredAccount[] {
  const stored = localStorage.getItem(STORAGE_USERS_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as StoredAccount[];
  } catch {
    return [];
  }
}

function readStoredUser(): AuthUser | null {
  const stored = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(readStoredUser());
  }, []);

  const register = ({ firstName, lastName, email, phone, password }: RegisterInput) => {
    const normalizedEmail = email.trim().toLowerCase();
    const accounts = readStoredUsers();
    const exists = accounts.some((account) => account.email.toLowerCase() === normalizedEmail);

    if (exists) {
      return { success: false, message: "Un compte existe deja avec cet email." };
    }

    const nextAccount: StoredAccount = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      password,
    };
    const nextAccounts = [...accounts, nextAccount];
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(nextAccounts));

    const nextUser: AuthUser = {
      name: `${nextAccount.firstName} ${nextAccount.lastName}`.trim(),
      firstName: nextAccount.firstName,
      lastName: nextAccount.lastName,
      email: nextAccount.email,
      phone: nextAccount.phone,
    };
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);

    return { success: true, message: "Compte cree avec succes." };
  };

  const login = ({ email, password }: LoginInput) => {
    const normalizedEmail = email.trim().toLowerCase();
    const account = readStoredUsers().find(
      (storedAccount) =>
        storedAccount.email.toLowerCase() === normalizedEmail && storedAccount.password === password,
    );

    if (!account) {
      return { success: false, message: "Email ou mot de passe invalide." };
    }

    const firstName = account.firstName ?? "";
    const lastName = account.lastName ?? "";
    const fallbackName = account.name ?? "";
    const fullName = `${firstName} ${lastName}`.trim() || fallbackName;

    const nextUser: AuthUser = {
      name: fullName,
      firstName,
      lastName,
      email: account.email,
      phone: account.phone ?? "",
    };
    localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);

    return { success: true, message: "Connexion reussie." };
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
    setUser(null);
  };

  const value = {
    user,
    isAuthenticated: Boolean(user),
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
