"use client";

/**
 * Global app state: authentication (user + JWT), the active student,
 * and the current paper. Persists to localStorage.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  TOKEN_KEY,
  USER_KEY,
  fetchMe,
  loginUser,
  registerUser,
  type LoginPayload,
  type RegisterPayload,
} from "@/lib/api";
import type { GeneratedPaper, Student, User, UserRole } from "@/lib/types";

interface AppContextValue {
  user: User | null;
  token: string | null;
  authLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => void;
  updateUser: (user: User) => void;
  userRole: UserRole;
  currentStudent: Student | null;
  setCurrentStudent: (student: Student | null) => void;
  allPapers: GeneratedPaper[];
  setAllPapers: (papers: GeneratedPaper[]) => void;
  currentPaper: GeneratedPaper | null;
  setCurrentPaper: (paper: GeneratedPaper | null) => void;
  isTeacher: () => boolean;
  isStudent: () => boolean;
  hasStudent: () => boolean;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

function loadStoredUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function studentFromUser(user: User | null): Student | null {
  if (!user || user.role !== "student" || !user.student_id) return null;
  return {
    id: user.student_id,
    _id: user.student_id,
    name: user.name,
    class: user.class,
    school: user.school,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [allPapers, setAllPapers] = useState<GeneratedPaper[]>([]);
  const [currentPaper, setCurrentPaper] = useState<GeneratedPaper | null>(null);

  const persistUser = useCallback((nextUser: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    setCurrentStudent(studentFromUser(nextUser));
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setCurrentStudent(null);
    setCurrentPaper(null);
    setAllPapers([]);
  }, []);

  // Hydrate from localStorage + validate the stored token on first load.
  useEffect(() => {
    let ignore = false;
    void (async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = loadStoredUser();
      if (!ignore) {
        setToken(storedToken);
        setUser(storedUser);
        setCurrentStudent(studentFromUser(storedUser));
      }

      if (!storedToken) {
        if (!ignore) setAuthLoading(false);
        return;
      }

      try {
        const { user: freshUser } = await fetchMe();
        if (!ignore) persistUser(freshUser);
      } catch {
        if (!ignore) handleLogout();
      } finally {
        if (!ignore) setAuthLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [persistUser, handleLogout]);

  const persistAuth = useCallback(
    (nextToken: string, nextUser: User) => {
      localStorage.setItem(TOKEN_KEY, nextToken);
      setToken(nextToken);
      persistUser(nextUser);
    },
    [persistUser],
  );

  const login = useCallback(
    async (credentials: LoginPayload) => {
      const { token: nextToken, user: nextUser } = await loginUser(credentials);
      persistAuth(nextToken, nextUser);
      return nextUser;
    },
    [persistAuth],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const { token: nextToken, user: nextUser } = await registerUser(payload);
      persistAuth(nextToken, nextUser);
      return nextUser;
    },
    [persistAuth],
  );

  const updateUser = useCallback((nextUser: User) => persistUser(nextUser), [persistUser]);

  const userRole: UserRole = user?.role ?? "student";

  const value: AppContextValue = {
    user,
    token,
    authLoading,
    isAuthenticated: Boolean(token && user),
    login,
    register,
    logout: handleLogout,
    updateUser,
    userRole,
    currentStudent,
    setCurrentStudent,
    allPapers,
    setAllPapers,
    currentPaper,
    setCurrentPaper,
    isTeacher: () => userRole === "teacher",
    isStudent: () => userRole === "student",
    hasStudent: () => currentStudent !== null,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppContext must be used within AppProvider");
  return context;
}
