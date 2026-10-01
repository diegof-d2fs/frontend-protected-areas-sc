import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { AuthDriver, AuthUser } from "@/lib/auth/types"
import { ApiAuthDriver } from "@/lib/auth/ApiAuthDriver"

// Único ponto de injeção de dependência para autenticação: trocar a implementação (por exemplo
// por um driver que fala com uma API real) é uma linha aqui, sem tocar em `AuthProvider`,
// nas guardas de rota nem nas telas que consomem `useAuth()`.
const defaultDriver: AuthDriver = new ApiAuthDriver()

interface AuthContextValue {
  user: AuthUser | null
  /** true enquanto a sessão inicial (`driver.me()`) ainda está sendo resolvida. */
  isLoading: boolean
  login(username: string, password: string): Promise<AuthUser>
  logout(): Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  children,
  driver = defaultDriver,
}: {
  children: ReactNode
  driver?: AuthDriver
}) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    driver.me().then((current) => {
      if (active) {
        setUser(current)
        setIsLoading(false)
      }
    }).catch(() => {
      if (active) {
        setUser(null)
        setIsLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [driver])

  useEffect(() => {
    const clearExpiredSession = () => setUser(null)
    window.addEventListener("auth:unauthorized", clearExpiredSession)
    return () => window.removeEventListener("auth:unauthorized", clearExpiredSession)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      async login(username, password) {
        const loggedIn = await driver.login(username, password)
        setUser(loggedIn)
        return loggedIn
      },
      async logout() {
        await driver.logout()
        setUser(null)
      },
    }),
    [user, isLoading, driver],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth precisa ser usado dentro de <AuthProvider>.")
  }
  return ctx
}
