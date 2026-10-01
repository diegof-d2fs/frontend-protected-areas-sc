import type { AuthDriver, AuthUser } from "./types"

const STORAGE_KEY = "mock-session"

function readStoredUser(): AuthUser | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}

function writeStoredUser(user: AuthUser | null) {
  try {
    if (user) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Armazenamento indisponível (modo privado, política do navegador): a sessão simplesmente
    // não sobrevive a uma atualização de página nesse caso, sem quebrar o login em si.
  }
}

/**
 * Implementação local de `AuthDriver`, sem nenhuma chamada de rede. Aceita qualquer usuário e
 * senha não vazios; o papel (`admin`/`operador`) é decidido pelo nome de usuário para permitir
 * demonstrar as duas experiências sem precisar manter duas contas reais: digitar "admin" entra
 * como administrador, qualquer outro nome entra como operador.
 *
 * A sessão fica em `sessionStorage` (não `localStorage`): sobrevive a uma atualização de página,
 * mas nunca a mais que isso — fechar a aba encerra a sessão, e nenhum dado sensível é guardado
 * aqui, só o nome e o papel escolhidos no login. Isto não é um mecanismo de autenticação e nunca
 * deve ser tratado como tal por quem consome `AuthContext`.
 */
export class LocalMockAuthDriver implements AuthDriver {
  async login(username: string, password: string): Promise<AuthUser> {
    const nome = username.trim()
    if (!nome || !password.trim()) {
      throw new Error("Informe usuário e senha.")
    }

    const role = nome.toLowerCase() === "admin" ? "admin" : "operador"
    const user: AuthUser = {
      id: `mock-${nome.toLowerCase()}`,
      nome: nome[0].toUpperCase() + nome.slice(1),
      role,
    }
    writeStoredUser(user)
    return user
  }

  async logout(): Promise<void> {
    writeStoredUser(null)
  }

  async me(): Promise<AuthUser | null> {
    return readStoredUser()
  }
}
