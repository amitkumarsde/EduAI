"use client";

/**
 * Tracks the learner's preferred language for AI output (tutor, quizzes,
 * recommendations, grading). Persisted to localStorage so it survives reloads.
 */
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/lib/types";

const LANGUAGE_KEY = "edtech_language";

function loadStoredLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return "English";
  const stored = localStorage.getItem(LANGUAGE_KEY) as SupportedLanguage | null;
  return stored && SUPPORTED_LANGUAGES.includes(stored) ? stored : "English";
}

interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  languages: readonly SupportedLanguage[];
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(loadStoredLanguage);

  const setLanguage = useCallback((next: SupportedLanguage) => {
    setLanguageState(next);
    localStorage.setItem(LANGUAGE_KEY, next);
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, languages: SUPPORTED_LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
