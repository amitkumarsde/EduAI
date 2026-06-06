"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/context/ThemeContext";
import { AppProvider } from "@/context/AppContext";
import { LanguageProvider } from "@/context/LanguageContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AppProvider>
        <LanguageProvider>{children}</LanguageProvider>
      </AppProvider>
    </ThemeProvider>
  );
}
