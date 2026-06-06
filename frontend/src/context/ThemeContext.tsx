"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";
const THEME_KEY = "edtech_theme";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Sync from storage / DOM on mount (a no-flash script in layout sets the
  // attribute before hydration, so just read it back here).
  useEffect(() => {
    let ignore = false;
    void (async () => {
      const stored =
        (localStorage.getItem(THEME_KEY) as Theme | null) ??
        (document.documentElement.getAttribute("data-theme") as Theme | null);
      if (!ignore && stored) setThemeState(stored);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(
    () => setThemeState((prev) => (prev === "light" ? "dark" : "light")),
    [],
  );

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
