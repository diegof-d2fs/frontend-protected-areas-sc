import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"

/**
 * Restringe rotas administrativas ao papel de administrador. Assume que a rota já está aninhada
 * sob `RequireAuth`, então só confere o papel: um operador autenticado que tentar acessar uma
 * rota administrativa volta para a área de operador, não para o login (a sessão dele é válida,
 * só não tem esse papel).
 */
export function RequireAdmin() {
  const { user } = useAuth()

  if (user?.role !== "admin") {
    return <Navigate to="/cenarios" replace />
  }

  return <Outlet />
}
