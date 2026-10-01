import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

type Theme = "light" | "dark"

const STORAGE_KEY = "protected-areas-theme-v2"

interface ThemeContextValue {
  theme: Theme
  setTheme(theme: Theme): void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function readStoredTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === "light" ? "light" : "dark"
  } catch {
    return "dark"
  }
}

// Escuro é o padrão; nada muda sozinho com a preferência do sistema operacional, só o alternador
// explícito no cabeçalho decide. A escolha persiste entre sessões no navegador da pessoa.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Armazenamento indisponível (modo privado, política do navegador): a escolha só não
      // sobrevive a um recarregamento, o alternador continua funcionando na mesma sessão.
    }
  }, [theme])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme: setThemeState }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue & { resolvedTheme: Theme } {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error("useTheme precisa ser usado dentro de <ThemeProvider>.")
  }
  return { ...ctx, resolvedTheme: ctx.theme }
}
