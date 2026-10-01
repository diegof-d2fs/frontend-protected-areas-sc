import type { Role } from "@/lib/auth/types"

export interface ManagedAccount {
  id: string
  nome: string
  username: string
  role: Role
  ativo: boolean
  criadoEm: string
}

export interface CreateAccountInput {
  nome: string
  username: string
  role: Role
  /**
   * Senha inicial da conta. Obrigatória a partir da Fase 2: a API real exige uma senha no
   * cadastro (`POST /api/v1/auth/users`), diferente do mock da Fase 1, que não tinha noção de
   * credencial nenhuma. `LocalMockUserRepository` continua aceitando e ignorando este campo.
   */
  password: string
}
