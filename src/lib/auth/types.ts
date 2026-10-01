export type Role = "admin" | "operador"

export interface AuthUser {
  id: string
  nome: string
  role: Role
}

/**
 * Contrato único de autenticação, independente de a implementação por trás ser um estado local
 * em memória ou uma API real com sessão em cookie. `AuthContext` e as guardas de rota dependem
 * só desta interface, então trocar a implementação é uma linha de injeção de dependência, nunca
 * uma reescrita de tela.
 */
export interface AuthDriver {
  login(username: string, password: string): Promise<AuthUser>
  logout(): Promise<void>
  me(): Promise<AuthUser | null>
}
