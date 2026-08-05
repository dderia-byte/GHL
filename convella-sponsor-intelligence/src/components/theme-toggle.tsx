"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "convella-theme";
const listeners = new Set<() => void>();

function getSnapshot(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): "light" | "dark" | null {
  return null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem(STORAGE_KEY, theme);
  listeners.forEach((listener) => listener());
}

/** Icon-only toggle; theme state is read from the DOM class the inline init script already set, so there's no flash. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!theme) {
    return <span className="inline-block size-8" aria-hidden="true" />;
  }

  return (
    <button
      type="button"
      onClick={() => applyTheme(theme === "dark" ? "light" : "dark")}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

export const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('${STORAGE_KEY}');var t=s||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`;
