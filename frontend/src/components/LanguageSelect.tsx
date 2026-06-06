"use client";

import { LuLanguages } from "react-icons/lu";
import { useLanguage } from "@/context/LanguageContext";
import { Select } from "@/components/ui/Field";
import type { SupportedLanguage } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Compact language picker bound to the global LanguageContext. Used wherever AI
 * output should be localized (tutor, quiz, recommendations, content).
 */
export function LanguageSelect({ className }: { className?: string }) {
  const { language, setLanguage, languages } = useLanguage();
  return (
    <label className={cn("inline-flex items-center gap-2 text-sm text-muted", className)}>
      <LuLanguages className="h-4 w-4 shrink-0" />
      <Select
        aria-label="AI response language"
        value={language}
        onChange={(event) => setLanguage(event.target.value as SupportedLanguage)}
        className="h-9 w-auto min-w-[8rem]"
      >
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {lang}
          </option>
        ))}
      </Select>
    </label>
  );
}

export default LanguageSelect;
