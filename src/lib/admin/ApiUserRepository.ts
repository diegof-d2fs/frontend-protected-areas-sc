import { apiRequest } from "@/lib/api/client"
import type { Role } from "@/lib/auth/types"
import type { CreateAccountInput, ManagedAccount } from "./types"

interface UserViewResponse {
  id: number
  username: string
  nome: string
  role: Role
  ativo: boolean
  criado_em: string
}

function toManagedAccount(view: UserViewResponse): ManagedAccount {
  return {
    id: String(view.id),
    nome: view.nome,
    username: view.username,
    role: view.role,
    ativo: view.ativo,
    criadoEm: view.criado_em,
  }
}

/**
 * Implementação real de repositório de contas, contra `/api/v1/auth/users` (somente
 * administrador). Segue o mesmo formato de `LocalMockUserRepository` para que
 * `AdminDashboardPage` não precise mudar como consome a lista, só de onde ela vem.
 *
 * `resetPassword` não tem rota correspondente no contrato atual da API (`docs/SDD.md`, seção
 * 2.4, só lista criar/listar/ativar-desativar) — o mock da Fase 1 tratava isso como um número
 * fixo, sem endpoint real por trás. Lançar aqui em vez de fingir sucesso é a correção: se a API
 * ganhar essa rota depois, é só implementar este método.
 */
export class ApiUserRepository {
  async list(): Promise<ManagedAccount[]> {
    const views = await apiRequest<UserViewResponse[]>("/auth/users")
    return views.map(toManagedAccount)
  }

  async create(input: CreateAccountInput): Promise<ManagedAccount> {
    const view = await apiRequest<UserViewResponse>("/auth/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: input.username.trim(),
        nome: input.nome.trim(),
        password: input.password,
        role: input.role,
      }),
    })
    return toManagedAccount(view)
  }

  async setActive(id: string, ativo: boolean): Promise<void> {
    await apiRequest<UserViewResponse>(`/auth/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo }),
    })
  }

  async resetPassword(id: string): Promise<void> {
    throw new Error(
      `Redefinir senha ainda não está disponível: a API não expõe essa rota nesta versão (conta ${id}).`,
    )
  }
}

export const apiUserRepository = new ApiUserRepository()
