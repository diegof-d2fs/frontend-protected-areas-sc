import type { CreateAccountInput, ManagedAccount } from "./types"

/**
 * Repositório de contas em memória, sem nenhuma chamada de rede. Segue o mesmo formato que uma
 * implementação futura contra uma API real usaria (listar, criar, desativar/reativar, redefinir
 * senha), para que a tela que o consome não precise mudar quando a origem dos dados mudar.
 *
 * Nenhum método exclui uma conta fisicamente: revogar acesso é sempre desativação, nunca remoção
 * do registro, para preservar de quem foi cada ação registrada no sistema.
 */
export class LocalMockUserRepository {
  private accounts: ManagedAccount[] = [
    {
      id: "seed-admin",
      nome: "Administrador",
      username: "admin",
      role: "admin",
      ativo: true,
      criadoEm: new Date().toISOString(),
    },
  ]

  async list(): Promise<ManagedAccount[]> {
    return [...this.accounts]
  }

  async create(input: CreateAccountInput): Promise<ManagedAccount> {
    const username = input.username.trim()
    if (!username) {
      throw new Error("Informe um nome de usuário.")
    }
    if (this.accounts.some((account) => account.username.toLowerCase() === username.toLowerCase())) {
      throw new Error("Já existe uma conta com esse nome de usuário.")
    }

    const account: ManagedAccount = {
      id: `mock-${Date.now()}`,
      nome: input.nome.trim() || username,
      username,
      role: input.role,
      ativo: true,
      criadoEm: new Date().toISOString(),
    }
    this.accounts = [...this.accounts, account]
    return account
  }

  async setActive(id: string, ativo: boolean): Promise<void> {
    this.accounts = this.accounts.map((account) =>
      account.id === id ? { ...account, ativo } : account,
    )
  }

  async resetPassword(id: string): Promise<void> {
    if (!this.accounts.some((account) => account.id === id)) {
      throw new Error("Conta não encontrada.")
    }
    // Sem senha real para redefinir nesta implementação: só confirma que a conta existe.
  }
}

export const localMockUserRepository = new LocalMockUserRepository()
