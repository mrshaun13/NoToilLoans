import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const KEY = "paydown:app-theme";

export function applyTheme(theme: "paper" | "ink") {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"paper" | "ink">("paper");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      const next = stored === "ink" ? "ink" : "paper";
      setTheme(next);
      document.documentElement.setAttribute("data-theme", next);
    } catch {
      /* ignore */
    }
  }, []);

  function toggle() {
    const next = theme === "ink" ? "paper" : "ink";
    setTheme(next);
    applyTheme(next);
  }

  const ink = theme === "ink";

  return (
    <button
      type="button"
      onClick={toggle}
      className="relative inline-flex h-11 w-20 shrink-0 items-center rounded-full bg-muted p-1"
      aria-label={ink ? "Switch to paper" : "Switch to ink"}
      title={ink ? "Paper" : "Ink"}
    >
      <span
        className={cn(
          "absolute top-1 left-1 size-9 rounded-full bg-card shadow-ledger transition-transform duration-200 ease-out",
          ink && "translate-x-9",
        )}
      />
      <span className="relative z-10 flex w-1/2 items-center justify-center">
        <Sun className={cn("size-4", ink ? "text-muted-foreground" : "text-foreground")} />
      </span>
      <span className="relative z-10 flex w-1/2 items-center justify-center">
        <Moon className={cn("size-4", ink ? "text-foreground" : "text-muted-foreground")} />
      </span>
    </button>
  );
}
