import { BookOpen, ClipboardList, History, LogOut, ShieldCheck, Zap } from "lucide-react"
import { NavLink, Outlet } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/AuthContext"

const NAV_ITEMS = [
  { to: "/cenarios", label: "Cenários", icon: ClipboardList },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/dicionario-dados", label: "Dicionário de dados", icon: BookOpen },
]

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
    isActive && "bg-accent text-accent-foreground",
  )

// Estrutura de navegação de toda área autenticada: barra lateral com os destinos disponíveis ao
// papel da sessão corrente, conteúdo da rota ao lado. `RequireAdmin` continua sendo quem de fato
// bloqueia `/admin` para quem não tem o papel; o link só evita mostrar um destino que a pessoa
// não pode abrir. Empilha acima do conteúdo em telas estreitas em vez de forçar rolagem
// horizontal na página inteira.
export function AppShell() {
  const { user, logout } = useAuth()

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col justify-between gap-4 border-b border-border px-3 py-4 md:w-56 md:gap-0 md:border-r md:border-b-0 md:py-6">
        <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navLinkClassName}>
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
          {user?.role === "admin" && (
            <NavLink to="/admin" className={navLinkClassName}>
              <ShieldCheck className="size-4" aria-hidden="true" />
              Administração
            </NavLink>
          )}
          {user?.role === "admin" && (
            <NavLink to="/admin/modo-eventos" className={navLinkClassName}>
              <Zap className="size-4" aria-hidden="true" />
              Modo eventos
            </NavLink>
          )}
        </nav>

        <div className="flex items-center justify-between gap-2 md:flex-col md:items-stretch md:border-t md:border-border md:pt-4">
          <div className="px-3 text-sm">
            <p className="font-medium text-foreground">{user?.nome}</p>
            <p className="text-muted-foreground">
              {user?.role === "admin" ? "Administrador" : "Operador"}
            </p>
          </div>
          <Button type="button" variant="ghost" className="justify-start gap-2" onClick={logout}>
            <LogOut className="size-4" aria-hidden="true" />
            Sair
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-6">
        <Outlet />
      </main>
    </div>
  )
}
