import { ApiError, apiRequest } from "@/lib/api/client"
import type { AuthDriver, AuthUser, Role } from "./types"

interface CurrentUserResponse {
  id: number
  nome: string
  role: Role
}

function toAuthUser(response: CurrentUserResponse): AuthUser {
  return { id: String(response.id), nome: response.nome, role: response.role }
}

/**
 * Implementação real de `AuthDriver`: fala com `/api/v1/auth/*`, com a sessão inteira num cookie
 * `httpOnly` que o navegador administra sozinho — nada aqui lê, escreve ou guarda o token em
 * JavaScript. `me()` devolve `null` (em vez de propagar o erro) quando a API responde `401`,
 * porque para `AuthProvider` isso significa apenas "ninguém logado ainda", não uma falha de rede.
 */
export class ApiAuthDriver implements AuthDriver {
  async login(username: string, password: string): Promise<AuthUser> {
    const response = await apiRequest<CurrentUserResponse>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    })
    return toAuthUser(response)
  }

  async logout(): Promise<void> {
    await apiRequest<void>("/auth/logout", { method: "POST" })
  }

  async me(): Promise<AuthUser | null> {
    try {
      const response = await apiRequest<CurrentUserResponse>("/auth/me")
      return toAuthUser(response)
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 401) {
        return null
      }
      throw error
    }
  }
}
