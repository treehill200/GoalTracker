"use client";
import { ThemeProvider as NextThemes } from "next-themes";

/** Dark is the default theme; users can switch to light in Settings or the header. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
